// netlify/functions/aihubmix-process-background.js
const fetch = require('node-fetch');
const FormData = require('form-data');
const cloudinary = require('cloudinary').v2;
const { getBlobStore } = require('@netlify/blobs');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

exports.handler = async (event, context) => {
    console.log('[aihubmix-process-background] Function invoked.');
    
    let taskId;
    try {
        const requestBody = JSON.parse(event.body);
        const { image_base64, prompt: userPrompt, size, n } = requestBody;
        taskId = requestBody.taskId;

        if (!taskId) {
            console.error('[aihubmix-process-background] Missing taskId');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing taskId' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        const store = getBlobStore('aihubmix_tasks');

        // Update status to processing
        await store.setJSON(taskId, {
            status: 'processing',
            taskId: taskId,
            startedAt: new Date().toISOString()
        });

        console.log(`[aihubmix-process-background] Task ${taskId}: Processing image with Aihubmix.`);
        
        // Convert Base64 to Buffer
        const imageBuffer = Buffer.from(image_base64, 'base64');

        // Create FormData instance
        const form = new FormData();
        form.append('image', imageBuffer, { 
            filename: 'input_image.png', 
            contentType: 'image/png' 
        });
        form.append('model', 'gpt-image-1');
        form.append('prompt', userPrompt || "Remove the background, making it transparent. Keep the main subject clear and high quality.");
        form.append('n', n.toString());
        form.append('size', size);

        const apiUrl = 'https://aihubmix.com/v1/images/edits';
        
        // Get form headers
        const formHeaders = form.getHeaders();
        
        console.log(`[aihubmix-process-background] Task ${taskId}: Sending request to Aihubmix API.`);
        
        const aihubmixResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.AIHUBMIX_API_KEY}`,
                ...formHeaders,
            },
            body: form,
            timeout: 120000 // 2 minutes timeout
        });

        if (!aihubmixResponse.ok) {
            const errorBody = await aihubmixResponse.text();
            console.error(`[aihubmix-process-background] Task ${taskId}: Aihubmix API Error: ${aihubmixResponse.status}`, errorBody);
            await store.setJSON(taskId, { 
                status: 'failed', 
                error: `Aihubmix API Error: ${aihubmixResponse.status} - ${errorBody}`,
                failedAt: new Date().toISOString()
            });
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Task failed, status updated' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        const aihubmixData = await aihubmixResponse.json();
        console.log(`[aihubmix-process-background] Task ${taskId}: Aihubmix response received.`);
        
        if (!aihubmixData || !aihubmixData.data || !aihubmixData.data[0] || !aihubmixData.data[0].b64_json) {
            console.error(`[aihubmix-process-background] Task ${taskId}: Invalid response structure from Aihubmix.`, aihubmixData);
            await store.setJSON(taskId, { 
                status: 'failed', 
                error: 'Invalid response structure from Aihubmix.',
                failedAt: new Date().toISOString()
            });
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Task failed, status updated' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        const processedImageBase64 = aihubmixData.data[0].b64_json;
        console.log(`[aihubmix-process-background] Task ${taskId}: Image processed by Aihubmix. Uploading to Cloudinary.`);

        const cloudinaryUploadResponse = await cloudinary.uploader.upload(`data:image/png;base64,${processedImageBase64}`, {
            folder: 'aihubmix_processed',
            resource_type: 'image',
            timeout: 60000 // 1 minute timeout for upload
        });

        console.log(`[aihubmix-process-background] Task ${taskId}: Image uploaded to Cloudinary: ${cloudinaryUploadResponse.secure_url}`);
        await store.setJSON(taskId, { 
            status: 'completed', 
            imageUrl: cloudinaryUploadResponse.secure_url,
            completedAt: new Date().toISOString()
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Task completed successfully' }),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        console.error(`[aihubmix-process-background] Task ${taskId}: Error processing image:`, error);
        
        if (taskId) {
            try {
                const store = getBlobStore('aihubmix_tasks');
                await store.setJSON(taskId, { 
                    status: 'failed', 
                    error: error.message,
                    failedAt: new Date().toISOString()
                });
            } catch (storeError) {
                console.error(`[aihubmix-process-background] Failed to update task status:`, storeError);
            }
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error', details: error.message }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};

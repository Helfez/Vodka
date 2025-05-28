// netlify/functions/aihubmix-process-background.js
// const fetch = require('node-fetch'); // No longer needed for AI call
// const FormData = require('form-data'); // No longer needed
const { OpenAI, toFile } = require('openai'); // Import OpenAI SDK
const cloudinary = require('cloudinary').v2;
const { getBlobStore } = require('@netlify/blobs');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

const openai = new OpenAI({
    apiKey: process.env.AIHUBMIX_API_KEY,
    baseURL: 'https://aihubmix.com/v1',
});

exports.handler = async (event, context) => {
    console.log('[aihubmix-process-background] Function invoked.');
    
    let taskId;
    let taskDataFromBlob; // To store the full task data from blob

    try {
        const requestBody = JSON.parse(event.body);
        taskId = requestBody.taskId; // Expecting only taskId from the trigger

        if (!taskId) {
            console.error('[aihubmix-process-background] Missing taskId in request body');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing taskId' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        const store = getBlobStore('aihubmix_tasks');
        taskDataFromBlob = await store.get(taskId, { type: 'json' });

        if (!taskDataFromBlob) {
            console.error(`[aihubmix-process-background] Task ${taskId}: Not found in Blob store.`);
            // Don't update blob here as the task might not have been created properly
            return {
                statusCode: 404, // Not Found
                body: JSON.stringify({ error: 'Task data not found in store' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        // Update status to processing in Blob store
        await store.setJSON(taskId, {
            ...taskDataFromBlob, // Preserve existing data
            status: 'processing',
            startedAt: new Date().toISOString()
        });

        const { image_base64, prompt: userPrompt, n, size } = taskDataFromBlob;
        console.log(`[aihubmix-process-background] Task ${taskId}: Processing image using OpenAI SDK.`);
        
        const imageBuffer = Buffer.from(image_base64, 'base64');
        const imageFileUploadable = await toFile(imageBuffer, 'input_image.png', {
            type: 'image/png',
        });

        // Parameters for OpenAI SDK call
        const model = "gpt-image-1"; // Or make this configurable via taskDataFromBlob if needed
        const quality = "high";      // Or make this configurable
        const response_format = "b64_json";

        console.log(`[aihubmix-process-background] Task ${taskId}: Calling AIhubmix images.edit via SDK with model=${model}, n=${n}, size=${size}, quality=${quality}`);
        
        const aihubmixResponse = await openai.images.edit({
            model: model,
            image: imageFileUploadable,
            prompt: userPrompt,
            n: parseInt(n, 10), // Ensure n is an integer
            size: size,
            quality: quality,
            response_format: response_format 
        });

        console.log(`[aihubmix-process-background] Task ${taskId}: AIhubmix SDK response received.`);

        if (!aihubmixResponse || !aihubmixResponse.data || !aihubmixResponse.data[0] || !aihubmixResponse.data[0].b64_json) {
            const errorDetail = '[aihubmix-process-background] Task ${taskId}: Invalid response structure from AIhubmix SDK.';
            console.error(errorDetail, aihubmixResponse);
            await store.setJSON(taskId, { 
                ...taskDataFromBlob,
                status: 'failed', 
                error: errorDetail,
                failedAt: new Date().toISOString()
            });
            return { // Return 200 OK as the background function itself completed its attempt
                statusCode: 200, 
                body: JSON.stringify({ message: 'Task failed due to API response, status updated in Blob' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        const processedImageBase64 = aihubmixResponse.data[0].b64_json;
        console.log(`[aihubmix-process-background] Task ${taskId}: Image processed by AIhubmix. Uploading to Cloudinary.`);

        const cloudinaryUploadResponse = await cloudinary.uploader.upload(`data:image/png;base64,${processedImageBase64}`, {
            folder: 'aihubmix_processed',
            resource_type: 'image',
            timeout: 60000 // 1 minute timeout for upload
        });

        console.log(`[aihubmix-process-background] Task ${taskId}: Image uploaded to Cloudinary: ${cloudinaryUploadResponse.secure_url}`);
        await store.setJSON(taskId, { 
            ...taskDataFromBlob,
            status: 'completed', 
            imageUrl: cloudinaryUploadResponse.secure_url,
            completedAt: new Date().toISOString()
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Task completed successfully and status updated in Blob' }),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        console.error(`[aihubmix-process-background] Task ${taskId || 'UNKNOWN'}: Error processing image:`, error);
        
        if (taskId && getBlobStore) { // Ensure store can be accessed
            try {
                const store = getBlobStore('aihubmix_tasks');
                // Check if taskDataFromBlob was fetched, to avoid overwriting good data with just an error status
                const updatePayload = taskDataFromBlob ? { ...taskDataFromBlob } : { taskId }; 
                await store.setJSON(taskId, { 
                    ...updatePayload,
                    status: 'failed', 
                    error: `Background processing error: ${error.message}`,
                    errorStack: error.stack, // Include stack for better debugging
                    failedAt: new Date().toISOString()
                });
            } catch (storeError) {
                console.error(`[aihubmix-process-background] Failed to update task status for ${taskId} after an error:`, storeError);
            }
        }
        // Return 200 OK for the background function invocation itself, error is logged & stored in Blob
        return {
            statusCode: 200, 
            body: JSON.stringify({ message: 'Background task encountered an error, status updated in Blob', details: error.message }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};

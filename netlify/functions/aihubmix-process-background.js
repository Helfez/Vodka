// netlify/functions/aihubmix-process-background.js
// import fetch from 'node-fetch'; // No longer needed for AI call
// import FormData from 'form-data'; // No longer needed
import { OpenAI, toFile } from 'openai'; // Import OpenAI SDK
import cloudinary from 'cloudinary';
import { getStore } from '@netlify/blobs';

const cloudinaryV2 = cloudinary.v2;

cloudinaryV2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

const openai = new OpenAI({
    apiKey: process.env.AIHUBMIX_API_KEY,
    baseURL: 'https://aihubmix.com/v1',
});

export default async (request, context) => {
    console.log('[aihubmix-process-background] Function invoked.');
    
    let taskId;
    let taskDataFromBlob; // To store the full task data from blob

    try {
        const bodyText = await request.text();
        const requestBody = JSON.parse(bodyText);
        taskId = requestBody.taskId; // Expecting only taskId from the trigger

        if (!taskId) {
            console.error('[aihubmix-process-background] Missing taskId in request body');
            return new Response(JSON.stringify({ error: 'Missing taskId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 在 Functions v2 中，Netlify Blobs 应该自动工作
        let store;
        try {
            store = getStore('aihubmix_tasks'); // 首先尝试不带参数
        } catch (error) {
            console.log('[aihubmix-process-background] Fallback to manual siteID/token configuration');
            store = getStore('aihubmix_tasks', {
                siteID: process.env.NETLIFY_SITE_ID || context.site?.id,
                token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
            }); // 手动提供 siteID 和 token
        }
        
        taskDataFromBlob = await store.get(taskId, { type: 'json' });

        if (!taskDataFromBlob) {
            console.error(`[aihubmix-process-background] Task ${taskId}: Not found in Blob store.`);
            // Don't update blob here as the task might not have been created properly
            return new Response(JSON.stringify({ error: 'Task data not found in store' }), {
                status: 404, // Not Found
                headers: { 'Content-Type': 'application/json' }
            });
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
            return new Response(JSON.stringify({ message: 'Task failed due to API response, status updated in Blob' }), {
                status: 200, 
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const processedImageBase64 = aihubmixResponse.data[0].b64_json;
        console.log(`[aihubmix-process-background] Task ${taskId}: Image processed by AIhubmix. Uploading to Cloudinary.`);

        const cloudinaryUploadResponse = await cloudinaryV2.uploader.upload(`data:image/png;base64,${processedImageBase64}`, {
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

        return new Response(JSON.stringify({ message: 'Task completed successfully and status updated in Blob' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`[aihubmix-process-background] Task ${taskId || 'UNKNOWN'}: Error processing image:`, error);
        
        if (taskId && getStore) { // Ensure store can be accessed
            try {
                // 在 Functions v2 中，Netlify Blobs 应该自动工作
                let store;
                try {
                    store = getStore('aihubmix_tasks'); // 首先尝试不带参数
                } catch (storeError) {
                    console.log('[aihubmix-process-background] Fallback to manual siteID/token configuration in error handler');
                    store = getStore('aihubmix_tasks', {
                        siteID: process.env.NETLIFY_SITE_ID || context.site?.id,
                        token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
                    }); // 手动提供 siteID 和 token
                }
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
        return new Response(JSON.stringify({ message: 'Background task encountered an error, status updated in Blob', details: error.message }), {
            status: 200, 
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
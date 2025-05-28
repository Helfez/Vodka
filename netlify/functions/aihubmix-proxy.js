const fetch = require('node-fetch');
// FormData and cloudinary are no longer directly used here for processing, moved to background
const { getBlobStore } = require('@netlify/blobs');
const { v4: uuidv4 } = require('uuid');

// Cloudinary config is not needed here anymore as it's handled by the background function

exports.handler = async (event, context) => {
    console.log('[aihubmix-proxy] Synchronous function invoked.');

    if (event.httpMethod !== 'POST') {
        console.warn(`[aihubmix-proxy] Invalid HTTP method: ${event.httpMethod}`);
        return {
            statusCode: 405,
            body: JSON.stringify({ error: '只允许POST方法' }),
            headers: { 'Allow': 'POST' },
        };
    }

    // Environment variable checks for keys used by the background function can still be useful here
    // as a preliminary check, or be solely in the background function.
    // For now, let's assume they are checked in the background function.

    const apiKey = process.env.AIHUBMIX_API_KEY;
    if (!apiKey) {
        console.error('[aihubmix-proxy] AIHUBMIX_API_KEY not set. This will be needed by the background function.');
        // Potentially return an error early, or let the background function fail and report.
        // For now, we'll proceed and let the background function handle its own env var checks.
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (error) {
        console.error('[aihubmix-proxy] Invalid JSON body:', error.message);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: '无效的JSON请求体', details: error.message }),
        };
    }

    const { image_base64, prompt: userPrompt, size = "1024x1024", n = 1 } = requestBody;

    if (!image_base64) {
        console.error('[aihubmix-proxy] Missing image_base64 parameter');
        return {
            statusCode: 400,
            body: JSON.stringify({ error: '请求体中缺少有效的图像Base64编码 (image_base64)' }),
        };
    }

    const taskId = uuidv4();
    const store = getBlobStore('aihubmix_tasks'); // Same store name as in background and status functions

    try {
        // Store initial pending status
        await store.setJSON(taskId, {
            status: 'pending',
            taskId: taskId,
            createdAt: new Date().toISOString(),
            originalRequest: { // Optionally store some context about the request
                prompt: userPrompt,
                size: size,
                n: n
            }
        });
        console.log(`[aihubmix-proxy] Task ${taskId} created and status set to pending.`);

        // Asynchronously invoke the background function
        // Construct the URL for the background function
        // Note: The actual URL might depend on your Netlify site name if calling from outside Netlify's environment
        // When a function calls another function within the same Netlify site, relative paths usually work.
        const backgroundFunctionUrl = `${process.env.URL}/.netlify/functions/aihubmix-process-background`;
        
        console.log(`[aihubmix-proxy] Invoking background function at: ${backgroundFunctionUrl} for task ${taskId}`);

        // We don't await this fetch call, making it non-blocking
        fetch(backgroundFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Potentially add a secret header for inter-function communication if needed for security
            },
            body: JSON.stringify({ image_base64, prompt: userPrompt, size, n, taskId }),
        })
        .then(res => {
            if (!res.ok) {
                // Log if the invocation itself failed, but the proxy has already responded to client
                console.error(`[aihubmix-proxy] Failed to invoke background function for task ${taskId}. Status: ${res.status}. The task status in blob store might need manual update or will remain pending.`);
                // Optionally, update blob store to reflect invocation failure if critical
            } else {
                console.log(`[aihubmix-proxy] Background function invoked successfully for task ${taskId}. It will process asynchronously.`);
            }
        })
        .catch(err => {
            // Log if the invocation itself failed due to network or other issues
            console.error(`[aihubmix-proxy] Error invoking background function for task ${taskId}:`, err);
            // Optionally, update blob store to reflect invocation failure
        });

        // Return 202 Accepted to the client with the taskId
        return {
            statusCode: 202,
            body: JSON.stringify({ message: '请求已接受，正在后台处理中。', taskId: taskId }),
        };

    } catch (error) {
        console.error(`[aihubmix-proxy] Error in main proxy function for task ${taskId}:`, error);
        // If error occurs before invoking background function, or during blob store set
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '处理请求时发生内部错误。', details: error.message, taskId: taskId }), // Include taskId if generated
        };
    }
};
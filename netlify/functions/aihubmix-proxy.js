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
            headers: { 
                'Allow': 'POST',
                'Content-Type': 'application/json'
            },
        };
    }

    const apiKey = process.env.AIHUBMIX_API_KEY;
    if (!apiKey) {
        console.error('[aihubmix-proxy] AIHUBMIX_API_KEY not set.');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '服务器配置错误：缺少API密钥' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (error) {
        console.error('[aihubmix-proxy] Invalid JSON body:', error.message);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: '无效的JSON请求体', details: error.message }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    const { image_base64, prompt: userPrompt, size = "1024x1024", n = 1 } = requestBody;

    if (!image_base64) {
        console.error('[aihubmix-proxy] Missing image_base64 parameter');
        return {
            statusCode: 400,
            body: JSON.stringify({ error: '请求体中缺少有效的图像Base64编码 (image_base64)' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    const taskId = uuidv4();
    const store = getBlobStore('aihubmix_tasks');

    try {
        // Store initial pending status
        await store.setJSON(taskId, {
            status: 'pending',
            taskId: taskId,
            createdAt: new Date().toISOString(),
            originalRequest: {
                prompt: userPrompt,
                size: size,
                n: n
            }
        });
        console.log(`[aihubmix-proxy] Task ${taskId} created and status set to pending.`);

        // Construct the URL for the background function
        // Use the current request's origin to build the background function URL
        const protocol = event.headers['x-forwarded-proto'] || 'https';
        const host = event.headers.host;
        const siteUrl = `${protocol}://${host}`;
        const backgroundFunctionUrl = `${siteUrl}/.netlify/functions/aihubmix-process-background`;
        
        console.log(`[aihubmix-proxy] Invoking background function at: ${backgroundFunctionUrl} for task ${taskId}`);

        // Non-blocking call to background function
        fetch(backgroundFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image_base64, prompt: userPrompt, size, n, taskId }),
            timeout: 30000 // 30 second timeout for the invocation itself
        })
        .then(res => {
            if (!res.ok) {
                console.error(`[aihubmix-proxy] Failed to invoke background function for task ${taskId}. Status: ${res.status}`);
                // Update task status to failed
                store.setJSON(taskId, { 
                    status: 'failed', 
                    error: `Failed to start background processing: ${res.status}` 
                }).catch(err => console.error('Failed to update task status:', err));
            } else {
                console.log(`[aihubmix-proxy] Background function invoked successfully for task ${taskId}`);
            }
        })
        .catch(err => {
            console.error(`[aihubmix-proxy] Error invoking background function for task ${taskId}:`, err);
            // Update task status to failed
            store.setJSON(taskId, { 
                status: 'failed', 
                error: `Failed to start background processing: ${err.message}` 
            }).catch(updateErr => console.error('Failed to update task status:', updateErr));
        });

        // Return 202 Accepted to the client with the taskId
        return {
            statusCode: 202,
            body: JSON.stringify({ 
                message: '请求已接受，正在后台处理中。', 
                taskId: taskId,
                statusUrl: `/.netlify/functions/aihubmix-status?taskId=${taskId}`
            }),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        console.error(`[aihubmix-proxy] Error in main proxy function for task ${taskId}:`, error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: '处理请求时发生内部错误。', 
                details: error.message, 
                taskId: taskId 
            }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};
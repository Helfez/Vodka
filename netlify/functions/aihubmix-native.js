import { getStore } from '@netlify/blobs';
import { v4 as uuidv4 } from 'uuid'; // For generating unique task IDs
import fetch from 'node-fetch'; // For invoking the background function

export default async (request, context) => {
    console.log('[aihubmix-native-trigger] Function invoked.');
    console.log('[aihubmix-native-trigger] Request method:', request.method);
    console.log('[aihubmix-native-trigger] Request URL:', request.url);

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (request.method === 'OPTIONS') {
        return new Response('', {
            status: 200,
            headers: corsHeaders
        });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: '只允许POST方法' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const siteURL = context.site?.url || process.env.URL || 'https://d-vodka.netlify.app';

    let requestBody;
    try {
        const bodyText = await request.text();
        requestBody = JSON.parse(bodyText);
    } catch (error) {
        console.error('[aihubmix-native-trigger] Invalid JSON body:', error.message);
        return new Response(JSON.stringify({ error: '无效的JSON请求体', details: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const { 
        image_base64, 
        prompt: userPrompt, // Use the user's prompt
        n = 1,              // Default n to 1 for background processing unless specified
        size = "1024x1024"  // Default size unless specified
    } = requestBody;

    if (!image_base64) {
        console.error('[aihubmix-native-trigger] Missing image_base64 parameter');
        return new Response(JSON.stringify({ error: '请求体中缺少有效的图像Base64编码 (image_base64)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    const taskId = uuidv4();
    
    // 在 Functions v2 中，Netlify Blobs 应该自动工作
    let store;
    try {
        store = getStore('aihubmix_tasks'); // 首先尝试不带参数
    } catch (error) {
        console.log('[aihubmix-native-trigger] Fallback to manual siteID/token configuration');
        // 在 Functions v2 中，使用 context 对象的正确属性
        const siteID = process.env.NETLIFY_SITE_ID || context.site?.id;
        const token = process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN;
        
        store = getStore('aihubmix_tasks', { 
            siteID: siteID,
            token: token 
        }); // 手动提供 siteID 和 token
    }

    try {
        const taskData = {
            taskId,
            image_base64, // Store the full base64
            prompt: userPrompt || "Remove the background, making it transparent. Keep the main subject clear and high quality.", // Default prompt if not provided
            n: parseInt(n, 10),
            size: size,
            status: 'pending',
            submittedAt: new Date().toISOString()
        };

        await store.setJSON(taskId, taskData);
        console.log(`[aihubmix-native-trigger] Task ${taskId} stored in Blobs with status 'pending'.`);

        // 使用更可靠的方式调用background函数
        const backgroundFunctionURL = `${siteURL}/.netlify/functions/aihubmix-process-background`;
        
        console.log(`[aihubmix-native-trigger] Invoking background function at ${backgroundFunctionURL} for task ${taskId}`);
        console.log(`[aihubmix-native-trigger] Site URL: ${siteURL}`);

        // 使用全局fetch而不是node-fetch
        const fetchPromise = fetch(backgroundFunctionURL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Netlify-Function-Internal'
            },
            body: JSON.stringify({ taskId })
        });

        // 不等待结果，但添加更详细的错误处理
        fetchPromise.then(async (res) => {
            console.log(`[aihubmix-native-trigger] Background function response status: ${res.status} for task ${taskId}`);
            if (!res.ok) {
                const errorText = await res.text().catch(() => 'Unable to read error response');
                console.error(`[aihubmix-native-trigger] Error invoking background function for task ${taskId}. Status: ${res.status}, Response: ${errorText}`);
                
                // 更新任务状态为失败
                try {
                    await store.setJSON(taskId, { 
                        ...taskData, 
                        status: 'trigger_failed', 
                        error: `Background invocation failed with status ${res.status}: ${errorText}`,
                        failedAt: new Date().toISOString()
                    });
                } catch (updateError) {
                    console.error(`[aihubmix-native-trigger] Failed to update task status after background invocation error:`, updateError);
                }
            } else {
                console.log(`[aihubmix-native-trigger] Successfully invoked background function for task ${taskId}.`);
            }
        }).catch(async (err) => {
            console.error(`[aihubmix-native-trigger] Network error invoking background function for task ${taskId}:`, err);
            
            // 更新任务状态为失败
            try {
                await store.setJSON(taskId, { 
                    ...taskData, 
                    status: 'trigger_failed', 
                    error: `Background invocation network error: ${err.message}`,
                    failedAt: new Date().toISOString()
                });
            } catch (updateError) {
                console.error(`[aihubmix-native-trigger] Failed to update task status after network error:`, updateError);
            }
        });

        return new Response(JSON.stringify({ 
            success: true, 
            taskId: taskId,
            status: 'pending',
            message: '任务已提交处理，请稍后查询状态。'
        }), {
            status: 202, // Accepted for processing
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`[aihubmix-native-trigger] Error processing request for task ${taskId}:`, error);
        // If task creation failed before even invoking background, update blob for taskId if possible
        if (taskId) {
            try {
                await store.setJSON(taskId, {
                    taskId,
                    status: 'failed',
                    error: `Trigger function error: ${error.message}`,
                    failedAt: new Date().toISOString()
                });
            } catch (blobError) {
                console.error(`[aihubmix-native-trigger] Error updating blob for failed task ${taskId}:`, blobError);
            }
        }
        return new Response(JSON.stringify({ error: '处理请求失败', details: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
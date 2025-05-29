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
        console.log('[aihubmix-native-trigger] 📋 请求参数:', {
            action: requestBody.action,
            hasImage: !!requestBody.image_base64,
            promptLength: requestBody.prompt?.length || 0,
            n: requestBody.n,
            size: requestBody.size
        });
    } catch (error) {
        console.error('[aihubmix-native-trigger] Invalid JSON body:', error.message);
        return new Response(JSON.stringify({ error: '无效的JSON请求体', details: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const { 
        action = 'edit',    // 新增：操作类型，'edit' 或 'generate'
        image_base64,       // 图片编辑时需要
        prompt: userPrompt, // 提示词
        n = 1,              // 生成图片数量
        size = "1024x1024", // 图片尺寸
        quality = "standard", // 图片质量
        style = "vivid"     // 图片风格
    } = requestBody;

    // 验证参数
    if (action === 'edit') {
        if (!image_base64) {
            console.error('[aihubmix-native-trigger] ❌ 图片编辑模式缺少image_base64参数');
            return new Response(JSON.stringify({ error: '图片编辑模式需要提供图像Base64编码 (image_base64)' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    } else if (action === 'generate') {
        if (!userPrompt) {
            console.error('[aihubmix-native-trigger] ❌ 图片生成模式缺少prompt参数');
            return new Response(JSON.stringify({ error: '图片生成模式需要提供提示词 (prompt)' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    } else {
        console.error('[aihubmix-native-trigger] ❌ 不支持的操作类型:', action);
        return new Response(JSON.stringify({ error: '不支持的操作类型，请使用 "edit" 或 "generate"' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    const taskId = uuidv4();
    console.log(`[aihubmix-native-trigger] 🆕 创建任务: ${taskId}, 操作类型: ${action}`);
    
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
        // 根据操作类型构建任务数据
        const baseTaskData = {
            taskId,
            action,
            prompt: userPrompt,
            n: parseInt(n, 10),
            size: size,
            status: 'pending',
            submittedAt: new Date().toISOString()
        };

        let taskData;
        if (action === 'edit') {
            taskData = {
                ...baseTaskData,
                image_base64, // 图片编辑需要原图
                prompt: userPrompt || "Remove the background, making it transparent. Keep the main subject clear and high quality."
            };
        } else if (action === 'generate') {
            taskData = {
                ...baseTaskData,
                quality,
                style
            };
        }

        await store.setJSON(taskId, taskData);
        console.log(`[aihubmix-native-trigger] ✅ 任务 ${taskId} 已存储到Blobs，状态: pending`);

        // 使用更可靠的方式调用background函数
        const backgroundFunctionURL = `${siteURL}/.netlify/functions/aihubmix-process-background`;
        
        console.log(`[aihubmix-native-trigger] 🚀 调用后台函数: ${backgroundFunctionURL}, 任务: ${taskId}`);

        // 同步调用后台函数，确保调用成功
        try {
            const backgroundResponse = await fetch(backgroundFunctionURL, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'Netlify-Function-Internal'
                },
                body: JSON.stringify({ taskId }),
                timeout: 5000 // 5秒超时
            });

            console.log(`[aihubmix-native-trigger] 📡 后台函数响应状态: ${backgroundResponse.status}, 任务: ${taskId}`);
            
            if (!backgroundResponse.ok) {
                const errorText = await backgroundResponse.text().catch(() => 'Unable to read error response');
                console.error(`[aihubmix-native-trigger] ❌ 后台函数调用失败，任务: ${taskId}, 状态: ${backgroundResponse.status}, 响应: ${errorText}`);
                
                // 更新任务状态为失败
                await store.setJSON(taskId, { 
                    ...taskData, 
                    status: 'trigger_failed', 
                    error: `Background invocation failed with status ${backgroundResponse.status}: ${errorText}`,
                    failedAt: new Date().toISOString()
                });
                
                return new Response(JSON.stringify({ 
                    success: false,
                    error: '后台处理启动失败',
                    details: errorText
                }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } else {
                console.log(`[aihubmix-native-trigger] ✅ 成功调用后台函数，任务: ${taskId}`);
            }
            
        } catch (fetchError) {
            console.error(`[aihubmix-native-trigger] ❌ 网络错误，任务: ${taskId}:`, fetchError);
            
            // 更新任务状态为失败
            await store.setJSON(taskId, { 
                ...taskData, 
                status: 'trigger_failed', 
                error: `Background invocation network error: ${fetchError.message}`,
                failedAt: new Date().toISOString()
            });
            
            return new Response(JSON.stringify({ 
                success: false,
                error: '后台处理网络错误',
                details: fetchError.message
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ 
            success: true, 
            taskId: taskId,
            action: action,
            status: 'pending',
            message: `${action === 'generate' ? '图片生成' : '图片编辑'}任务已提交处理，请稍后查询状态。`
        }), {
            status: 202, // Accepted for processing
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`[aihubmix-native-trigger] ❌ 处理请求失败，任务: ${taskId}:`, error);
        // If task creation failed before even invoking background, update blob for taskId if possible
        if (taskId) {
            try {
                await store.setJSON(taskId, {
                    taskId,
                    action,
                    status: 'failed',
                    error: `Trigger function error: ${error.message}`,
                    failedAt: new Date().toISOString()
                });
            } catch (blobError) {
                console.error(`[aihubmix-native-trigger] ❌ 更新失败任务状态出错:`, blobError);
            }
        }
        return new Response(JSON.stringify({ error: '处理请求失败', details: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
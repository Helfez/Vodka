// netlify/functions/aihubmix-status.js
import { getStore } from '@netlify/blobs';

export default async (request, context) => {
    console.log('[aihubmix-status] 状态查询请求，方法:', request.method);
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (request.method === 'OPTIONS') {
        return new Response('', {
            status: 200,
            headers: corsHeaders
        });
    }

    let taskId;
    
    // 支持GET和POST两种方式获取taskId
    if (request.method === 'GET') {
        const url = new URL(request.url);
        taskId = url.searchParams.get('taskId');
    } else if (request.method === 'POST') {
        try {
            const bodyText = await request.text();
            const requestBody = JSON.parse(bodyText);
            taskId = requestBody.taskId;
        } catch (error) {
            console.error('[aihubmix-status] 解析POST请求体失败:', error);
            return new Response(JSON.stringify({ error: '无效的JSON请求体' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    if (!taskId) {
        console.error('[aihubmix-status] 缺少taskId参数');
        return new Response(JSON.stringify({ error: 'taskId参数是必需的' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`[aihubmix-status] 查询任务状态: ${taskId}`);

    // 在 Functions v2 中，Netlify Blobs 应该自动工作
    let store;
    try {
        store = getStore('aihubmix_tasks'); // 首先尝试不带参数
    } catch (error) {
        console.log('[aihubmix-status] Fallback to manual siteID/token configuration');
        store = getStore('aihubmix_tasks', {
            siteID: process.env.NETLIFY_SITE_ID || context.site?.id,
            token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
        }); // 手动提供 siteID 和 token
    }

    try {
        const taskData = await store.get(taskId, { type: 'json' });
        if (!taskData) {
            console.warn(`[aihubmix-status] 任务未找到: ${taskId}`);
            return new Response(JSON.stringify({ 
                error: '任务未找到或仍在初始创建中',
                status: 'not_found',
                taskId: taskId
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        console.log(`[aihubmix-status] 任务状态: ${taskData.status}, ID: ${taskId}`);
        
        return new Response(JSON.stringify(taskData), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error(`[aihubmix-status] 获取任务状态失败，ID: ${taskId}:`, error);
        return new Response(JSON.stringify({ 
            error: '获取任务状态失败', 
            details: error.message,
            taskId: taskId
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};

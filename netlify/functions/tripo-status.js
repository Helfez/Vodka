import { getStore } from '@netlify/blobs';

export default async (request, context) => {
    console.log('[tripo-status] === Tripo状态查询函数启动 ===');
    
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

    let requestBody;
    try {
        const bodyText = await request.text();
        requestBody = JSON.parse(bodyText);
    } catch (error) {
        console.error('[tripo-status] Invalid JSON body:', error.message);
        return new Response(JSON.stringify({ error: '无效的JSON请求体' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const { taskId } = requestBody;

    if (!taskId) {
        return new Response(JSON.stringify({ error: '缺少taskId参数' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`[tripo-status] 🔍 查询任务状态: ${taskId}`);

    let store;
    try {
        store = getStore('tripo-tasks');
    } catch (error) {
        console.error('[tripo-status] ❌ Netlify Blobs store 初始化失败:', error.message);
        return new Response(JSON.stringify({ error: 'Blob存储初始化失败' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const taskData = await store.get(taskId, { type: 'json' });
        
        if (!taskData) {
            console.error(`[tripo-status] ❌ 任务 ${taskId} 不存在`);
            return new Response(JSON.stringify({ error: '任务不存在' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[tripo-status] 📋 任务 ${taskId} 状态: ${taskData.status}`);

        // 根据任务状态返回相应信息
        const response = {
            taskId,
            status: taskData.status,
            createdAt: taskData.createdAt
        };

        if (taskData.status === 'completed') {
            response.modelUrl = taskData.modelUrl;
            response.thumbnailUrl = taskData.thumbnailUrl;
            response.format = taskData.format;
            response.fileSize = taskData.fileSize;
            response.completedAt = taskData.completedAt;
        } else if (taskData.status === 'failed') {
            response.error = taskData.error;
            response.failedAt = taskData.failedAt;
        } else if (taskData.status === 'processing') {
            response.startedAt = taskData.startedAt;
            response.progress = taskData.progress;
        }

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`[tripo-status] ❌ 查询任务状态失败:`, error.message);
        return new Response(JSON.stringify({ error: '查询任务状态失败', details: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}; 
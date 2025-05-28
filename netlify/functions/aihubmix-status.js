// netlify/functions/aihubmix-status.js
import { getStore } from '@netlify/blobs';

export default async (event, context) => {
    const taskId = event.queryStringParameters?.taskId;

    if (!taskId) {
        return new Response(JSON.stringify({ error: 'taskId query parameter is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 在 Functions v2 中，Netlify Blobs 应该自动工作，但如果不行，我们提供备用参数
    let store;
    try {
        store = getStore('aihubmix_tasks'); // 首先尝试不带参数
    } catch (error) {
        console.log('[aihubmix-status] Fallback to manual siteID/token configuration');
        store = getStore('aihubmix_tasks', {
            siteID: process.env.NETLIFY_SITE_ID || context.clientContext?.site?.id,
            token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
        }); // 手动提供 siteID 和 token
    }

    try {
        const taskData = await store.get(taskId, { type: 'json' });
        if (!taskData) {
            return new Response(JSON.stringify({ error: 'Task not found or still pending initial creation' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response(JSON.stringify(taskData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error(`[aihubmix-status] Error fetching status for taskId ${taskId}:`, error);
        return new Response(JSON.stringify({ error: 'Failed to retrieve task status', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

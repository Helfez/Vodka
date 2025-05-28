// netlify/functions/aihubmix-status.js
const { getBlobStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
    const taskId = event.queryStringParameters.taskId;

    if (!taskId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'taskId query parameter is required' }),
        };
    }

    const store = getBlobStore('aihubmix_tasks');

    try {
        const taskData = await store.get(taskId, { type: 'json' });
        if (!taskData) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Task not found or still pending initial creation' }),
            };
        }
        return {
            statusCode: 200,
            body: JSON.stringify(taskData),
        };
    } catch (error) {
        console.error(`[aihubmix-status] Error fetching status for taskId ${taskId}:`, error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to retrieve task status', details: error.message }),
        };
    }
};

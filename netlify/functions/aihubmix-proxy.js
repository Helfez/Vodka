const axios = require('axios');
const FormData = require('form-data');
const { Buffer } = require('buffer'); // 引入 Buffer

// Simplified handler for testing POST requests
exports.handler = async function(event, context) {
    console.log('[TEST HANDLER] Received event:', JSON.stringify(event, null, 2)); // Log the event for debugging
    if (event.httpMethod === 'POST') {
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "POST request received successfully by test proxy handler!" })
        };
    }
    // For any other method, like GET from browser test
    return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Method Not Allowed. This test handler primarily expects POST." })
    };
};

/* Original Handler - Commented out for testing
exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { imageData, fileName } = JSON.parse(event.body);
        const apiKey = process.env.REACT_APP_AIHUBMIX_API_KEY; // 从 Netlify 环境变量获取 API Key

        if (!apiKey) {
            console.error('Aihubmix API key 未在环境变量中设置。');
            return { statusCode: 500, body: JSON.stringify({ error: 'API key 未配置。' }) };
        }
        if (!imageData || !fileName) {
            return { statusCode: 400, body: JSON.stringify({ error: '请求体中缺少 imageData 或 fileName。' }) };
        }

        // 将 base64 编码的 imageData (例如 "data:image/png;base64,iVBORw0KGgo...") 转换为 Buffer
        const base64Data = imageData.split(';base64,').pop();
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const formData = new FormData();
        formData.append('image', imageBuffer, { filename: fileName });
        formData.append('output_format', 'url'); // 或者 'base64' 如果您希望直接获取图片的 base64 数据

        const response = await axios.post('https://aihubmix.com/api/v1/ai/replace-background', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
            },
            timeout: 30000, // 30 秒超时
        });
        
        console.log('Aihubmix 原始响应状态:', response.status);
        console.log('Aihubmix 原始响应数据:', JSON.stringify(response.data, null, 2));

        if (response.data && response.data.data && response.data.data[0] && response.data.data[0].url) {
             return {
                statusCode: 200,
                body: JSON.stringify(response.data), // 将 Aihubmix 的完整响应数据转发给前端
            };
        } else {
            console.error('来自 Aihubmix 的响应结构异常:', response.data);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Aihubmix API 响应结构异常。', details: response.data }),
            };
        }
    } catch (error) {
        console.error('aihubmix-proxy 云函数内部错误:', error.message);
        console.error('错误详情:', error.stack);
        // 如果错误是 axios 错误，尝试记录更多信息
        if (error.response) {
            console.error('Axios 错误响应数据:', error.response.data);
            console.error('Axios 错误响应状态:', error.response.status);
            console.error('Axios 错误响应头:', error.response.headers);
        } else if (error.request) {
            console.error('Axios 请求已发出但无响应:', error.request);
        } else {
            console.error('Axios 配置错误或未知错误:', error.message);
        }
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '代理服务内部错误。', details: error.message }),
        };
    }
}; 
*/

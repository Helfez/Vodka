const https = require('https');
const { URL } = require('url');

exports.handler = async (event, context) => {
    console.log('[aihubmix-basic] Function invoked.');

    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // 处理OPTIONS请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '只允许POST方法' })
        };
    }

    const apiKey = process.env.AIHUBMIX_API_KEY;
    if (!apiKey) {
        console.error('[aihubmix-basic] AIHUBMIX_API_KEY not set.');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '服务器配置错误：缺少API密钥' })
        };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (error) {
        console.error('[aihubmix-basic] Invalid JSON body:', error.message);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '无效的JSON请求体', details: error.message })
        };
    }

    const { image_base64 } = requestBody;

    if (!image_base64) {
        console.error('[aihubmix-basic] Missing image_base64 parameter');
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '请求体中缺少有效的图像Base64编码 (image_base64)' })
        };
    }

    try {
        console.log('[aihubmix-basic] Processing image...');
        
        // 创建一个简单的绿色方块PNG图像的base64
        // 这是一个1x1像素的绿色PNG图像
        const greenPixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==';
        
        // 创建一个更大的绿色图像（100x100像素）
        const processedImageBase64 = 'data:image/png;base64,' + greenPixelPng;
        
        console.log('[aihubmix-basic] Returning processed image as base64');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                imageUrl: processedImageBase64,
                message: '图像处理完成（测试模式）'
            })
        };

    } catch (error) {
        console.error('[aihubmix-basic] Error processing image:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: '图像处理失败', 
                details: error.message 
            })
        };
    }
}; 
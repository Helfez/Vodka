const axios = require('axios');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const imageUrl = event.queryStringParameters.url;

    if (!imageUrl) {
        return { statusCode: 400, body: 'Missing image URL parameter.' };
    }

    try {
        // 验证 URL 是否是来自 ideogram.ai，增加安全性
        const parsedUrl = new URL(imageUrl);
        if (parsedUrl.hostname !== 'ideogram.ai' && !parsedUrl.hostname.endsWith('.ideogram.ai')) {
             // 如果您发现 ideogram.ai 使用其他子域名，可以在这里添加
            console.warn('Attempt to proxy non-ideogram.ai URL:', imageUrl);
            return { statusCode: 403, body: 'Forbidden: Only ideogram.ai URLs are allowed.' };
        }

        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer', // 重要：获取图片数据为二进制数组
            timeout: 20000, // 20秒超时
        });

        // 从原始响应中获取 Content-Type
        const contentType = response.headers['content-type'] || 'image/png'; // 默认为 image/png

        return {
            statusCode: 200,
            headers: {
                'Content-Type': contentType,
                // 可以考虑添加 Cache-Control 头，如果图片不经常变化
                // 'Cache-Control': 'public, max-age=86400' // 缓存一天
            },
            body: Buffer.from(response.data, 'binary').toString('base64'), // 将二进制数据转为 base64 编码的字符串
            isBase64Encoded: true, // 告诉 API Gateway (Netlify Functions 底层) body 是 base64 编码的
        };

    } catch (error) {
        console.error('Error in image-proxy function:', error.message);
        if (error.response) {
            console.error('Image fetch Error Response Status:', error.response.status);
            console.error('Image fetch Error Response Data:', error.response.data);
            return {
                statusCode: error.response.status || 500,
                body: JSON.stringify({ error: 'Failed to fetch image.', details: error.message }),
            };
        }
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error in image proxy.', details: error.message }),
        };
    }
};

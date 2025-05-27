// netlify/functions/aihubmix-proxy.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    console.log('[aihubmix-proxy] Function invoked.');
    console.debug('[aihubmix-proxy] Received event:', JSON.stringify(event));
    console.debug('[aihubmix-proxy] Received headers:', JSON.stringify(event.headers));

    if (event.httpMethod !== 'POST') {
        console.warn(`[aihubmix-proxy] Invalid HTTP method: ${event.httpMethod}`);
        return {
            statusCode: 405,
            body: JSON.stringify({ error: '只允许POST方法' }),
            headers: { 'Allow': 'POST' },
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
        };
    }

    const { imageUrl } = requestBody;
    console.debug('[aihubmix-proxy] Extracted imageUrl:', imageUrl);

    if (!imageUrl || typeof imageUrl !== 'string' || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
        console.error('[aihubmix-proxy] Invalid or missing imageUrl in request body:', imageUrl);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: '请求体中缺少有效的目标图像URL (imageUrl)' }),
        };
    }

    const apiKey = process.env.AIHUBMIX_API_KEY;
    if (!apiKey) {
        console.error('[aihubmix-proxy] AIHUBMIX_API_KEY not set in environment variables.');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '服务器配置错误 (API Key missing)' }),
        };
    }

    const AIHUBMIX_API_URL = 'https://api.aihubmix.com/images/remove-background/v1';
    console.debug('[aihubmix-proxy] Aihubmix API URL:', AIHUBMIX_API_URL);
    console.log('[aihubmix-proxy] Using AIHUBMIX_API_KEY (partial):', process.env.AIHUBMIX_API_KEY ? process.env.AIHUBMIX_API_KEY.substring(0, 4) + '...' : 'Not Set');

    const apiRequestBodyForAihubmix = {
        image_url: imageUrl,
    };
    console.debug('[aihubmix-proxy] Sending to Aihubmix with body:', JSON.stringify(apiRequestBodyForAihubmix));

    try {
        const aihubmixResponse = await fetch(AIHUBMIX_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(apiRequestBodyForAihubmix),
        });

        const responseData = await aihubmixResponse.json();
        console.debug('[aihubmix-proxy] Received response from Aihubmix:', JSON.stringify(responseData));

        if (!aihubmixResponse.ok) {
            console.error(`[aihubmix-proxy] Aihubmix API error: ${aihubmixResponse.status}`, responseData);
            return {
                statusCode: aihubmixResponse.status,
                body: JSON.stringify({ error: 'Aihubmix API处理失败', details: responseData }),
            };
        }
        
        const processedImageUrl = responseData.data && responseData.data[0] && responseData.data[0].url;

        if (!processedImageUrl) {
            console.error('[aihubmix-proxy] Processed image URL not found in Aihubmix response:', responseData);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: '从Aihubmix API响应中未能提取处理后的图像URL', details: responseData }),
            };
        }

        console.log('[aihubmix-proxy] Successfully processed image. Returning URL:', processedImageUrl);
        return {
            statusCode: 200,
            body: JSON.stringify({ processedImageUrl: processedImageUrl }),
        };

    } catch (error) {
        console.error('[aihubmix-proxy] Error calling Aihubmix API (node-fetch):', error.name, error.message, error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '调用Aihubmix API时出错', details: error.message }),
        };
    }
};

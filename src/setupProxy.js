const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const FormData = require('form-data');
const { Buffer } = require('buffer');
const express = require('express'); // 用于解析 JSON 请求体

module.exports = function(app) {
    // 应用 express.json() 中间件来解析 POST 请求的 JSON body
    // 需要确保这个中间件在我们的自定义路由之前被应用，或者直接用在路由上

    // 模拟 aihubmix-proxy Netlify function
    app.post('/.netlify/functions/aihubmix-proxy', express.json(), async (req, res) => {
        console.log('[setupProxy] Received request for /aihubmix-proxy with body:', req.body);
        try {
            const { imageData, fileName } = req.body; // imageData 应该是 base64 字符串
            const apiKey = process.env.REACT_APP_AIHUBMIX_API_KEY;

            if (!apiKey) {
                console.error('[setupProxy] Aihubmix API key (REACT_APP_AIHUBMIX_API_KEY) is not set in environment variables.');
                return res.status(500).json({ error: 'API key not configured for local proxy.' });
            }
            if (!imageData || !fileName) {
                console.error('[setupProxy] Missing imageData or fileName in request to /aihubmix-proxy.');
                return res.status(400).json({ error: 'Missing imageData or fileName.' });
            }

            const base64Data = imageData.split(';base64,').pop();
            const imageBuffer = Buffer.from(base64Data, 'base64');

            const formData = new FormData();
            formData.append('image', imageBuffer, { filename: fileName });
            formData.append('output_format', 'url');

            console.log('[setupProxy] Calling Aihubmix API...');
            const aihubmixResponse = await axios.post('https://aihubmix.com/api/v1/ai/replace-background', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json',
                },
                timeout: 30000, // 30 秒超时
            });
            console.log('[setupProxy] Aihubmix API response status:', aihubmixResponse.status);
            console.log('[setupProxy] Aihubmix API response data:', aihubmixResponse.data);
            res.status(aihubmixResponse.status).json(aihubmixResponse.data);

        } catch (error) {
            console.error('[setupProxy] Error in /.netlify/functions/aihubmix-proxy simulation:', error.message);
            if (error.response) {
                console.error('[setupProxy] Aihubmix API error response status:', error.response.status);
                console.error('[setupProxy] Aihubmix API error response data:', error.response.data);
                res.status(error.response.status).json(error.response.data || { error: 'Aihubmix API error' });
            } else {
                res.status(500).json({ error: 'Local proxy internal server error while calling Aihubmix.' });
            }
        }
    });

    // 模拟 image-proxy Netlify function
    app.get('/.netlify/functions/image-proxy', async (req, res) => {
        const imageUrl = req.query.url;
        console.log('[setupProxy] Received request for /image-proxy with URL:', imageUrl);

        if (!imageUrl) {
            console.error('[setupProxy] Missing image URL parameter for /image-proxy.');
            return res.status(400).send('Missing image URL parameter.');
        }

        try {
            const parsedUrl = new URL(imageUrl);
            // 增加对 ideogram.ai 子域名的支持，例如 cdn.ideogram.ai
            if (parsedUrl.hostname !== 'ideogram.ai' && !parsedUrl.hostname.endsWith('.ideogram.ai')) {
                console.warn('[setupProxy] Attempt to proxy non-ideogram.ai URL:', imageUrl);
                return res.status(403).send('Forbidden: Only ideogram.ai URLs are allowed by local proxy.');
            }
            
            console.log('[setupProxy] Fetching image from:', imageUrl);
            const imageResponse = await axios.get(imageUrl, {
                responseType: 'arraybuffer', // 获取二进制数据
                timeout: 20000, // 20秒超时
            });

            const contentType = imageResponse.headers['content-type'] || 'image/png';
            console.log('[setupProxy] Image fetched successfully, content-type:', contentType);
            res.setHeader('Content-Type', contentType);
            res.send(imageResponse.data); // 直接发送二进制数据

        } catch (error) {
            console.error('[setupProxy] Error in /.netlify/functions/image-proxy simulation:', error.message);
            if (error.response) {
                console.error('[setupProxy] Image fetch error response status:', error.response.status);
                console.error('[setupProxy] Image fetch error response data (if any):', error.response.data ? error.response.data.toString().slice(0, 100) : 'N/A');
                res.status(error.response.status).send(error.response.data || 'Error fetching image');
            } else {
                res.status(500).send('Local proxy internal server error while fetching image.');
            }
        }
    });

    // 如果您有其他代理规则，可以放在这里。
    // 之前用于 ideogram.ai 的 '/ideogram-image-proxy' 规则现在被上面的 '/.netlify/functions/image-proxy' 替代了。
};

const fetch = require('node-fetch');
const FormData = require('form-data');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

exports.handler = async (event, context) => {
    console.log('[aihubmix-simple] Function invoked.');

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: '只允许POST方法' }),
            headers: { 
                'Allow': 'POST',
                'Content-Type': 'application/json'
            },
        };
    }

    const apiKey = process.env.AIHUBMIX_API_KEY;
    if (!apiKey) {
        console.error('[aihubmix-simple] AIHUBMIX_API_KEY not set.');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '服务器配置错误：缺少API密钥' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (error) {
        console.error('[aihubmix-simple] Invalid JSON body:', error.message);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: '无效的JSON请求体', details: error.message }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    const { image_base64, prompt: userPrompt, size = "1024x1024", n = 1 } = requestBody;

    if (!image_base64) {
        console.error('[aihubmix-simple] Missing image_base64 parameter');
        return {
            statusCode: 400,
            body: JSON.stringify({ error: '请求体中缺少有效的图像Base64编码 (image_base64)' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        console.log('[aihubmix-simple] Processing image with Aihubmix...');
        
        // Convert Base64 to Buffer
        const imageBuffer = Buffer.from(image_base64, 'base64');

        // Create FormData instance
        const form = new FormData();
        form.append('image', imageBuffer, { 
            filename: 'input_image.png', 
            contentType: 'image/png' 
        });
        form.append('model', 'gpt-image-1');
        form.append('prompt', userPrompt || "Remove the background, making it transparent. Keep the main subject clear and high quality.");
        form.append('n', n.toString());
        form.append('size', size);

        const apiUrl = 'https://aihubmix.com/v1/images/edits';
        
        console.log('[aihubmix-simple] Sending request to Aihubmix API...');
        
        const aihubmixResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                ...form.getHeaders(),
            },
            body: form,
            timeout: 25000 // 25 seconds timeout (within Netlify's 30s limit)
        });

        if (!aihubmixResponse.ok) {
            const errorBody = await aihubmixResponse.text();
            console.error('[aihubmix-simple] Aihubmix API Error:', aihubmixResponse.status, errorBody);
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    error: `Aihubmix API错误: ${aihubmixResponse.status}`,
                    details: errorBody
                }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        const aihubmixData = await aihubmixResponse.json();
        console.log('[aihubmix-simple] Aihubmix response received.');
        
        if (!aihubmixData || !aihubmixData.data || !aihubmixData.data[0] || !aihubmixData.data[0].b64_json) {
            console.error('[aihubmix-simple] Invalid response structure from Aihubmix:', aihubmixData);
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    error: 'Aihubmix API返回了无效的响应格式'
                }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        const processedImageBase64 = aihubmixData.data[0].b64_json;
        console.log('[aihubmix-simple] Image processed by Aihubmix. Uploading to Cloudinary...');

        const cloudinaryUploadResponse = await cloudinary.uploader.upload(`data:image/png;base64,${processedImageBase64}`, {
            folder: 'aihubmix_processed',
            resource_type: 'image',
            timeout: 10000 // 10 seconds timeout for upload
        });

        console.log('[aihubmix-simple] Image uploaded to Cloudinary:', cloudinaryUploadResponse.secure_url);

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true,
                imageUrl: cloudinaryUploadResponse.secure_url,
                message: '图像处理完成'
            }),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        console.error('[aihubmix-simple] Error processing image:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: '图像处理失败', 
                details: error.message 
            }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
}; 
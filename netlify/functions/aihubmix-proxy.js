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

    // Check for Cloudinary config first
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.error('[aihubmix-proxy] Cloudinary environment variables not fully configured.');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Cloudinary configuration missing on server.' }),
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

    const { image_base64, prompt: userPrompt, size = "1024x1024", n = 1 } = requestBody;

    if (!image_base64) {
        console.error('[aihubmix-proxy] Missing image_base64 parameter');
        return {
            statusCode: 400,
            body: JSON.stringify({ error: '请求体中缺少有效的图像Base64编码 (image_base64)' }),
        };
    }

    try {
        // Convert Base64 to Buffer
        const imageBuffer = Buffer.from(image_base64, 'base64');

        const form = new FormData();
        form.append('image', imageBuffer, { filename: 'input_image.png', contentType: 'image/png' }); // Assuming PNG, adjust if needed
        form.append('model', 'gpt-image-1');
        // Use a specific prompt for background removal, or allow user to pass one
        form.append('prompt', userPrompt || "Remove the background, making it transparent. Keep the main subject clear and high quality.");
        form.append('n', n.toString());
        form.append('size', size);
        form.append('response_format', 'b64_json');

        const apiUrl = 'https://aihubmix.com/v1/images/edits';

        console.log(`[aihubmix-proxy] Calling Aihubmix API: ${apiUrl} with model gpt-image-1 (edits)`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                ...form.getHeaders(), // Important: form-data sets the Content-Type with boundary
            },
            body: form,
        });

        const responseText = await response.text(); // Get raw text first for better error diagnosis

        if (!response.ok) {
            console.error(`[aihubmix-proxy] Aihubmix API Error: ${response.status} ${response.statusText}`, responseText);
            let errorDetails = responseText;
            try {
                errorDetails = JSON.parse(responseText); // Try to parse if it's JSON
            } catch (e) { /* Ignore if not JSON */ }
            return {
                statusCode: response.status,
                body: JSON.stringify({ 
                    error: 'Aihubmix API处理失败', 
                    status: response.status,
                    details: errorDetails 
                }),
            };
        }

        const data = JSON.parse(responseText); // Now parse as JSON

        // Assuming the response structure is similar to OpenAI's DALL-E API for edits
        // which returns an array of objects, each with a b64_json property.
        if (data.data && data.data.length > 0 && data.data[0].b64_json) {
            console.log('[aihubmix-proxy] Successfully processed image with gpt-image-1 (edits).');
        } else {
            console.error('[aihubmix-proxy] Unexpected response structure from Aihubmix (edits):', data);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: '从Aihubmix API响应中未能提取处理后的图像Base64编码', details: data }),
            };
        }

        const processedBase64FromAihubmix = data.data[0].b64_json;

        console.log('[aihubmix-proxy] Successfully processed image with gpt-image-1 (edits). Now uploading to Cloudinary.');

        // Upload to Cloudinary
        const cloudinaryUploadResponse = await cloudinary.uploader.upload(
            `data:image/png;base64,${processedBase64FromAihubmix}`,
            {
                folder: "whiteboard_app_processed_images", // Optional: specify a folder in Cloudinary
                resource_type: "image"
            }
        );

        console.log('[aihubmix-proxy] Successfully uploaded to Cloudinary.');

        return {
            statusCode: 200,
            body: JSON.stringify({ processedImageUrl: cloudinaryUploadResponse.secure_url }), // Return Cloudinary URL
        };

    } catch (error) {
        console.error('[aihubmix-proxy] Error calling Aihubmix API (node-fetch/form-data):', error.name, error.message, error.stack);
        // Check if the error is from Cloudinary or Aihubmix based on its properties or message
        let errorSource = 'Aihubmix or Form-Data';
        if (error.http_code && error.message && error.message.includes('Cloudinary')) { // Basic check for Cloudinary error structure
            errorSource = 'Cloudinary';
        }
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `调用 ${errorSource} API 时出错`, details: error.message, error_obj: error }),
        };
    }
};
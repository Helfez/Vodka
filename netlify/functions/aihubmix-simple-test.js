// netlify/functions/aihubmix-simple-test.js
// 简化版本的抠图函数，用于调试
import { OpenAI, toFile } from 'openai';
import cloudinary from 'cloudinary';

const cloudinaryV2 = cloudinary.v2;

cloudinaryV2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

const openai = new OpenAI({
    apiKey: process.env.AIHUBMIX_API_KEY,
    baseURL: 'https://aihubmix.com/v1',
});

export default async (request, context) => {
    console.log('[aihubmix-simple-test] Function invoked.');
    
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

    try {
        // 检查环境变量
        console.log('[aihubmix-simple-test] Checking environment variables...');
        const requiredEnvVars = ['AIHUBMIX_API_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.error('[aihubmix-simple-test] Missing environment variables:', missingVars);
            return new Response(JSON.stringify({ 
                error: '环境变量配置不完整', 
                missing: missingVars 
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const bodyText = await request.text();
        const requestBody = JSON.parse(bodyText);
        const { image_base64, prompt } = requestBody;

        if (!image_base64) {
            console.error('[aihubmix-simple-test] Missing image_base64 parameter');
            return new Response(JSON.stringify({ error: '缺少图像数据' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('[aihubmix-simple-test] Processing image...');
        
        // 转换图像
        const imageBuffer = Buffer.from(image_base64, 'base64');
        const imageFileUploadable = await toFile(imageBuffer, 'input_image.png', {
            type: 'image/png',
        });

        // 调用AIhubmix API
        const userPrompt = prompt || "redesign poster of the movie [Black Swan], 3D cartoon, smooth render, bright tone, 2:3 portrait.";
        
        console.log('[aihubmix-simple-test] Calling AIhubmix API...');
        const aihubmixResponse = await openai.images.edit({
            model: "gpt-image-1",
            image: imageFileUploadable,
            prompt: userPrompt,
            n: 1,
            size: "1024x1024",
            quality: "high"
        });

        console.log('[aihubmix-simple-test] AIhubmix response received');

        if (!aihubmixResponse || !aihubmixResponse.data || !aihubmixResponse.data[0]) {
            console.error('[aihubmix-simple-test] Invalid AIhubmix response');
            return new Response(JSON.stringify({ error: 'AIhubmix API响应无效' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const responseData = aihubmixResponse.data[0];
        let imageUrl;

        if (responseData.url) {
            imageUrl = responseData.url;
            console.log('[aihubmix-simple-test] Received image URL:', imageUrl);
        } else if (responseData.b64_json) {
            console.log('[aihubmix-simple-test] Uploading to Cloudinary...');
            const cloudinaryUploadResponse = await cloudinaryV2.uploader.upload(`data:image/png;base64,${responseData.b64_json}`, {
                folder: 'aihubmix_processed',
                resource_type: 'image',
                timeout: 60000
            });
            imageUrl = cloudinaryUploadResponse.secure_url;
            console.log('[aihubmix-simple-test] Cloudinary upload successful:', imageUrl);
        } else {
            console.error('[aihubmix-simple-test] No valid image data in response');
            return new Response(JSON.stringify({ error: '响应中没有有效的图像数据' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ 
            success: true, 
            imageUrl: imageUrl,
            message: '图像处理成功'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[aihubmix-simple-test] Error:', error);
        return new Response(JSON.stringify({ 
            error: '处理失败', 
            details: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}; 
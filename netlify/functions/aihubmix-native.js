const OpenAI = require('openai');

exports.handler = async (event, context) => {
    console.log('[aihubmix-native-sdk] Function invoked.');

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: '只允许POST方法' })
        };
    }

    const apiKey = process.env.AIHUBMIX_API_KEY;
    if (!apiKey) {
        console.error('[aihubmix-native-sdk] AIHUBMIX_API_KEY not set.');
        return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: '服务器配置错误：缺少API密钥' })
        };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (error) {
        console.error('[aihubmix-native-sdk] Invalid JSON body:', error.message);
        return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: '无效的JSON请求体', details: error.message })
        };
    }

    const { 
        image_base64, 
        prompt: userPrompt, 
        size = "1024x1536",
        n = 2
    } = requestBody;

    if (!image_base64) {
        console.error('[aihubmix-native-sdk] Missing image_base64 parameter');
        return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: '请求体中缺少有效的图像Base64编码 (image_base64)' })
        };
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://aihubmix.com/v1',
    });

    try {
        console.log('[aihubmix-native-sdk] Processing image with OpenAI SDK via AIhubmix...');

        // 将base64字符串转换为Node.js Buffer，然后模拟文件上传
        // OpenAI Node SDK v4+ 需要文件作为 ReadableStream 或特定对象
        // 最简单的方式可能是将base64转为Buffer，然后用它创建一个可读流，
        // 或者利用一些辅助库。但对于 images.edit, 它期望的是一个文件路径或Node.js的fs.ReadStream
        // 直接传递 base64 字符串给 `image` 参数是 DALL-E 2 (旧版) 的做法，且通常用于API Playground。
        // 对于 Node.js SDK, `image` 参数期望的是一个 `fs.ReadStream` 或等效的对象。
        // 然而，AIhubmix的Python示例是 `image=open("path", "rb")`
        // 它的Node.js SDK的对应方法需要一个可以被读取的对象。

        // 重要的更正：OpenAI Node.js SDK 的 `images.edit` 方法期望 `image` 参数是一个
        // `Uploadable` 类型，它可以是 `NodeJS.ReadableStream`, `File`, `RequestData` 等。
        // 将 Base64 字符串转换为一个可供 SDK 使用的 "文件"表示的最直接方式是将其转换为 Buffer，
        // 并模拟一个文件对象。

        const imageBuffer = Buffer.from(image_base64, 'base64');
        
        // 为了让OpenAI SDK正确处理，我们需要将Buffer包装成一个它能识别的文件状对象。
        // SDK内部会处理成multipart/form-data。
        // 创建一个足够像文件的对象，包含buffer和文件名
        const imageFile = {
            file: imageBuffer,
            name: 'image.png', // SDK需要一个文件名来正确构建form-data
        };

        console.log(`[aihubmix-native-sdk] Calling AIhubmix images.edit with model gpt-image-1`);
        const response = await openai.images.edit({
            model: "gpt-image-1",
            image: imageFile, // 将Buffer包装后传递
            prompt: userPrompt || "redesign poster of the movie [Black Swan], 3D cartoon, smooth render, bright tone, 2:3 portrait.",
            n: parseInt(n, 10),
            size: size,
            quality: "high",
            response_format: 'b64_json' // AIhubmix 示例显示返回 b64_json
        });

        console.log('[aihubmix-native-sdk] AIhubmix response received.');

        if (!response || !response.data || !response.data[0]) {
            console.error('[aihubmix-native-sdk] Invalid response structure from AIhubmix:', response);
            return {
                statusCode: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'AIhubmix API返回了无效的响应格式' })
            };
        }

        const imageData = response.data[0];
        let imageUrl = null;

        if (imageData.b64_json) {
            imageUrl = `data:image/png;base64,${imageData.b64_json}`;
            console.log('[aihubmix-native-sdk] Image processed successfully with base64 data');
        } else if (imageData.url) {
            imageUrl = imageData.url;
            console.log('[aihubmix-native-sdk] Image processed successfully with URL:', imageData.url);
        } else {
            console.log('[aihubmix-native-sdk] No image data found in response');
            return {
                statusCode: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: '未能生成处理后的图像',
                    details: '响应中没有图像数据',
                    fullResponse: response
                })
            };
        }

        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true,
                imageUrl: imageUrl,
                message: '图像处理完成'
            })
        };

    } catch (error) {
        console.error('[aihubmix-native-sdk] Error processing image:', error.message);
        let errorStatus = 500;
        let errorDetails = error.message;
        if (error.response) {
            console.error('Error Response Body:', error.response.data);
            errorStatus = error.response.status || 500;
            errorDetails = error.response.data || error.message;
        }
        return {
            statusCode: errorStatus,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: '图像处理失败',
                details: errorDetails,
                errorName: error.name
            })
        };
    }
}; 
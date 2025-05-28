const { OpenAI, toFile } = require('openai');

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
        const imageBuffer = Buffer.from(image_base64, 'base64');
        
        // 使用 toFile 辅助函数创建 Uploadable 对象
        const imageFileUploadable = await toFile(imageBuffer, 'image.png', {
            type: 'image/png', // 明确指定MIME类型
        });

        console.log(`[aihubmix-native-sdk] Calling AIhubmix images.edit with model gpt-image-1`);
        const response = await openai.images.edit({
            model: "gpt-image-1",
            image: imageFileUploadable, // 将 toFile的结果 传递
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
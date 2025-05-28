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

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://aihubmix.com/v1',
    });

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

    const { image_base64 } = requestBody;
    if (!image_base64) {
        console.error('[aihubmix-native-sdk] Missing image_base64 parameter');
        return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: '请求体中缺少有效的图像Base64编码 (image_base64)' })
        };
    }

    try {
        console.log('[aihubmix-native-sdk] Processing image with STRICTLY hardcoded parameters...');

        const imageBuffer = Buffer.from(image_base64, 'base64');
        const imageFileUploadable = await toFile(imageBuffer, 'image.png', {
            type: 'image/png',
        });

        const model = "gpt-image-1";
        const prompt = "redesign poster of the movie [Black Swan], 3D cartoon, smooth render, bright tone, 2:3 portrait.";
        const n = 2;
        const size = "1024x1536";
        const quality = "high";

        console.log(`[aihubmix-native-sdk] Calling AIhubmix images.edit with fixed params: model=${model}, n=${n}, size=${size}, quality=${quality}`);

        const response = await openai.images.edit({
            model: model,
            image: imageFileUploadable,
            prompt: prompt,
            n: n,
            size: size,
            quality: quality
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

        const imageDataItem = response.data[0];
        let resultOutput = {};

        if (imageDataItem.b64_json) {
            resultOutput.imageUrl = `data:image/png;base64,${imageDataItem.b64_json}`;
            console.log('[aihubmix-native-sdk] Image processed successfully with base64 data from item.');
        } else if (imageDataItem.url) {
            resultOutput.imageUrl = imageDataItem.url;
            console.log('[aihubmix-native-sdk] Image processed successfully with URL from item:', imageDataItem.url);
        } else {
            console.log('[aihubmix-native-sdk] No b64_json or url found in the first image data item:', imageDataItem);
            console.log('[aihubmix-native-sdk] Full response.data:', response.data);
            return {
                statusCode: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: '未能生成处理后的图像',
                    details: '响应中没有图像数据(b64_json or url)在第一个项目中',
                    fullResponseData: response.data
                })
            };
        }

        resultOutput.allData = response.data;

        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true,
                data: response.data,
                message: '图像处理完成'
            })
        };

    } catch (error) {
        console.error('[aihubmix-native-sdk] Error processing image:', error);
        let errorStatus = 500;
        let errorBody = { 
            error: '图像处理失败',
            details: error.message,
            errorName: error.name,
            stack: error.stack
        };
        if (error.response) {
            console.error('Error Response Status:', error.response.status);
            console.error('Error Response Data:', error.response.data);
            errorStatus = error.response.status || 500;
            if (error.response.data && typeof error.response.data === 'object') {
                errorBody.details = error.response.data.error || error.response.data;
            } else {
                errorBody.details = error.response.data || error.message;
            }
        } else if (error.message && error.message.includes('multipart: message too large')) {
            errorBody.details = error.message;
        }
        
        return {
            statusCode: errorStatus,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(errorBody)
        };
    }
}; 
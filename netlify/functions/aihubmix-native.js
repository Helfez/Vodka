const https = require('https');
const { URL } = require('url');

// 辅助函数：发送HTTPS请求
function httpsRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: responseData
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(25000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        if (data) {
            req.write(data);
        }
        
        req.end();
    });
}

exports.handler = async (event, context) => {
    console.log('[aihubmix-native] Function invoked.');

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
        console.error('[aihubmix-native] AIHUBMIX_API_KEY not set.');
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
        console.error('[aihubmix-native] Invalid JSON body:', error.message);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '无效的JSON请求体', details: error.message })
        };
    }

    const { image_base64, prompt: userPrompt } = requestBody;

    if (!image_base64) {
        console.error('[aihubmix-native] Missing image_base64 parameter');
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '请求体中缺少有效的图像Base64编码 (image_base64)' })
        };
    }

    try {
        console.log('[aihubmix-native] Processing image with Aihubmix Responses API...');
        
        // 构建Responses API请求体
        const apiRequestBody = {
            model: "gpt-4o-mini",
            input: [
                {
                    type: "text",
                    text: userPrompt || "Remove the background from this image, making it transparent. Keep the main subject clear and high quality."
                },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:image/png;base64,${image_base64}`
                    }
                }
            ]
        };
        
        const requestData = JSON.stringify(apiRequestBody);
        console.log('[aihubmix-native] Request data size:', requestData.length);
        
        // 设置请求选项 - 使用Responses API端点
        const requestOptions = {
            hostname: 'aihubmix.com',
            port: 443,
            path: '/v1/responses',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            }
        };
        
        console.log('[aihubmix-native] Sending request to Aihubmix Responses API...');
        
        // 发送请求
        const response = await httpsRequest(requestOptions, requestData);
        
        console.log('[aihubmix-native] Response status:', response.statusCode);
        
        if (response.statusCode !== 200) {
            console.error('[aihubmix-native] Aihubmix API Error:', response.statusCode, response.body);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: `Aihubmix API错误: ${response.statusCode}`,
                    details: response.body
                })
            };
        }

        const aihubmixData = JSON.parse(response.body);
        console.log('[aihubmix-native] Aihubmix response received:', JSON.stringify(aihubmixData, null, 2));
        
        // 处理Responses API的响应格式
        if (!aihubmixData || !aihubmixData.choices || !aihubmixData.choices[0] || !aihubmixData.choices[0].message) {
            console.error('[aihubmix-native] Invalid response structure from Aihubmix:', aihubmixData);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Aihubmix API返回了无效的响应格式'
                })
            };
        }

        const message = aihubmixData.choices[0].message;
        
        // 检查是否有图像内容
        if (message.content && Array.isArray(message.content)) {
            const imageContent = message.content.find(item => item.type === 'image');
            if (imageContent && imageContent.image_url) {
                console.log('[aihubmix-native] Image processed successfully');
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        success: true,
                        imageUrl: imageContent.image_url.url,
                        message: '图像处理完成'
                    })
                };
            }
        }
        
        // 如果没有找到图像，返回文本响应
        const textContent = typeof message.content === 'string' ? message.content : 
                           (Array.isArray(message.content) ? message.content.find(item => item.type === 'text')?.text : '');
        
        console.log('[aihubmix-native] No image in response, got text:', textContent);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: '未能生成处理后的图像',
                details: textContent || '响应中没有图像内容'
            })
        };

    } catch (error) {
        console.error('[aihubmix-native] Error processing image:', error);
        
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
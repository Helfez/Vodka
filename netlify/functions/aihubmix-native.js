const https = require('https');
const { URL } = require('url');

// 辅助函数：创建multipart/form-data
function createMultipartFormData(fields, files) {
    const boundary = '----formdata-' + Math.random().toString(36);
    const chunks = [];
    
    // 添加文件字段 (必须先添加image字段)
    for (const [key, file] of Object.entries(files)) {
        chunks.push(Buffer.from(`--${boundary}\r\n`));
        chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"; filename="${file.filename}"\r\n`));
        chunks.push(Buffer.from(`Content-Type: ${file.contentType}\r\n\r\n`));
        chunks.push(file.data); // 直接使用Buffer数据
        chunks.push(Buffer.from('\r\n'));
    }
    
    // 添加普通字段
    for (const [key, value] of Object.entries(fields)) {
        chunks.push(Buffer.from(`--${boundary}\r\n`));
        chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
        chunks.push(Buffer.from(`${value}\r\n`));
    }
    
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    
    return {
        body: Buffer.concat(chunks),
        contentType: `multipart/form-data; boundary=${boundary}`
    };
}

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

    const { image_base64, prompt: userPrompt, size = "1024x1024", n = 1 } = requestBody;

    if (!image_base64) {
        console.error('[aihubmix-native] Missing image_base64 parameter');
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '请求体中缺少有效的图像Base64编码 (image_base64)' })
        };
    }

    try {
        console.log('[aihubmix-native] Processing image with AIhubmix Images Edit API...');
        
        // 将Base64转换为Buffer
        const imageBuffer = Buffer.from(image_base64, 'base64');
        console.log('[aihubmix-native] Image buffer size:', imageBuffer.length);
        
        // 创建multipart form data - 按照AIhubmix官方示例的格式
        const formData = createMultipartFormData(
            {
                'model': 'gpt-image-1',
                'prompt': userPrompt || "请帮我把这张图片的背景完全移除，只保留主要物体，生成一张透明背景的PNG图片。要求：1. 精确抠图，边缘清晰 2. 背景完全透明 3. 保持主体物品的完整性和清晰度",
                'n': n.toString(),
                'size': size,
                'quality': 'high'
                // 注意：不包含response_format参数，AIhubmix默认返回b64_json
            },
            {
                'image': {
                    filename: 'input_image.png',
                    contentType: 'image/png',
                    data: imageBuffer
                }
            }
        );
        
        console.log('[aihubmix-native] Form data size:', formData.body.length);
        
        // 设置请求选项 - 使用Images Edit API端点
        const requestOptions = {
            hostname: 'aihubmix.com',
            port: 443,
            path: '/v1/images/edits',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': formData.contentType,
                'Content-Length': formData.body.length
            }
        };
        
        console.log('[aihubmix-native] Sending request to AIhubmix Images Edit API...');
        
        // 发送请求
        const response = await httpsRequest(requestOptions, formData.body);
        
        console.log('[aihubmix-native] Response status:', response.statusCode);
        
        if (response.statusCode !== 200) {
            console.error('[aihubmix-native] AIhubmix API Error:', response.statusCode, response.body);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: `AIhubmix API错误: ${response.statusCode}`,
                    details: response.body
                })
            };
        }

        const aihubmixData = JSON.parse(response.body);
        console.log('[aihubmix-native] AIhubmix response received:', JSON.stringify(aihubmixData, null, 2));
        
        // 处理Images API的响应格式
        if (!aihubmixData || !aihubmixData.data || !aihubmixData.data[0]) {
            console.error('[aihubmix-native] Invalid response structure from AIhubmix:', aihubmixData);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'AIhubmix API返回了无效的响应格式'
                })
            };
        }

        const imageData = aihubmixData.data[0];
        
        // 检查是否有base64图像数据
        if (imageData.b64_json) {
            const imageDataUrl = `data:image/png;base64,${imageData.b64_json}`;
            console.log('[aihubmix-native] Image processed successfully with base64 data');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true,
                    imageUrl: imageDataUrl,
                    message: '图像处理完成'
                })
            };
        }
        
        // 检查是否有URL
        if (imageData.url) {
            console.log('[aihubmix-native] Image processed successfully with URL:', imageData.url);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true,
                    imageUrl: imageData.url,
                    message: '图像处理完成'
                })
            };
        }
        
        console.log('[aihubmix-native] No image data found in response');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: '未能生成处理后的图像',
                details: '响应中没有图像数据',
                fullResponse: aihubmixData
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
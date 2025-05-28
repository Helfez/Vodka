const https = require('https');
const { URL } = require('url');

// 辅助函数：创建multipart/form-data
function createMultipartFormData(fields, files) {
    const boundary = '----formdata-' + Math.random().toString(36);
    let body = '';
    
    // 添加普通字段
    for (const [key, value] of Object.entries(fields)) {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
        body += `${value}\r\n`;
    }
    
    // 添加文件字段
    for (const [key, file] of Object.entries(files)) {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="${key}"; filename="${file.filename}"\r\n`;
        body += `Content-Type: ${file.contentType}\r\n\r\n`;
        body += file.data;
        body += '\r\n';
    }
    
    body += `--${boundary}--\r\n`;
    
    return {
        body: Buffer.from(body, 'binary'),
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
        console.log('[aihubmix-native] Processing image with Aihubmix...');
        
        // 将Base64转换为Buffer
        const imageBuffer = Buffer.from(image_base64, 'base64');
        
        // 创建multipart form data
        const formData = createMultipartFormData(
            {
                'model': 'gpt-image-1',
                'prompt': userPrompt || "Remove the background, making it transparent. Keep the main subject clear and high quality.",
                'n': n.toString(),
                'size': size
            },
            {
                'image': {
                    filename: 'input_image.png',
                    contentType: 'image/png',
                    data: imageBuffer
                }
            }
        );
        
        // 设置请求选项
        const requestOptions = {
            hostname: 'aihubmix.com',
            port: 443,
            path: '/v1/images/edits',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': formData.contentType,
                'Content-Length': formData.body.length
            },
            timeout: 25000
        };
        
        console.log('[aihubmix-native] Sending request to Aihubmix API...');
        
        // 发送请求
        const response = await httpsRequest(requestOptions, formData.body);
        
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
        console.log('[aihubmix-native] Aihubmix response received.');
        
        if (!aihubmixData || !aihubmixData.data || !aihubmixData.data[0] || !aihubmixData.data[0].b64_json) {
            console.error('[aihubmix-native] Invalid response structure from Aihubmix:', aihubmixData);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Aihubmix API返回了无效的响应格式'
                })
            };
        }

        const processedImageBase64 = aihubmixData.data[0].b64_json;
        const imageDataUrl = `data:image/png;base64,${processedImageBase64}`;
        
        console.log('[aihubmix-native] Image processed successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                imageUrl: imageDataUrl,
                message: '图像处理完成'
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
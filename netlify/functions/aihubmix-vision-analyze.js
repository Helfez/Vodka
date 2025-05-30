import OpenAI from 'openai';

export default async (request, context) => {
    console.log('[aihubmix-vision-analyze] === Vision分析函数启动 ===');
    console.log('[aihubmix-vision-analyze] 📥 请求信息:');
    console.log('  - 方法:', request.method);
    console.log('  - URL:', request.url);
    console.log('  - Headers:', Object.keys(request.headers));
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (request.method === 'OPTIONS') {
        console.log('[aihubmix-vision-analyze] ✅ OPTIONS预检请求处理完成');
        return new Response('', {
            status: 200,
            headers: corsHeaders
        });
    }

    if (request.method !== 'POST') {
        console.error('[aihubmix-vision-analyze] ❌ 不支持的HTTP方法:', request.method);
        return new Response(JSON.stringify({ error: '只允许POST方法' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    let requestBody;
    try {
        console.log('[aihubmix-vision-analyze] 📖 开始解析请求体...');
        const bodyText = await request.text();
        console.log('[aihubmix-vision-analyze] 📊 请求体大小:', Math.round(bodyText.length / 1024), 'KB');
        
        requestBody = JSON.parse(bodyText);
        console.log('[aihubmix-vision-analyze] ✅ 请求体解析成功');
        console.log('[aihubmix-vision-analyze] 📋 请求参数:');
        console.log('  - 包含图片:', !!requestBody.image_base64);
        console.log('  - 图片大小:', requestBody.image_base64 ? Math.round(requestBody.image_base64.length / 1024) + 'KB' : 'N/A');
        console.log('  - 系统提示词长度:', requestBody.system_prompt?.length || 0);
        console.log('  - 用户提示词长度:', requestBody.user_prompt?.length || 0);
        console.log('  - 是否有参考图片:', !!requestBody.reference_image_url);
        if (requestBody.reference_image_url) {
            console.log('  - 参考图片URL:', requestBody.reference_image_url);
        }
    } catch (error) {
        console.error('[aihubmix-vision-analyze] ❌ JSON解析失败:', error.message);
        return new Response(JSON.stringify({ error: '无效的JSON请求体', details: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const { 
        image_base64, 
        system_prompt,  // 直接使用前端传来的值，不设默认值
        reference_image_url
    } = requestBody;

    if (!image_base64) {
        console.error('[aihubmix-vision-analyze] ❌ 缺少必需参数: image_base64');
        return new Response(JSON.stringify({ error: '缺少必需参数: image_base64' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (!system_prompt) {
        console.error('[aihubmix-vision-analyze] ❌ 缺少必需参数: system_prompt');
        return new Response(JSON.stringify({ error: '缺少必需参数: system_prompt' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log('[aihubmix-vision-analyze] 📋 处理参数:');
    console.log('  - 画板图片大小:', Math.round(image_base64.length / 1024), 'KB');
    console.log('  - 系统提示词长度:', system_prompt.length);
    console.log('  - 用户提示词长度:', requestBody.user_prompt?.length || 0);
    console.log('  - 是否有参考图片:', !!reference_image_url);
    if (reference_image_url) {
        console.log('  - 参考图片URL:', reference_image_url);
    }

    // 使用AIhubmix的API密钥
    const aihubmixApiKey = process.env.AIHUBMIX_API_KEY;
    if (!aihubmixApiKey) {
        console.error('[aihubmix-vision-analyze] ❌ 环境变量检查失败: AIHUBMIX_API_KEY未设置');
        return new Response(JSON.stringify({ error: '服务器配置错误：缺少AIhubmix API密钥' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log('[aihubmix-vision-analyze] 🔑 API密钥验证通过，长度:', aihubmixApiKey.length);

    try {
        // 使用AIhubmix的OpenAI兼容接口
        console.log('[aihubmix-vision-analyze] 🔧 初始化OpenAI客户端...');
        const openai = new OpenAI({
            apiKey: aihubmixApiKey,
            baseURL: "https://aihubmix.com/v1"
        });

        // 确保base64字符串格式正确
        const imageData = image_base64.startsWith('data:') 
            ? image_base64 
            : `data:image/png;base64,${image_base64}`;

        console.log('[aihubmix-vision-analyze] 🖼️ 图片数据处理:');
        console.log('  - 原始格式检查:', image_base64.startsWith('data:') ? '已包含前缀' : '添加前缀');
        console.log('  - 最终数据大小:', Math.round(imageData.length / 1024), 'KB');

        // 构建用户消息内容
        const userMessageContent = [
            {
                type: "image_url",
                image_url: {
                    url: imageData,
                    detail: "high"
                }
            }
        ];

        // 如果有参考图片，添加到消息中
        if (reference_image_url) {
            console.log('[aihubmix-vision-analyze] 📎 添加参考图片到分析请求');
            userMessageContent.push({
                type: "image_url",
                image_url: {
                    url: reference_image_url,
                    detail: "low"  // 参考图片用较低精度即可
                }
            });
        }

        console.log('[aihubmix-vision-analyze] 🚀 开始调用AIhubmix Vision API...');
        const apiStartTime = Date.now();
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // 使用AIhubmix支持的模型
            messages: [
                {
                    role: "system",
                    content: system_prompt
                },
                {
                    role: "user",
                    content: userMessageContent
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        });

        const apiEndTime = Date.now();
        const apiDuration = apiEndTime - apiStartTime;

        console.log('[aihubmix-vision-analyze] ✅ API调用成功:');
        console.log('  - 调用耗时:', apiDuration, 'ms');
        console.log('  - 响应模型:', response.model);
        console.log('  - 使用情况:', response.usage);

        const analysis = response.choices[0]?.message?.content;
        
        if (!analysis) {
            console.error('[aihubmix-vision-analyze] ❌ API返回空分析结果');
            throw new Error('AIhubmix API返回了空的分析结果');
        }

        console.log('[aihubmix-vision-analyze] 📝 分析结果:');
        console.log('  - 结果长度:', analysis.length, '字符');
        console.log('  - 结果预览:', analysis.substring(0, 100) + '...');
        
        const responseData = {
            success: true,
            analysis: analysis,
            usage: response.usage,
            metadata: {
                processingTime: apiDuration,
                model: response.model,
                timestamp: new Date().toISOString()
            }
        };

        console.log('[aihubmix-vision-analyze] ✅ 响应准备完成');
        console.log('[aihubmix-vision-analyze] === Vision分析函数完成 ===');
        
        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[aihubmix-vision-analyze] ❌ API调用失败:', error);
        console.error('  - 错误类型:', error.constructor?.name || 'Unknown');
        console.error('  - 错误代码:', error.code);
        console.error('  - 错误消息:', error.message);
        console.error('  - 错误堆栈:', error.stack);
        
        let errorMessage = '分析图片时发生错误';
        let statusCode = 500;
        
        if (error.code === 'insufficient_quota') {
            errorMessage = 'AIhubmix API配额不足';
            statusCode = 429;
            console.error('[aihubmix-vision-analyze] 💰 配额不足');
        } else if (error.code === 'invalid_api_key') {
            errorMessage = 'AIhubmix API密钥无效';
            statusCode = 401;
            console.error('[aihubmix-vision-analyze] 🔑 API密钥无效');
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        console.log('[aihubmix-vision-analyze] 📤 返回错误响应:', statusCode, errorMessage);
        
        return new Response(JSON.stringify({ 
            error: errorMessage, 
            details: error.message,
            code: error.code,
            timestamp: new Date().toISOString()
        }), {
            status: statusCode,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}; 
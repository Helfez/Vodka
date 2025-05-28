import OpenAI from 'openai';

export default async (request, context) => {
    console.log('[aihubmix-dalle-generate] === DALL-E生成函数启动 ===');
    console.log('[aihubmix-dalle-generate] 📥 请求信息:');
    console.log('  - 方法:', request.method);
    console.log('  - URL:', request.url);
    console.log('  - Headers:', Object.keys(request.headers));
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (request.method === 'OPTIONS') {
        console.log('[aihubmix-dalle-generate] ✅ OPTIONS预检请求处理完成');
        return new Response('', {
            status: 200,
            headers: corsHeaders
        });
    }

    if (request.method !== 'POST') {
        console.error('[aihubmix-dalle-generate] ❌ 不支持的HTTP方法:', request.method);
        return new Response(JSON.stringify({ error: '只允许POST方法' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    let requestBody;
    try {
        console.log('[aihubmix-dalle-generate] 📖 开始解析请求体...');
        const bodyText = await request.text();
        console.log('[aihubmix-dalle-generate] 📊 请求体大小:', Math.round(bodyText.length / 1024), 'KB');
        
        requestBody = JSON.parse(bodyText);
        console.log('[aihubmix-dalle-generate] ✅ 请求体解析成功');
    } catch (error) {
        console.error('[aihubmix-dalle-generate] ❌ JSON解析失败:', error.message);
        return new Response(JSON.stringify({ error: '无效的JSON请求体', details: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const { 
        prompt,
        n = 1,
        size = "1024x1024",
        quality = "standard",
        style = "vivid"
    } = requestBody;

    console.log('[aihubmix-dalle-generate] 📋 生成参数:');
    console.log('  - 提示词长度:', prompt?.length || 0);
    console.log('  - 提示词预览:', prompt ? prompt.substring(0, 100) + '...' : 'N/A');
    console.log('  - 图片数量:', n);
    console.log('  - 图片尺寸:', size);
    console.log('  - 图片质量:', quality);
    console.log('  - 图片风格:', style);

    if (!prompt) {
        console.error('[aihubmix-dalle-generate] ❌ 缺少必需参数: prompt');
        return new Response(JSON.stringify({ error: '请求体中缺少提示词 (prompt)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // 使用AIhubmix的API密钥
    const aihubmixApiKey = process.env.AIHUBMIX_API_KEY;
    if (!aihubmixApiKey) {
        console.error('[aihubmix-dalle-generate] ❌ 环境变量检查失败: AIHUBMIX_API_KEY未设置');
        return new Response(JSON.stringify({ error: '服务器配置错误：缺少AIhubmix API密钥' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log('[aihubmix-dalle-generate] 🔑 API密钥验证通过，长度:', aihubmixApiKey.length);

    try {
        // 使用AIhubmix的OpenAI兼容接口
        console.log('[aihubmix-dalle-generate] 🔧 初始化OpenAI客户端...');
        const openai = new OpenAI({
            apiKey: aihubmixApiKey,
            baseURL: "https://aihubmix.com/v1"
        });

        console.log('[aihubmix-dalle-generate] 🎨 开始调用AIhubmix DALL-E API...');
        const apiStartTime = Date.now();
        
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: parseInt(n, 10),
            size: size,
            quality: quality,
            style: style,
            response_format: "url"
        });

        const apiEndTime = Date.now();
        const apiDuration = apiEndTime - apiStartTime;

        console.log('[aihubmix-dalle-generate] ✅ API调用成功:');
        console.log('  - 调用耗时:', apiDuration, 'ms');
        console.log('  - 使用情况:', response.usage);

        const images = response.data;
        
        if (!images || images.length === 0) {
            console.error('[aihubmix-dalle-generate] ❌ API返回空图片结果');
            throw new Error('AIhubmix DALL-E API返回了空的图片结果');
        }

        console.log('[aihubmix-dalle-generate] 🖼️ 图片生成结果:');
        console.log('  - 生成图片数量:', images.length);
        
        images.forEach((img, index) => {
            console.log(`  - 图片${index + 1}:`, {
                url: img.url ? img.url.substring(0, 50) + '...' : 'N/A',
                hasRevisedPrompt: !!img.revised_prompt,
                revisedPromptLength: img.revised_prompt?.length || 0
            });
        });

        const responseData = {
            success: true,
            images: images.map(img => ({
                url: img.url,
                revised_prompt: img.revised_prompt
            })),
            usage: response.usage || null,
            metadata: {
                processingTime: apiDuration,
                model: "dall-e-3",
                timestamp: new Date().toISOString(),
                parameters: { n, size, quality, style }
            }
        };

        console.log('[aihubmix-dalle-generate] ✅ 响应准备完成');
        console.log('[aihubmix-dalle-generate] === DALL-E生成函数完成 ===');
        
        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[aihubmix-dalle-generate] ❌ API调用失败:', error);
        console.error('  - 错误类型:', error.constructor?.name || 'Unknown');
        console.error('  - 错误代码:', error.code);
        console.error('  - 错误消息:', error.message);
        console.error('  - 错误堆栈:', error.stack);
        
        let errorMessage = '生成图片时发生错误';
        let statusCode = 500;
        
        if (error.code === 'insufficient_quota') {
            errorMessage = 'AIhubmix API配额不足';
            statusCode = 429;
            console.error('[aihubmix-dalle-generate] 💰 配额不足');
        } else if (error.code === 'invalid_api_key') {
            errorMessage = 'AIhubmix API密钥无效';
            statusCode = 401;
            console.error('[aihubmix-dalle-generate] 🔑 API密钥无效');
        } else if (error.code === 'content_policy_violation') {
            errorMessage = '提示词违反了内容政策';
            statusCode = 400;
            console.error('[aihubmix-dalle-generate] 🚫 内容政策违规');
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        console.log('[aihubmix-dalle-generate] 📤 返回错误响应:', statusCode, errorMessage);
        
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
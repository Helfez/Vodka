export default async (request, context) => {
    console.log('[model-proxy] 🔗 模型代理函数启动');
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };

    if (request.method === 'OPTIONS') {
        return new Response('', {
            status: 200,
            headers: corsHeaders
        });
    }

    if (request.method !== 'GET') {
        return new Response(JSON.stringify({ error: '只允许GET方法' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const url = new URL(request.url);
    const modelUrl = url.searchParams.get('url');

    if (!modelUrl) {
        console.error('[model-proxy] ❌ 缺少url参数');
        return new Response(JSON.stringify({ error: '缺少模型URL参数' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // 验证URL是否来自Tripo3D
    if (!modelUrl.includes('tripo3d.com') && !modelUrl.includes('tripo-data.rgl.data')) {
        console.error('[model-proxy] ❌ 不支持的模型URL:', modelUrl);
        return new Response(JSON.stringify({ error: '不支持的模型URL' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        console.log(`[model-proxy] 📥 代理下载模型: ${modelUrl}`);
        
        const response = await fetch(modelUrl);
        
        if (!response.ok) {
            console.error(`[model-proxy] ❌ 模型下载失败: ${response.status} ${response.statusText}`);
            throw new Error(`模型下载失败: ${response.status} ${response.statusText}`);
        }

        // 获取原始响应头
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const contentLength = response.headers.get('content-length');
        
        console.log(`[model-proxy] ✅ 模型下载成功`);
        console.log(`  - Content-Type: ${contentType}`);
        console.log(`  - Content-Length: ${contentLength}`);

        // 设置响应头
        const responseHeaders = {
            ...corsHeaders,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600', // 缓存1小时
        };

        if (contentLength) {
            responseHeaders['Content-Length'] = contentLength;
        }

        // 返回模型数据
        return new Response(response.body, {
            status: 200,
            headers: responseHeaders
        });

    } catch (error) {
        console.error('[model-proxy] ❌ 代理失败:', error.message);
        return new Response(JSON.stringify({ 
            error: '模型代理失败', 
            details: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}; 
export default async (request, context) => {
  console.log('[image-proxy] === 图片代理服务开始 ===');
  
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
    return new Response(JSON.stringify({ error: '只允许GET请求' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get('url');
    
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: '缺少图片URL参数' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[image-proxy] 📸 代理图片:', imageUrl.substring(0, 50) + '...');
    
    let imageResponse;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[image-proxy] 🔄 尝试获取图片 (第${attempt}次)...`);
        
        imageResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
          },
          timeout: 10000 // 10秒超时
        });
        
        if (imageResponse.ok) {
          console.log(`[image-proxy] ✅ 第${attempt}次尝试成功`);
          break;
        } else {
          lastError = new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
          console.log(`[image-proxy] ❌ 第${attempt}次尝试失败:`, lastError.message);
        }
      } catch (fetchError) {
        lastError = fetchError;
        console.log(`[image-proxy] ❌ 第${attempt}次尝试异常:`, fetchError.message);
      }
      
      if (attempt < maxRetries) {
        const delay = attempt * 1000; // 递增延迟：1s, 2s
        console.log(`[image-proxy] ⏳ 等待${delay}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    if (!imageResponse || !imageResponse.ok) {
      throw lastError || new Error('获取图片失败');
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    
    console.log('[image-proxy] ✅ 图片代理成功, 大小:', Math.round(imageBuffer.byteLength / 1024), 'KB');
    console.log('[image-proxy] 📊 Content-Type:', contentType);
    
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Proxy-Source': 'netlify-functions'
      }
    });

  } catch (error) {
    console.error('[image-proxy] ❌ 代理失败:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}; 
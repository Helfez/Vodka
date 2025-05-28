export default async (request, context) => {
    console.log('[test-ai-generation] Function invoked.');
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (request.method === 'OPTIONS') {
        return new Response('', {
            status: 200,
            headers: corsHeaders
        });
    }

    try {
        // 检查环境变量
        const aihubmixApiKey = process.env.AIHUBMIX_API_KEY;
        
        const testResults = {
            timestamp: new Date().toISOString(),
            environment: {
                hasAihubmixKey: !!aihubmixApiKey,
                aihubmixKeyLength: aihubmixApiKey ? aihubmixApiKey.length : 0,
                nodeVersion: process.version,
                platform: process.platform
            },
            functions: {
                visionAnalyze: '/.netlify/functions/aihubmix-vision-analyze',
                dalleGenerate: '/.netlify/functions/aihubmix-dalle-generate'
            },
            status: 'ready'
        };

        return new Response(JSON.stringify(testResults, null, 2), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[test-ai-generation] Error:', error);
        
        return new Response(JSON.stringify({ 
            error: '测试失败', 
            details: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}; 
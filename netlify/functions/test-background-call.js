// 测试后台函数调用的简单测试函数
import fetch from 'node-fetch';

export default async (request, context) => {
    console.log('[test-background-call] 测试开始');
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (request.method === 'OPTIONS') {
        return new Response('', {
            status: 200,
            headers: corsHeaders
        });
    }

    try {
        const siteURL = context.site?.url || process.env.URL || 'https://d-vodka.netlify.app';
        const backgroundFunctionURL = `${siteURL}/.netlify/functions/aihubmix-process-background`;
        
        console.log(`[test-background-call] 尝试调用: ${backgroundFunctionURL}`);
        
        // 测试调用后台函数
        const response = await fetch(backgroundFunctionURL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Netlify-Function-Test'
            },
            body: JSON.stringify({ 
                taskId: 'test-task-' + Date.now(),
                test: true 
            })
        });

        console.log(`[test-background-call] 响应状态: ${response.status}`);
        const responseText = await response.text();
        console.log(`[test-background-call] 响应内容: ${responseText}`);

        return new Response(JSON.stringify({ 
            success: true,
            backgroundCallStatus: response.status,
            backgroundResponse: responseText,
            message: '后台函数调用测试完成'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[test-background-call] 测试失败:', error);
        return new Response(JSON.stringify({ 
            success: false,
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}; 
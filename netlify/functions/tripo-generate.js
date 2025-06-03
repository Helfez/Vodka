import { getStore } from '@netlify/blobs';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

export default async (request, context) => {
    console.log('[tripo-generate] === Tripo 3D生成函数启动 ===');
    console.log('[tripo-generate] Request method:', request.method);
    console.log('[tripo-generate] Request URL:', request.url);

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

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: '只允许POST方法' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const siteURL = context.site?.url || process.env.URL || 'https://d-vodka.netlify.app';

    let requestBody;
    try {
        const bodyText = await request.text();
        requestBody = JSON.parse(bodyText);
        console.log('[tripo-generate] 📋 请求参数:', {
            hasImage: !!requestBody.imageBase64,
            outputFormat: requestBody.outputFormat,
            removeBackground: requestBody.removeBackground,
            mcResolution: requestBody.mcResolution
        });
    } catch (error) {
        console.error('[tripo-generate] Invalid JSON body:', error.message);
        return new Response(JSON.stringify({ error: '无效的JSON请求体', details: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const { 
        imageBase64,
        outputFormat = 'glb',
        removeBackground = true,
        foregroundRatio = 0.9,
        mcResolution = 256
    } = requestBody;

    // 验证参数
    if (!imageBase64) {
        console.error('[tripo-generate] ❌ 缺少imageBase64参数');
        return new Response(JSON.stringify({ error: '需要提供图像Base64编码 (imageBase64)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    const taskId = uuidv4();
    console.log(`[tripo-generate] 🆕 创建3D生成任务: ${taskId}`);
    
    let store;
    try {
        store = getStore('tripo-tasks');
        console.log('[tripo-generate] ✅ Netlify Blobs store 初始化成功');
    } catch (error) {
        console.error('[tripo-generate] ❌ Netlify Blobs store 初始化失败:', error.message);
        return new Response(JSON.stringify({ error: 'Blob存储初始化失败', details: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // 将任务信息存储到Blob
    const taskData = {
        taskId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        imageBase64,
        options: {
            outputFormat,
            removeBackground,
            foregroundRatio,
            mcResolution
        }
    };

    try {
        await store.setJSON(taskId, taskData);
        console.log(`[tripo-generate] ✅ 任务 ${taskId} 信息已存储到Blob`);
    } catch (error) {
        console.error(`[tripo-generate] ❌ 存储任务信息失败:`, error.message);
        return new Response(JSON.stringify({ error: '任务信息存储失败', details: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // 触发后台处理函数
    console.log(`[tripo-generate] 🚀 触发后台处理函数...`);
    try {
        const backgroundUrl = `${siteURL}/.netlify/functions/tripo-process-background`;
        console.log(`[tripo-generate] 🎯 后台处理URL: ${backgroundUrl}`);
        
        // 异步触发后台处理，不等待结果
        fetch(backgroundUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId }),
        }).catch(error => {
            console.error(`[tripo-generate] ❌ 后台处理触发失败:`, error.message);
        });

        console.log(`[tripo-generate] ✅ 后台处理已触发`);
    } catch (error) {
        console.error(`[tripo-generate] ❌ 触发后台处理失败:`, error.message);
        // 不立即返回错误，因为任务已经创建
    }

    // 返回任务ID给客户端
    console.log(`[tripo-generate] ✅ 任务 ${taskId} 创建成功，返回给客户端`);
    return new Response(JSON.stringify({ 
        success: true, 
        taskId,
        message: '3D生成任务已创建，正在处理中...'
    }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}; 
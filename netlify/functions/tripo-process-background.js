import { getStore } from '@netlify/blobs';

export default async (request, context) => {
    console.log('[tripo-process-background] === Tripo后台处理函数启动 ===');
    
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

    let requestBody;
    try {
        const bodyText = await request.text();
        requestBody = JSON.parse(bodyText);
    } catch (error) {
        console.error('[tripo-process-background] Invalid JSON body:', error.message);
        return new Response(JSON.stringify({ error: '无效的JSON请求体' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const { taskId } = requestBody;

    if (!taskId) {
        console.error('[tripo-process-background] ❌ 缺少taskId参数');
        return new Response(JSON.stringify({ error: '缺少taskId参数' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`[tripo-process-background] 🔄 开始处理任务: ${taskId}`);

    let store;
    try {
        store = getStore('tripo-tasks');
    } catch (error) {
        console.error('[tripo-process-background] ❌ Netlify Blobs store 初始化失败:', error.message);
        return new Response(JSON.stringify({ error: 'Blob存储初始化失败' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    let taskDataFromBlob;
    try {
        taskDataFromBlob = await store.get(taskId, { type: 'json' });
        if (!taskDataFromBlob) {
            console.error(`[tripo-process-background] ❌ 任务 ${taskId} 不存在`);
            return new Response(JSON.stringify({ error: '任务不存在' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error(`[tripo-process-background] ❌ 从Blob获取任务数据失败:`, error.message);
        return new Response(JSON.stringify({ error: '获取任务数据失败' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // 更新任务状态为处理中
    console.log(`[tripo-process-background] 🔄 任务 ${taskId}: 设置状态为处理中`);
    try {
        await store.setJSON(taskId, {
            ...taskDataFromBlob,
            status: 'processing',
            startedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error(`[tripo-process-background] ❌ 更新任务状态失败:`, error.message);
    }

    const tripoApiKey = process.env.TRIPO_API_KEY;
    if (!tripoApiKey) {
        const errorDetail = '[tripo-process-background] ❌ TRIPO_API_KEY 环境变量未设置';
        console.error(errorDetail);
        
        await store.setJSON(taskId, {
            ...taskDataFromBlob,
            status: 'failed',
            error: 'Tripo API密钥未配置',
            failedAt: new Date().toISOString()
        });
        
        return new Response(JSON.stringify({ message: 'Task failed due to missing API key, status updated in Blob' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const { imageBase64, options } = taskDataFromBlob;
    
    try {
        console.log(`[tripo-process-background] 🎨 任务 ${taskId}: 调用Tripo API开始`);
        console.log(`  - 输出格式: ${options.outputFormat}`);
        console.log(`  - 移除背景: ${options.removeBackground}`);
        console.log(`  - 网格分辨率: ${options.mcResolution}`);

        // 使用TripoSR通过fal.ai API (这是目前可用的开源替代方案)
        const falApiKey = process.env.FAL_API_KEY;
        if (!falApiKey) {
            throw new Error('FAL_API_KEY 环境变量未设置');
        }

        // 将base64转换为图片URL或直接使用data URI
        const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;

        console.log(`[tripo-process-background] 🚀 任务 ${taskId}: 调用fal.ai TripoSR API`);
        
        const tripoResponse = await fetch('https://fal.run/fal-ai/triposr', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${falApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_url: imageUrl,
                output_format: options.outputFormat,
                do_remove_background: options.removeBackground,
                foreground_ratio: options.foregroundRatio,
                mc_resolution: options.mcResolution
            })
        });

        if (!tripoResponse.ok) {
            const errorText = await tripoResponse.text();
            console.error(`[tripo-process-background] ❌ Tripo API错误:`, tripoResponse.status, errorText);
            throw new Error(`Tripo API调用失败: ${tripoResponse.status} ${errorText}`);
        }

        const tripoResult = await tripoResponse.json();
        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: Tripo API调用成功`);

        if (!tripoResult.model_mesh?.url) {
            throw new Error('Tripo API未返回有效的模型文件');
        }

        // 更新任务状态为完成
        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: 更新状态为完成`);
        await store.setJSON(taskId, {
            ...taskDataFromBlob,
            status: 'completed',
            modelUrl: tripoResult.model_mesh.url,
            format: options.outputFormat,
            fileSize: tripoResult.model_mesh.file_size,
            completedAt: new Date().toISOString(),
            tripoResponse: {
                timings: tripoResult.timings,
                remeshingDir: tripoResult.remeshing_dir?.url
            }
        });

        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: 3D模型生成完成`);
        console.log(`  - 模型URL: ${tripoResult.model_mesh.url}`);
        console.log(`  - 文件大小: ${tripoResult.model_mesh.file_size} bytes`);

    } catch (error) {
        const errorDetail = `[tripo-process-background] ❌ 任务 ${taskId} 处理失败: ${error.message}`;
        console.error(errorDetail);
        console.error('  - 错误堆栈:', error.stack);

        try {
            await store.setJSON(taskId, {
                ...taskDataFromBlob,
                status: 'failed',
                error: error.message,
                failedAt: new Date().toISOString()
            });
            console.log(`[tripo-process-background] ✅ 任务 ${taskId}: 错误状态已更新到Blob`);
        } catch (updateError) {
            console.error(`[tripo-process-background] ❌ 更新错误状态失败:`, updateError.message);
        }
    }

    return new Response(JSON.stringify({ message: `Task ${taskId} processing completed, status updated in Blob` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}; 
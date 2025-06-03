import { getStore } from '@netlify/blobs';

export default async (request, context) => {
    console.log('[tripo-process-background] 🎯 后台处理函数启动 - 已更新API密钥');
    
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

    console.log(`[tripo-process-background] 📋 处理任务: ${taskId}`);

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
            error: 'Tripo API密钥未配置，请在Netlify环境变量中设置TRIPO_API_KEY',
            failedAt: new Date().toISOString()
        });
        
        return new Response(JSON.stringify({ message: 'Task failed due to missing API key, status updated in Blob' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const { imageUrl, options } = taskDataFromBlob;
    
    try {
        console.log(`[tripo-process-background] 🎨 任务 ${taskId}: 调用Tripo直接上传流程开始`);
        console.log(`  - 图片URL: ${imageUrl}`);
        console.log(`  - 输出格式: ${options.outputFormat}`);
        console.log(`  - 移除背景: ${options.removeBackground}`);
        console.log(`  - 网格分辨率: ${options.mcResolution}`);

        // 第一步：从HTTP URL下载图片
        console.log(`[tripo-process-background] 📥 任务 ${taskId}: 第一步 - 下载图片`);
        
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`下载图片失败: ${imageResponse.status} ${imageResponse.statusText}`);
        }
        
        // 在Netlify Functions环境中使用arrayBuffer()而不是buffer()
        const imageArrayBuffer = await imageResponse.arrayBuffer();
        const imageBuffer = Buffer.from(imageArrayBuffer);
        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: 图片下载成功，大小: ${Math.round(imageBuffer.length / 1024)}KB`);
        
        // 检测图片格式和文件名 - 直接使用JPEG格式
        const imageFormat = 'jpeg';  // 确定是JPG/JPEG格式
        const fileName = `image_${Date.now()}.jpg`;
        console.log(`[tripo-process-background] 📋 任务 ${taskId}: 使用JPEG格式，文件名: ${fileName}`);

        // 第二步：直接上传到Tripo获取image_token
        console.log(`[tripo-process-background] 📤 任务 ${taskId}: 第二步 - 直接上传获取image_token`);
        
        // 手动构建multipart/form-data
        const boundary = `----formdata-tripo-${Date.now()}`;
        const CRLF = '\r\n';
        
        const formDataBuffer = Buffer.concat([
            Buffer.from(`--${boundary}${CRLF}`),
            Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}`),
            Buffer.from(`Content-Type: image/${imageFormat}${CRLF}${CRLF}`),
            imageBuffer,
            Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
        ]);

        console.log(`[tripo-process-background] 📋 任务 ${taskId}: FormData构建完成`);
        console.log(`  - 文件名: ${fileName}`);
        console.log(`  - 内容类型: image/${imageFormat}`);
        console.log(`  - 文件大小: ${Math.round(imageBuffer.length / 1024)}KB`);
        console.log(`  - FormData大小: ${Math.round(formDataBuffer.length / 1024)}KB`);

        const uploadResponse = await fetch('https://api.tripo3d.ai/v2/openapi/upload/sts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tripoApiKey}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': formDataBuffer.length.toString()
            },
            body: formDataBuffer
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error(`[tripo-process-background] ❌ 图片上传失败:`, uploadResponse.status, errorText);
            throw new Error(`图片上传失败: ${uploadResponse.status} ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: 图片上传成功`, uploadResult);

        if (uploadResult.code !== 0 || !uploadResult.data?.image_token) {
            throw new Error(`图片上传失败: ${uploadResult.message || '未获取到image_token'}`);
        }

        const imageToken = uploadResult.data.image_token;
        console.log(`[tripo-process-background] 📋 任务 ${taskId}: 获取到image_token: ${imageToken}`);

        // 第三步：使用image_token创建3D生成任务
        console.log(`[tripo-process-background] 🚀 任务 ${taskId}: 第三步 - 创建3D生成任务`);

        const taskResponse = await fetch('https://api.tripo3d.ai/v2/openapi/task', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tripoApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'image_to_model',
                file: {
                    type: imageFormat,
                    file_token: imageToken // 使用image_token作为file_token
                }
            })
        });

        if (!taskResponse.ok) {
            const errorText = await taskResponse.text();
            console.error(`[tripo-process-background] ❌ 任务创建失败:`, taskResponse.status, errorText);
            throw new Error(`任务创建失败: ${taskResponse.status} ${errorText}`);
        }

        const taskResult = await taskResponse.json();
        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: 任务创建成功`);

        if (taskResult.code !== 0 || !taskResult.data?.task_id) {
            throw new Error(`任务创建失败: ${taskResult.message || '未获取到task_id'}`);
        }

        const tripoTaskId = taskResult.data.task_id;
        console.log(`[tripo-process-background] 📋 任务 ${taskId}: Tripo任务ID: ${tripoTaskId}`);

        // 第四步：WebSocket监听任务状态
        console.log(`[tripo-process-background] 🔄 任务 ${taskId}: 第四步 - WebSocket监听任务状态`);
        
        const WebSocket = (await import('ws')).default;
        const wsUrl = `wss://api.tripo3d.ai/v2/openapi/task/watch/${tripoTaskId}`;
        
        const ws = new WebSocket(wsUrl, {
            headers: {
                'Authorization': `Bearer ${tripoApiKey}`
            }
        });

        const result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('WebSocket监听超时（5分钟）'));
            }, 300000); // 5分钟超时

            ws.on('open', () => {
                console.log(`[tripo-process-background] 🔗 任务 ${taskId}: WebSocket连接已建立`);
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log(`[tripo-process-background] 📨 任务 ${taskId}: WebSocket消息:`, message);

                    if (message.event === 'update') {
                        const status = message.data?.status;
                        console.log(`[tripo-process-background] 📊 任务 ${taskId}: 状态更新: ${status}`);
                        
                        // 这里可以更新任务状态到Blob（可选）
                        if (status === 'running') {
                            store.setJSON(taskId, {
                                ...taskDataFromBlob,
                                status: 'processing',
                                tripoTaskId: tripoTaskId,
                                imageToken: imageToken
                            }).catch(console.error);
                        }
                    } else if (message.event === 'finalized') {
                        clearTimeout(timeout);
                        ws.close();
                        
                        const finalStatus = message.data?.status;
                        console.log(`[tripo-process-background] 🏁 任务 ${taskId}: 任务完成，状态: ${finalStatus}`);
                        
                        if (finalStatus === 'success' && message.data?.result?.model) {
                            resolve({
                                modelUrl: message.data.result.model,
                                previewUrl: message.data.result.preview,
                                format: options.outputFormat || 'glb'
                            });
                        } else {
                            reject(new Error(`任务失败: ${message.data?.error || '未知错误'}`));
                        }
                    }
                } catch (error) {
                    console.error(`[tripo-process-background] ❌ WebSocket消息解析失败:`, error);
                }
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                console.error(`[tripo-process-background] ❌ WebSocket错误:`, error);
                reject(new Error(`WebSocket连接错误: ${error.message}`));
            });

            ws.on('close', (code, reason) => {
                clearTimeout(timeout);
                console.log(`[tripo-process-background] 🔌 任务 ${taskId}: WebSocket连接关闭: ${code} ${reason}`);
            });
        });

        // 更新任务状态为完成
        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: 更新状态为完成`);
        await store.setJSON(taskId, {
            ...taskDataFromBlob,
            status: 'completed',
            modelUrl: result.modelUrl,
            previewUrl: result.previewUrl,
            format: result.format,
            completedAt: new Date().toISOString(),
            tripoResponse: {
                taskId: tripoTaskId,
                imageToken: imageToken
            }
        });

        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: 3D模型生成完成`);
        console.log(`  - 模型URL: ${result.modelUrl}`);
        console.log(`  - 预览URL: ${result.previewUrl}`);
        console.log(`  - 格式: ${result.format}`);
        console.log(`  - 图片Token: ${imageToken}`);

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
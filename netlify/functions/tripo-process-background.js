import { getStore } from '@netlify/blobs';

export default async (request, context) => {
    console.log('[tripo-process-background] 🎯 后台处理函数启动');
    
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
        console.log(`[tripo-process-background] 🎨 任务 ${taskId}: 调用Tripo STS上传流程开始`);
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
        
        const imageBuffer = await imageResponse.buffer();
        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: 图片下载成功，大小: ${Math.round(imageBuffer.length / 1024)}KB`);
        
        // 检测图片格式
        const imageFormat = imageUrl.toLowerCase().includes('.png') ? 'png' : 
                           imageUrl.toLowerCase().includes('.webp') ? 'webp' : 'jpeg';
        console.log(`[tripo-process-background] 📋 任务 ${taskId}: 检测图片格式: ${imageFormat}`);

        // 第二步：获取STS临时凭证
        console.log(`[tripo-process-background] 🔑 任务 ${taskId}: 第二步 - 获取STS临时凭证`);
        
        const stsResponse = await fetch('https://api.tripo3d.ai/v2/openapi/upload/sts/token', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tripoApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                format: imageFormat
            })
        });

        if (!stsResponse.ok) {
            const errorText = await stsResponse.text();
            console.error(`[tripo-process-background] ❌ STS凭证获取失败:`, stsResponse.status, errorText);
            throw new Error(`STS凭证获取失败: ${stsResponse.status} ${errorText}`);
        }

        const stsResult = await stsResponse.json();
        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: STS凭证获取成功`);

        if (stsResult.code !== 0 || !stsResult.data) {
            throw new Error(`STS凭证获取失败: ${stsResult.message || '未获取到STS数据'}`);
        }

        const {
            s3_host,
            resource_bucket,
            resource_url,
            session_token,
            sts_ak,
            sts_sk
        } = stsResult.data;

        console.log(`[tripo-process-background] 📋 任务 ${taskId}: STS信息:`);
        console.log(`  - S3主机: ${s3_host}`);
        console.log(`  - 存储桶: ${resource_bucket}`);
        console.log(`  - 资源路径: ${resource_url}`);

        // 第三步：使用STS凭证上传到S3
        console.log(`[tripo-process-background] 📤 任务 ${taskId}: 第三步 - 上传图片到S3`);
        
        const AWS = (await import('aws-sdk')).default;
        const s3 = new AWS.S3({
            accessKeyId: sts_ak,
            secretAccessKey: sts_sk,
            sessionToken: session_token,
            region: 'us-west-2',
            endpoint: `https://${s3_host}`,
            s3ForcePathStyle: false
        });

        const uploadParams = {
            Bucket: resource_bucket,
            Key: resource_url,
            Body: imageBuffer,
            ContentType: `image/${imageFormat}`,
            ACL: 'private'
        };

        const s3UploadResult = await s3.upload(uploadParams).promise();
        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: 图片上传S3成功`);
        console.log(`  - S3位置: ${s3UploadResult.Location}`);

        // 第四步：使用resource_url创建3D生成任务
        console.log(`[tripo-process-background] 🚀 任务 ${taskId}: 第四步 - 创建3D生成任务`);

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
                    file_token: resource_url // 使用resource_url作为file_token
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

        // 第五步：WebSocket监听任务状态
        console.log(`[tripo-process-background] 🔄 任务 ${taskId}: 第五步 - WebSocket监听任务状态`);
        
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
                                tripoTaskId: tripoTaskId
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
                fileToken: ''
            }
        });

        console.log(`[tripo-process-background] ✅ 任务 ${taskId}: 3D模型生成完成`);
        console.log(`  - 模型URL: ${result.modelUrl}`);
        console.log(`  - 预览URL: ${result.previewUrl}`);
        console.log(`  - 格式: ${result.format}`);

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
// netlify/functions/aihubmix-process-background.js
// import fetch from 'node-fetch'; // No longer needed for AI call
// import FormData from 'form-data'; // No longer needed
import { OpenAI, toFile } from 'openai'; // Import OpenAI SDK
import cloudinary from 'cloudinary';
import { getStore } from '@netlify/blobs';

const cloudinaryV2 = cloudinary.v2;

cloudinaryV2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

const openai = new OpenAI({
    apiKey: process.env.AIHUBMIX_API_KEY,
    baseURL: 'https://aihubmix.com/v1',
});

export default async (request, context) => {
    console.log('[aihubmix-process-background] === 后台处理函数启动 ===');
    
    let taskId;
    let taskDataFromBlob; // To store the full task data from blob

    try {
        const bodyText = await request.text();
        const requestBody = JSON.parse(bodyText);
        taskId = requestBody.taskId; // Expecting only taskId from the trigger

        if (!taskId) {
            console.error('[aihubmix-process-background] ❌ 请求体中缺少taskId');
            return new Response(JSON.stringify({ error: 'Missing taskId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`[aihubmix-process-background] 📋 处理任务: ${taskId}`);

        // 在 Functions v2 中，Netlify Blobs 应该自动工作
        let store;
        try {
            store = getStore('aihubmix_tasks'); // 首先尝试不带参数
        } catch (error) {
            console.log('[aihubmix-process-background] Fallback to manual siteID/token configuration');
            store = getStore('aihubmix_tasks', {
                siteID: process.env.NETLIFY_SITE_ID || context.site?.id,
                token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
            }); // 手动提供 siteID 和 token
        }
        
        taskDataFromBlob = await store.get(taskId, { type: 'json' });

        if (!taskDataFromBlob) {
            console.error(`[aihubmix-process-background] ❌ 任务 ${taskId}: 在Blob存储中未找到`);
            return new Response(JSON.stringify({ error: 'Task data not found in store' }), {
                status: 404, // Not Found
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`[aihubmix-process-background] 📊 任务信息:`, {
            action: taskDataFromBlob.action,
            hasImage: !!taskDataFromBlob.image_base64,
            promptLength: taskDataFromBlob.prompt?.length || 0,
            n: taskDataFromBlob.n,
            size: taskDataFromBlob.size
        });

        // Update status to processing in Blob store
        await store.setJSON(taskId, {
            ...taskDataFromBlob, // Preserve existing data
            status: 'processing',
            startedAt: new Date().toISOString()
        });

        const { action = 'edit', image_base64, prompt: userPrompt, n, size, quality, style } = taskDataFromBlob;
        
        let aihubmixResponse;
        
        if (action === 'edit') {
            // 图片编辑模式
            console.log(`[aihubmix-process-background] 🖼️ 任务 ${taskId}: 使用图片编辑模式`);
            
            const imageBuffer = Buffer.from(image_base64, 'base64');
            const imageFileUploadable = await toFile(imageBuffer, 'input_image.png', {
                type: 'image/png',
            });

            // Parameters for OpenAI SDK call
            const model = "gpt-image-1"; // Or make this configurable via taskDataFromBlob if needed
            const editQuality = "high";      // Or make this configurable

            console.log(`[aihubmix-process-background] 🚀 任务 ${taskId}: 调用AIhubmix images.edit API`);
            console.log(`  - 模型: ${model}, 数量: ${n}, 尺寸: ${size}, 质量: ${editQuality}`);
            
            aihubmixResponse = await openai.images.edit({
                model: model,
                image: imageFileUploadable,
                prompt: userPrompt,
                n: parseInt(n, 10), // Ensure n is an integer
                size: size,
                quality: editQuality
            });

        } else if (action === 'generate') {
            // 图片生成模式
            console.log(`[aihubmix-process-background] 🎨 任务 ${taskId}: 使用图片生成模式`);
            console.log(`  - 提示词: ${userPrompt.substring(0, 100)}...`);
            console.log(`  - 参数: 数量=${n}, 尺寸=${size}, 质量=${quality}, 风格=${style}`);
            
            aihubmixResponse = await openai.images.generate({
                model: "dall-e-3",
                prompt: userPrompt,
                n: parseInt(n, 10),
                size: size,
                quality: quality || "standard",
                style: style || "vivid",
                response_format: "url"
            });

        } else {
            const errorDetail = `[aihubmix-process-background] ❌ 任务 ${taskId}: 不支持的操作类型: ${action}`;
            console.error(errorDetail);
            await store.setJSON(taskId, { 
                ...taskDataFromBlob,
                status: 'failed', 
                error: errorDetail,
                failedAt: new Date().toISOString()
            });
            return new Response(JSON.stringify({ message: 'Task failed due to unsupported action, status updated in Blob' }), {
                status: 200, 
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`[aihubmix-process-background] ✅ 任务 ${taskId}: AIhubmix API调用成功`);

        if (!aihubmixResponse || !aihubmixResponse.data || !aihubmixResponse.data[0]) {
            const errorDetail = `[aihubmix-process-background] ❌ 任务 ${taskId}: AIhubmix API返回无效响应结构`;
            console.error(errorDetail, aihubmixResponse);
            await store.setJSON(taskId, { 
                ...taskDataFromBlob,
                status: 'failed', 
                error: errorDetail,
                failedAt: new Date().toISOString()
            });
            return new Response(JSON.stringify({ message: 'Task failed due to API response, status updated in Blob' }), {
                status: 200, 
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 检查返回的是URL还是base64数据
        const responseData = aihubmixResponse.data[0];
        let imageUrl;
        
        if (responseData.url) {
            // 如果返回的是URL，直接使用
            imageUrl = responseData.url;
            console.log(`[aihubmix-process-background] 📥 任务 ${taskId}: 收到图片URL: ${imageUrl.substring(0, 50)}...`);
        } else if (responseData.b64_json) {
            // 如果返回的是base64，上传到Cloudinary
            const processedImageBase64 = responseData.b64_json;
            console.log(`[aihubmix-process-background] 📤 任务 ${taskId}: 上传base64图片到Cloudinary`);

            const cloudinaryUploadResponse = await cloudinaryV2.uploader.upload(`data:image/png;base64,${processedImageBase64}`, {
                folder: 'aihubmix_processed',
                resource_type: 'image',
                timeout: 60000 // 1 minute timeout for upload
            });

            imageUrl = cloudinaryUploadResponse.secure_url;
            console.log(`[aihubmix-process-background] ✅ 任务 ${taskId}: 图片已上传到Cloudinary: ${imageUrl}`);
        } else {
            const errorDetail = `[aihubmix-process-background] ❌ 任务 ${taskId}: 响应中没有有效的图片数据`;
            console.error(errorDetail, responseData);
            await store.setJSON(taskId, { 
                ...taskDataFromBlob,
                status: 'failed', 
                error: errorDetail,
                failedAt: new Date().toISOString()
            });
            return new Response(JSON.stringify({ message: 'Task failed due to missing image data, status updated in Blob' }), {
                status: 200, 
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 保存完成状态
        const completedTaskData = { 
            ...taskDataFromBlob,
            status: 'completed', 
            imageUrl: imageUrl,
            revised_prompt: responseData.revised_prompt, // DALL-E可能会修订提示词
            usage: aihubmixResponse.usage,
            completedAt: new Date().toISOString()
        };

        await store.setJSON(taskId, completedTaskData);

        console.log(`[aihubmix-process-background] ✅ 任务 ${taskId}: 处理完成`);
        console.log(`  - 图片URL: ${imageUrl.substring(0, 50)}...`);
        console.log(`  - 修订提示词: ${responseData.revised_prompt ? 'Yes' : 'No'}`);
        console.log('[aihubmix-process-background] === 后台处理函数完成 ===');

        return new Response(JSON.stringify({ message: 'Task completed successfully and status updated in Blob' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`[aihubmix-process-background] ❌ 任务 ${taskId || 'UNKNOWN'}: 处理出错:`, error);
        console.error('  - 错误类型:', error.constructor?.name || 'Unknown');
        console.error('  - 错误消息:', error.message);
        console.error('  - 错误堆栈:', error.stack);
        
        if (taskId && getStore) { // Ensure store can be accessed
            try {
                // 在 Functions v2 中，Netlify Blobs 应该自动工作
                let store;
                try {
                    store = getStore('aihubmix_tasks'); // 首先尝试不带参数
                } catch (storeError) {
                    console.log('[aihubmix-process-background] Fallback to manual siteID/token configuration in error handler');
                    store = getStore('aihubmix_tasks', {
                        siteID: process.env.NETLIFY_SITE_ID || context.site?.id,
                        token: process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN
                    }); // 手动提供 siteID 和 token
                }
                // Check if taskDataFromBlob was fetched, to avoid overwriting good data with just an error status
                const updatePayload = taskDataFromBlob ? { ...taskDataFromBlob } : { taskId }; 
                await store.setJSON(taskId, { 
                    ...updatePayload,
                    status: 'failed', 
                    error: `Background processing error: ${error.message}`,
                    errorStack: error.stack, // Include stack for better debugging
                    failedAt: new Date().toISOString()
                });
                console.log(`[aihubmix-process-background] 📝 任务 ${taskId}: 错误状态已更新到Blob`);
            } catch (storeError) {
                console.error(`[aihubmix-process-background] ❌ 更新任务状态失败 ${taskId}:`, storeError);
            }
        }
        // Return 200 OK for the background function invocation itself, error is logged & stored in Blob
        return new Response(JSON.stringify({ message: 'Background task encountered an error, status updated in Blob', details: error.message }), {
            status: 200, 
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
// 辅助函数：将 File 对象转换为 Base64 字符串
// const fileToBase64 = (file: File): Promise<string> => {
//     return new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.readAsDataURL(file);
//         reader.onload = () => resolve(reader.result as string);
//         reader.onerror = error => reject(error);
//     });
// };

export class AihubmixService {
    private static instance: AihubmixService;

    private constructor() {
        // API Key 和其他配置现在由 Netlify Functions 处理
    }

    public static getInstance(): AihubmixService {
        if (!AihubmixService.instance) {
            AihubmixService.instance = new AihubmixService();
        }
        return AihubmixService.instance;
    }

    /**
     * 异步处理图像，使用任务轮询机制
     * @param imageBase64 The Base64 encoded string of the image to be processed.
     * @param prompt Optional prompt for the Aihubmix API.
     * @param onProgress Optional callback for progress updates.
     * @returns A promise that resolves to the URL of the processed image from Cloudinary.
     */
    public async convertToSticker(
        imageBase64: string, 
        prompt?: string, 
        onProgress?: (progress: number) => void
    ): Promise<string> {
        console.log('[AihubmixService convertToSticker] Called with imageBase64 (first 50 chars):', imageBase64.substring(0, 50));

        if (!imageBase64 || typeof imageBase64 !== 'string') {
            console.error('[AihubmixService convertToSticker] Invalid imageBase64 provided.');
            throw new Error('无效的图像Base64编码。');
        }

        const base64Data = imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64;

        const requestBody: { image_base64: string; prompt?: string; size?: string; n?: number } = {
            image_base64: base64Data,
        };
        if (prompt) {
            requestBody.prompt = prompt;
        }

        console.debug('[AihubmixService convertToSticker] Sending to native function with body keys:', Object.keys(requestBody));

        try {
            // 初始进度
            onProgress?.(10);

            console.log('[AihubmixService convertToSticker] Calling aihubmix-native function...');
            
            // 第一步：提交任务
            const response = await fetch('/.netlify/functions/aihubmix-native', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log('[AihubmixService convertToSticker] Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
                console.error('[AihubmixService convertToSticker] API error response:', response.status, errorData);
                throw new Error(`API请求失败，状态码 ${response.status}: ${errorData.error || errorData.message || '未知错误'}`);
            }

            const responseData = await response.json();
            console.log('[AihubmixService convertToSticker] Response data:', responseData);

            if (!responseData.success || !responseData.taskId) {
                console.error('[AihubmixService convertToSticker] Invalid response format:', responseData);
                throw new Error(`任务提交失败: ${responseData.error || '未知错误'}`);
            }

            const taskId = responseData.taskId;
            console.log('[AihubmixService convertToSticker] Task submitted with ID:', taskId);

            // 任务提交进度
            onProgress?.(30);

            // 第二步：轮询任务状态
            return await this.pollTaskStatus(taskId, onProgress);

        } catch (error: any) {
            console.error('[AihubmixService convertToSticker] Error in method:', error);
            const errorMessage = error.message || '贴纸转换过程中发生未知错误。';
            return Promise.reject(new Error(errorMessage));
        }
    }

    /**
     * 轮询任务状态直到完成
     * @param taskId 任务ID
     * @param onProgress 进度回调
     * @returns 处理完成的图像URL
     */
    private async pollTaskStatus(taskId: string, onProgress?: (progress: number) => void): Promise<string> {
        const maxAttempts = 60; // 最多轮询60次
        const pollInterval = 2000; // 每2秒轮询一次
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                console.log(`[AihubmixService pollTaskStatus] Polling attempt ${attempts + 1}/${maxAttempts} for task ${taskId}`);
                
                const statusResponse = await fetch(`/.netlify/functions/aihubmix-status?taskId=${taskId}`);
                
                if (!statusResponse.ok) {
                    console.error('[AihubmixService pollTaskStatus] Status check failed:', statusResponse.status);
                    throw new Error(`状态查询失败，状态码 ${statusResponse.status}`);
                }

                const statusData = await statusResponse.json();
                console.log('[AihubmixService pollTaskStatus] Status data:', statusData);

                // 更新进度
                const progressValue = 30 + (attempts / maxAttempts) * 60; // 30% 到 90%
                onProgress?.(Math.min(progressValue, 90));

                switch (statusData.status) {
                    case 'completed':
                        if (statusData.imageUrl) {
                            console.log('[AihubmixService pollTaskStatus] Task completed successfully. Image URL:', statusData.imageUrl);
                            onProgress?.(100);
                            return statusData.imageUrl;
                        } else {
                            throw new Error('任务完成但未返回图像URL');
                        }

                    case 'failed':
                        const errorMsg = statusData.error || '任务处理失败';
                        console.error('[AihubmixService pollTaskStatus] Task failed:', errorMsg);
                        throw new Error(`图像处理失败: ${errorMsg}`);

                    case 'pending':
                    case 'processing':
                        console.log(`[AihubmixService pollTaskStatus] Task status: ${statusData.status}, continuing to poll...`);
                        break;

                    default:
                        console.warn('[AihubmixService pollTaskStatus] Unknown task status:', statusData.status);
                        break;
                }

                attempts++;
                
                // 如果不是最后一次尝试，等待后继续
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }

            } catch (error: any) {
                console.error('[AihubmixService pollTaskStatus] Error during polling:', error);
                
                // 如果是网络错误，继续尝试
                if (attempts < maxAttempts - 1) {
                    console.log('[AihubmixService pollTaskStatus] Retrying after error...');
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                    continue;
                } else {
                    throw error;
                }
            }
        }

        // 超时
        throw new Error('图像处理超时，请稍后重试');
    }

    public async compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
        console.warn('AihubmixService.compressImage: This service does not currently implement image compression. Returning original image.');
        // 为了符合接口，maxWidth 和 quality 参数在此处未使用，但已接收
        // 如果将来需要实现压缩，可以在这里添加逻辑
        return Promise.resolve(dataUrl);
    }
}

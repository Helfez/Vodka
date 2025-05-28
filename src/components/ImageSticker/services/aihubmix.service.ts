// 辅助函数：将 File 对象转换为 Base64 字符串
// const fileToBase64 = (file: File): Promise<string> => {
//     return new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.readAsDataURL(file);
//         reader.onload = () => resolve(reader.result as string);
//         reader.onerror = error => reject(error);
//     });
// };

// Constants for polling
const POLLING_INTERVAL_MS = 3000; // 3 seconds
const MAX_POLLING_ATTEMPTS = 20; // 20 attempts * 3s = 60 seconds timeout

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

    private async _pollForTaskCompletion(taskId: string, onProgress?: (progress: number) => void): Promise<string> {
        let attempts = 0;
        while (attempts < MAX_POLLING_ATTEMPTS) {
            attempts++;
            
            // 计算进度：20% (任务创建) + 60% (轮询过程) + 20% (完成)
            const pollingProgress = 20 + (attempts / MAX_POLLING_ATTEMPTS) * 60;
            onProgress?.(Math.min(pollingProgress, 80));
            
            console.log(`[AihubmixService _pollForTaskCompletion] Polling attempt ${attempts} for taskId: ${taskId}`);
            try {
                const response = await fetch(`/.netlify/functions/aihubmix-status?taskId=${taskId}`);
                
                if (!response.ok) {
                    // If status function itself returns an error (e.g., 404 if task ID is wrong initially, or 500)
                    const errorData = await response.json().catch(() => ({ message: 'Failed to parse status error response' }));
                    console.error(`[AihubmixService _pollForTaskCompletion] Error fetching status for ${taskId}: ${response.status}`, errorData);
                    // Depending on the error, we might want to retry or fail fast.
                    // For a 404, it might mean the task wasn't created properly or the ID is wrong.
                    if (response.status === 404) {
                        throw new Error(`任务 (ID: ${taskId}) 未找到。可能尚未创建或ID错误。`);
                    }
                    // For other server errors, retry a few times.
                    if (attempts >= MAX_POLLING_ATTEMPTS) {
                         throw new Error(`获取任务状态失败 (ID: ${taskId})，状态码: ${response.status}. ${errorData.error || errorData.message}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
                    continue; // Retry
                }

                const statusData = await response.json();
                console.log(`[AihubmixService _pollForTaskCompletion] Status for ${taskId}:`, statusData);

                switch (statusData.status) {
                    case 'completed':
                        if (!statusData.imageUrl) {
                            console.error(`[AihubmixService _pollForTaskCompletion] Task ${taskId} completed but imageUrl missing.`);
                            throw new Error(`任务 ${taskId} 已完成，但图片URL丢失。`);
                        }
                        console.log(`[AihubmixService _pollForTaskCompletion] Task ${taskId} completed successfully. Image URL: ${statusData.imageUrl}`);
                        onProgress?.(100);
                        return statusData.imageUrl;
                    case 'failed':
                        console.error(`[AihubmixService _pollForTaskCompletion] Task ${taskId} failed:`, statusData.error);
                        throw new Error(`图像处理失败 (任务ID: ${taskId}): ${statusData.error || '未知错误'}`);
                    case 'pending':
                    case 'processing': // Assuming 'processing' could be another intermediate state
                        // Task is still processing, wait and poll again
                        if (attempts >= MAX_POLLING_ATTEMPTS) {
                            console.warn(`[AihubmixService _pollForTaskCompletion] Task ${taskId} timed out after ${attempts} attempts.`);
                            throw new Error(`图像处理超时 (任务ID: ${taskId})。`);
                        }
                        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
                        break; // Continue to next iteration of the while loop
                    default:
                        console.warn(`[AihubmixService _pollForTaskCompletion] Unknown status for ${taskId}: ${statusData.status}`);
                        // Treat unknown status as a temporary issue and retry, or fail if attempts exhausted
                        if (attempts >= MAX_POLLING_ATTEMPTS) {
                            throw new Error(`收到未知的任务状态 (ID: ${taskId}): ${statusData.status}`);
                        }
                        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
                        break;
                }
            } catch (error: any) {
                // This catches network errors during fetch or errors from JSON parsing if not caught earlier
                console.error(`[AihubmixService _pollForTaskCompletion] Error during polling for ${taskId} (attempt ${attempts}):`, error);
                if (attempts >= MAX_POLLING_ATTEMPTS) {
                    throw new Error(`轮询任务状态时发生错误 (ID: ${taskId}): ${error.message}`);
                }
                // Wait before retrying on generic errors too
                await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
            }
        }
        // Should not be reached if MAX_POLLING_ATTEMPTS is effective in all paths
        throw new Error(`图像处理已达到最大轮询次数但仍未完成 (任务ID: ${taskId})。`);
    }

    /**
     * Initiates image processing (e.g., remove background) by calling the aihubmix-proxy,
     * then polls for completion and returns the URL of the processed image.
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
            // Default size and n can be set here or in the proxy/background function
            // For now, let's assume proxy/background handles defaults if not provided.
        };
        if (prompt) {
            requestBody.prompt = prompt;
        }

        console.debug('[AihubmixService convertToSticker] Sending to proxy with body keys:', Object.keys(requestBody));

        try {
            // 初始进度
            onProgress?.(10);

            const initialResponse = await fetch('/.netlify/functions/aihubmix-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log('[AihubmixService convertToSticker] Raw initial response from proxy:', initialResponse);

            if (initialResponse.status === 202) {
                const responseData = await initialResponse.json();
                console.log('[AihubmixService convertToSticker] Parsed 202 JSON response from proxy:', responseData);
                if (responseData && responseData.taskId) {
                    console.log(`[AihubmixService convertToSticker] Task ${responseData.taskId} accepted. Starting to poll.`);
                    // 任务创建成功
                    onProgress?.(20);
                    // Start polling for the result with progress callback
                    return await this._pollForTaskCompletion(responseData.taskId, onProgress);
                } else {
                    console.error('[AihubmixService convertToSticker] Proxy returned 202 but taskId missing:', responseData);
                    throw new Error('代理接受了请求，但未返回任务ID。');
                }
            } else {
                // Handle other non-202 responses as errors (e.g., 400, 500 from the proxy itself)
                const errorData = await initialResponse.json().catch(() => ({ message: 'Failed to parse error response from proxy on non-202 status' }));
                console.error('[AihubmixService convertToSticker] Proxy error response (non-202):', initialResponse.status, errorData);
                throw new Error(`代理API请求失败，状态码 ${initialResponse.status}: ${errorData.error || errorData.message || '未知代理错误'}`);
            }

        } catch (error: any) {
            console.error('[AihubmixService convertToSticker] Error in method:', error);
            const errorMessage = error.message || '贴纸转换过程中发生未知错误。';
            return Promise.reject(new Error(errorMessage)); // Ensure a Promise.reject for proper error handling
        }
    }

    public async compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
        console.warn('AihubmixService.compressImage: This service does not currently implement image compression. Returning original image.');
        // 为了符合接口，maxWidth 和 quality 参数在此处未使用，但已接收
        // 如果将来需要实现压缩，可以在这里添加逻辑
        return Promise.resolve(dataUrl);
    }
}

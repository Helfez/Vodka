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
     * 直接处理图像（同步方式），避免复杂的异步轮询
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

        console.debug('[AihubmixService convertToSticker] Sending to simple function with body keys:', Object.keys(requestBody));

        try {
            // 初始进度
            onProgress?.(10);

            console.log('[AihubmixService convertToSticker] Calling aihubmix-simple function...');
            
            const response = await fetch('/.netlify/functions/aihubmix-simple', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log('[AihubmixService convertToSticker] Response status:', response.status);

            // 处理中进度
            onProgress?.(50);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
                console.error('[AihubmixService convertToSticker] API error response:', response.status, errorData);
                throw new Error(`API请求失败，状态码 ${response.status}: ${errorData.error || errorData.message || '未知错误'}`);
            }

            const responseData = await response.json();
            console.log('[AihubmixService convertToSticker] Response data:', responseData);

            // 完成进度
            onProgress?.(90);

            if (responseData.success && responseData.imageUrl) {
                console.log('[AihubmixService convertToSticker] Image processing completed successfully. Image URL:', responseData.imageUrl);
                onProgress?.(100);
                return responseData.imageUrl;
            } else {
                console.error('[AihubmixService convertToSticker] Unexpected response format:', responseData);
                throw new Error(`处理失败: ${responseData.error || '未知错误'}`);
            }

        } catch (error: any) {
            console.error('[AihubmixService convertToSticker] Error in method:', error);
            const errorMessage = error.message || '贴纸转换过程中发生未知错误。';
            return Promise.reject(new Error(errorMessage));
        }
    }

    public async compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
        console.warn('AihubmixService.compressImage: This service does not currently implement image compression. Returning original image.');
        // 为了符合接口，maxWidth 和 quality 参数在此处未使用，但已接收
        // 如果将来需要实现压缩，可以在这里添加逻辑
        return Promise.resolve(dataUrl);
    }
}

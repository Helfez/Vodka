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
     * Calls the aihubmix-proxy to process an image (e.g., remove background) using its Base64 data.
     * @param imageBase64 The Base64 encoded string of the image to be processed.
     * @param prompt Optional prompt for the Aihubmix API.
     * @returns A promise that resolves to the URL of the processed image from Cloudinary.
     */
    public async convertToSticker(imageBase64: string, prompt?: string): Promise<string> {
        console.log('[AihubmixService convertToSticker] Called with imageBase64 (first 50 chars):', imageBase64.substring(0, 50));

        if (!imageBase64 || typeof imageBase64 !== 'string') {
            console.error('[AihubmixService convertToSticker] Invalid imageBase64 provided.');
            throw new Error('无效的图像Base64编码。');
        }

        // Remove potential data URI scheme prefix (e.g., "data:image/png;base64,") if present
        const base64Data = imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64;

        const requestBody: { image_base64: string; prompt?: string } = { 
            image_base64: base64Data 
        };
        if (prompt) {
            requestBody.prompt = prompt;
        }

        console.debug('[AihubmixService convertToSticker] Sending to proxy with body keys:', Object.keys(requestBody));

        try {
            const response = await fetch('/.netlify/functions/aihubmix-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log('[AihubmixService convertToSticker] Raw response from proxy:', response);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response from proxy' }));
                console.error('[AihubmixService convertToSticker] Proxy error response:', response.status, errorData);
                throw new Error(`Aihubmix proxy API request failed with status ${response.status}: ${errorData.error || errorData.message || 'Unknown error'}`);
            }

            const responseData = await response.json();
            console.log('[AihubmixService convertToSticker] Parsed JSON response from proxy:', responseData);

            if (responseData && responseData.processedImageUrl) {
                const processedCloudinaryUrl = responseData.processedImageUrl;
                console.log('[AihubmixService convertToSticker] Processed image URL from proxy (Cloudinary):', processedCloudinaryUrl);
                
                // The URL from the proxy is already the final Cloudinary URL, no need for further proxying here.
                return processedCloudinaryUrl; 
            } else {
                console.error('[AihubmixService convertToSticker] Unexpected response structure or missing processedImageUrl from proxy:', responseData);
                throw new Error('Unexpected response structure or missing processedImageUrl from Aihubmix proxy.');
            }
        } catch (error: any) {
            console.error('[AihubmixService convertToSticker] Error in method:', error);
            const errorMessage = error.message || 'An unknown error occurred during sticker conversion.';
            // Ensure a Promise.reject is returned for proper error handling by the caller
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

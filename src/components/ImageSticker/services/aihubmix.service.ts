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
     * Calls the aihubmix-proxy to process an image (e.g., remove background) using its public URL.
     * @param imageUrl The publicly accessible URL of the image to be processed.
     * @returns A promise that resolves to the URL of the processed image.
     */
    public async convertToSticker(imageUrl: string): Promise<string> {
        console.log('[AihubmixService convertToSticker] Called with image URL:', imageUrl);

        if (!imageUrl || typeof imageUrl !== 'string' || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
            console.error('[AihubmixService convertToSticker] Invalid image URL provided:', imageUrl);
            throw new Error('无效的图像URL。必须是一个有效的HTTP或HTTPS URL。');
        }

        const requestBody = { imageUrl };
        console.debug('[AihubmixService convertToSticker] Sending to proxy with body:', JSON.stringify(requestBody));

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
                let originalImageUrl = responseData.processedImageUrl;
                console.log('[AihubmixService convertToSticker] Processed image URL from proxy:', originalImageUrl);

                let finalStickerUrl = originalImageUrl;
                if (originalImageUrl.startsWith('http://ideogram.ai/') || originalImageUrl.startsWith('https://ideogram.ai/')) {
                    finalStickerUrl = `/.netlify/functions/image-proxy?url=${encodeURIComponent(originalImageUrl)}`;
                    console.log('[AihubmixService convertToSticker] Proxied image URL for return (ideogram):', finalStickerUrl);
                } else {
                    console.log('[AihubmixService convertToSticker] Using direct URL from proxy:', originalImageUrl);
                }
                
                return finalStickerUrl; 
            } else {
                console.error('[AihubmixService convertToSticker] Unexpected response structure or missing processedImageUrl from proxy:', responseData);
                throw new Error('Unexpected response structure or missing processedImageUrl from Aihubmix proxy.');
            }
        } catch (error: any) {
            console.error('[AihubmixService convertToSticker] Error in method:', error);
            const errorMessage = error.message || 'An unknown error occurred during sticker conversion.';
            return Promise.reject(errorMessage);
        }
    }

    public async compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
        console.warn('AihubmixService.compressImage: This service does not currently implement image compression. Returning original image.');
        // 为了符合接口，maxWidth 和 quality 参数在此处未使用，但已接收
        // 如果将来需要实现压缩，可以在这里添加逻辑
        return Promise.resolve(dataUrl);
    }
}

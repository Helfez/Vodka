import axios from 'axios';
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

    public async convertToSticker(imageUrl: string): Promise<string> {
        console.log('convertToSticker 调用，图片 data URL 长度:', imageUrl.length);

        try {
            // imageUrl 是 data URL, 例如: "data:image/png;base64,iVBORw0KGgo..."
            // 我们需要提取 base64 部分给代理
            const base64Data = imageUrl.split(';base64,').pop();
            if (!base64Data) {
                console.error('无法从 imageUrl 提取 base64 数据:', imageUrl.substring(0, 100));
                throw new Error('无效的图像 data URL 格式。');
            }
            console.log('从 imageUrl 提取的 base64 数据长度:', base64Data.length);

            // 为 fileName 提供一个默认值，因为我们不再有 File 对象
            const defaultFileName = 'image.png'; 

            const response = await fetch('/.netlify/functions/aihubmix-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageData: base64Data, // 使用提取的 base64 数据
                    fileName: defaultFileName, // 使用默认文件名
                }),
            });

            console.log('从 /.netlify/functions/aihubmix-proxy 获得的原始响应:', response);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '无法从代理服务解析错误响应' }));
                console.error('aihubmix-proxy 云函数错误响应:', response.status, errorData);
                throw new Error(`Aihubmix 代理 API 请求失败，状态码 ${response.status}: ${errorData.error || errorData.message || '未知错误'}`);
            }

            const responseData = await response.json();
            console.log('从 aihubmix-proxy 解析后的 JSON 响应:', responseData);

            if (responseData && responseData.data && responseData.data[0] && responseData.data[0].url) {
                let originalImageUrl = responseData.data[0].url;
                console.log('从 Aihubmix 获取的原始图片 URL:', originalImageUrl);

                let processedImageUrl = originalImageUrl;
                // 确保只代理 ideogram.ai 的 URL
                if (originalImageUrl.startsWith('http://ideogram.ai/') || originalImageUrl.startsWith('https://ideogram.ai/')) {
                    processedImageUrl = `/.netlify/functions/image-proxy?url=${encodeURIComponent(originalImageUrl)}`;
                    console.log('用于返回的代理图片 URL:', processedImageUrl);
                } else {
                    console.warn('收到的 URL 不是来自 ideogram.ai，将直接使用:', originalImageUrl);
                }
                
                return processedImageUrl; // 返回处理后的图片 URL 字符串
            } else {
                console.error('通过代理从 Aihubmix API 获取的响应结构异常:', responseData);
                throw new Error('通过代理从 Aihubmix API 获取的响应结构异常。');
            }
        } catch (error) {
            console.error('convertToSticker 方法出错:', error);
            // @ts-ignore
            const errorMessage = error.message || '抠图转换过程中发生未知错误。';
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

import { PhotoEffect } from './PhotoEffect/PhotoEffect';
import { PhotoEffectOptions } from './PhotoEffect/photo.types';

interface ProcessedImage {
  dataUrl: string;
  width: number;
  height: number;
  effectOptions?: Partial<PhotoEffectOptions>;
}

interface ImageProcessorOptions {
  maxWidth: number;
  maxHeight: number;
  rotation: number;
  effectOptions?: Partial<PhotoEffectOptions>;
}

export class ImageProcessor {
  // 检查WebP支持
  private static checkWebPSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const webP = new Image();
      webP.onload = () => resolve(true);
      webP.onerror = () => resolve(false);
      webP.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    });
  }
  private static getRandomRotation(): number {
    return PhotoEffect.getRandomRotation();
  }

  static async processImage(
    file: File,
    options: Partial<ImageProcessorOptions> = {}
  ): Promise<ProcessedImage> {
    // 如果是WebP格式，先检查浏览器支持
    if (file.type === 'image/webp') {
      const isWebPSupported = await this.checkWebPSupport();
      if (!isWebPSupported) {
        throw new Error('当前浏览器不支持WebP格式');
      }
    }
    const {
      maxWidth = 200,
      maxHeight = 200,
      rotation = this.getRandomRotation()
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('无法创建canvas上下文'));
          return;
        }

        // 计算缩放比例
        let scale = 1;
        if (img.width > maxWidth || img.height > maxHeight) {
          scale = Math.min(
            maxWidth / img.width,
            maxHeight / img.height
          );
        }

        // 计算缩放后的尺寸
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        // 设置canvas尺寸为缩放后的尺寸
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;

        // 在canvas中心点绘制旋转的图片
        ctx.save();
        ctx.translate(scaledWidth / 2, scaledHeight / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(
          img,
          -scaledWidth / 2,
          -scaledHeight / 2,
          scaledWidth,
          scaledHeight
        );
        ctx.restore();

        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: scaledWidth,
          height: scaledHeight
        });
      };

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };

      reader.readAsDataURL(file);
    });
  }
}

export type { ProcessedImage, ImageProcessorOptions };

import * as fabric from 'fabric';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { PhotoStyle, PhotoAnimation, PhotoEffectOptions } from './photo.types';

export class PhotoEffect {
  private static readonly DEFAULT_OPTIONS: PhotoEffectOptions = {
    style: {
      border: {
        width: 14,
        color: '#faf7f2'  // 暖米白色边框
      },
      shadow: {
        blur: 18,
        spread: 6,
        color: 'rgba(139, 90, 60, 0.2)'  // 暖棕色阴影
      },
      background: {
        color: '#fefcf8'  // 温暖的米白色背景
      }
    },
    animation: {
      initial: {
        scale: 0.6,
        opacity: 0,
        rotation: -25
      },
      final: {
        scale: 1,
        opacity: 1,
        rotation: 0
      },
      duration: 1400,
      easing: 'easeOutBack'
    }
  };

  private static applyStyle(image: fabric.Image, style: PhotoStyle): void {
    const { border, shadow, background } = style;

    // 设置边框和背景
    image.set({
      stroke: border.color,
      strokeWidth: border.width,
      strokeUniform: true,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      backgroundColor: background.color,
      selectable: false,
      hasControls: false,
      evented: false
    });

    // 设置阴影
    if (shadow) {
      image.set({
        shadow: new fabric.Shadow({
          color: shadow.color,
          blur: shadow.blur,
          offsetX: shadow.spread,
          offsetY: shadow.spread
        })
      });
    }
  }

  static applyPhotoEffect(
    fabricImage: fabric.Image,
    options: Partial<PhotoEffectOptions> = {}
  ): void {
    const finalOptions = {
      ...this.DEFAULT_OPTIONS,
      ...options
    } as PhotoEffectOptions;

    const { style, animation } = finalOptions;
    const canvas = fabricImage.canvas;
    if (!canvas) return;

    // 应用样式
    this.applyStyle(fabricImage, style);

    // 保存当前的缩放比例，基于此进行动画
    const currentScaleX = fabricImage.scaleX || 1;
    const currentScaleY = fabricImage.scaleY || 1;

    // 设置初始状态 - 基于当前scale进行动画
    const randomRotation = Math.random() * 6 - 3; // -3 到 3 度的随机旋转
    fabricImage.set({
      scaleX: currentScaleX * animation.initial.scale,
      scaleY: currentScaleY * animation.initial.scale,
      opacity: animation.initial.opacity,
      angle: animation.initial.rotation + randomRotation
    });

    // 🔥 修复：检查图片是否已经在画布中，避免重复添加
    const isImageInCanvas = canvas.getObjects().indexOf(fabricImage) !== -1;
    if (!isImageInCanvas) {
      console.log('[PhotoEffect] Adding image to canvas');
      canvas.add(fabricImage);
    } else {
      console.log('[PhotoEffect] Image already in canvas, skipping add');
    }

    // 应用动画 - 动画到当前scale
    fabricImage.animate({
      scaleX: currentScaleX * animation.final.scale,
      scaleY: currentScaleY * animation.final.scale,
      opacity: animation.final.opacity,
      angle: animation.final.rotation + randomRotation
    }, {
      duration: animation.duration,
      easing: fabric.util.ease[animation.easing as keyof typeof fabric.util.ease],
      onChange: () => {
        canvas.renderAll();
      }
    });
  }

  static getRandomRotation(): number {
    return Math.random() * 6 - 3; // -3 到 3 度的随机旋转
  }
}

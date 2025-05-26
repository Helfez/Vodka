import * as fabric from 'fabric';
import type { PhotoStyle, PhotoAnimation, PhotoEffectOptions } from './photo.types';

export class PhotoEffect {
  private static readonly DEFAULT_OPTIONS: PhotoEffectOptions = {
    style: {
      border: {
        width: 12,
        color: '#ffffff'
      },
      shadow: {
        blur: 15,
        spread: 8,
        color: 'rgba(0,0,0,0.25)'
      },
      background: {
        color: '#fdfbf7'
      }
    },
    animation: {
      initial: {
        scale: 0.7,
        opacity: 0,
        rotation: -20
      },
      final: {
        scale: 1,
        opacity: 1,
        rotation: 0
      },
      duration: 1200,
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

    // 设置初始状态
    const randomRotation = Math.random() * 6 - 3; // -3 到 3 度的随机旋转
    fabricImage.set({
      scaleX: animation.initial.scale,
      scaleY: animation.initial.scale,
      opacity: animation.initial.opacity,
      angle: animation.initial.rotation + randomRotation
    });

    // 添加到画布
    canvas.add(fabricImage);

    // 应用动画
    fabricImage.animate({
      scaleX: animation.final.scale,
      scaleY: animation.final.scale,
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

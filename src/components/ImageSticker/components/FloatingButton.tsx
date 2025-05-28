import React from 'react';
import * as fabric from 'fabric';
import { FloatingButtonPosition } from '../services/types';
import { ImageServiceFactory } from '../services/image-service.factory';
import ProcessingOverlay from './ProcessingOverlay';
import { useAsyncTask } from '../hooks/useAsyncTask';
import './FloatingButton/FloatingButton.css';

/**
 * 浮动按钮组件 - 显示在图像上方的贴纸转换按钮
 */
interface FloatingButtonProps {
  position: FloatingButtonPosition;
  onConvert: (imageUrl: string) => void;
  onClose: () => void;
  targetImage: fabric.Image;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({
  position,
  onConvert,
  onClose,
  targetImage
}) => {
  const { state, execute, reset, setProgress } = useAsyncTask<string>();

  const handleConvertClick = async () => {
    if (!targetImage) {
      console.error('FloatingButton: Target image is not available for conversion.');
      return;
    }

    const fabricCanvas = targetImage.canvas;
    if (!fabricCanvas) {
      console.error('FloatingButton: Fabric canvas is not available.');
      return;
    }

    const imageDataUrl = targetImage.toDataURL({
      format: 'png',
      quality: 1,
    });

    if (!imageDataUrl) {
      console.error('FloatingButton: Could not get image data URL from target image.');
      return;
    }

    const stickerService = ImageServiceFactory.getService('aihubmix');

    const result = await execute(async () => {
      console.log('[FloatingButton] Calling convertToSticker...');
      const processedImageUrl = await stickerService.convertToSticker(
        imageDataUrl, 
        undefined, // prompt
        (progress) => {
          // 实时更新进度
          setProgress(progress);
        }
      );
      console.log('[FloatingButton] convertToSticker successful, URL:', processedImageUrl);
      return processedImageUrl;
    });

    if (result) {
      // 创建新的图片元素来替换原图片
      const newImg = new Image();
      newImg.onload = () => {
        // 获取原图片的位置和尺寸
        const originalLeft = targetImage.left;
        const originalTop = targetImage.top;
        const originalScaleX = targetImage.scaleX;
        const originalScaleY = targetImage.scaleY;
        const originalAngle = targetImage.angle;
        
        // 创建新的Fabric图片对象
        const newFabricImage = new fabric.Image(newImg, {
          left: originalLeft,
          top: originalTop,
          scaleX: originalScaleX,
          scaleY: originalScaleY,
          angle: originalAngle,
          selectable: true,
          hasControls: true,
          evented: true
        });
        
        // 移除原图片
        fabricCanvas.remove(targetImage);
        
        // 添加新图片
        fabricCanvas.add(newFabricImage);
        fabricCanvas.renderAll();
        
        console.log('[FloatingButton] Image replaced successfully');
        
        // 调用onConvert回调并关闭按钮
        onConvert(result);
        onClose();
      };
      
      newImg.onerror = () => {
        console.error('[FloatingButton] Failed to load processed image');
      };
      
      newImg.src = result;
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div
      className="floating-button-container"
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
      }}
    >
      {state.isLoading ? (
        <ProcessingOverlay progress={state.progress} width={120} height={40} />
      ) : state.error ? (
        <div className="error-message-sticker">
          <p>{state.error}</p>
          <button onClick={reset} className="ok-button">重试</button>
          <button onClick={handleClose} className="ok-button">关闭</button>
        </div>
      ) : (
        <div className="button-group-sticker">
          <button onClick={handleConvertClick} className="sticker-button">
            抠图
          </button>
          <button onClick={handleClose} className="close-button-sticker">
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

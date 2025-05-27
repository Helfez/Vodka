import React, { useState } from 'react';
import * as fabric from 'fabric';
import { FloatingButtonPosition } from '../services/types';
import { ImageServiceFactory } from '../services/image-service.factory';
import ProcessingOverlay from './ProcessingOverlay';
import { CloudinaryService } from '../services/CloudinaryService';

interface FloatingButtonProps {
  position: FloatingButtonPosition;
  onConvert: () => void;
  onClose: () => void;
}

/**
 * 浮动按钮组件 - 显示在图像上方的贴纸转换按钮
 */
export const FloatingButton: React.FC<FloatingButtonProps> = ({
  position,
  onConvert,
  onClose
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // 获取图像的dataURL
  const getImageDataUrl = (): string => {
    if (!position.target) return '';
    
    try {
      // 使用fabric的toDataURL方法获取图像
      const fabricCanvas = position.target.canvas;
      if (!fabricCanvas) {
        console.error('无法获取fabric画布');
        return '';
      }
      
      // 创建临时canvas来获取单个图像
      const tempCanvas = document.createElement('canvas');
      const obj = position.target;
      
      // 设置canvas尺寸
      const width = obj.width * (obj.scaleX || 1);
      const height = obj.height * (obj.scaleY || 1);
      tempCanvas.width = width;
      tempCanvas.height = height;
      
      // 获取context
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return '';
      
      // 获取原始图像元素
      const imgElement = obj.getElement ? obj.getElement() : null;
      if (!imgElement) {
        console.error('无法获取图像元素');
        return '';
      }
      
      // 绘制图像
      ctx.drawImage(
        imgElement, 
        0, 0, 
        width, 
        height
      );
      
      // 返回URL
      return tempCanvas.toDataURL('image/png');
    } catch (error) {
      console.error('获取图像数据失败:', error);
      return '';
    }
  };
  
  // 更新进度
  const updateProgress = () => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 1;
      if (currentProgress > 95) {
        clearInterval(interval);
        return;
      }
      setProgress(currentProgress);
    }, 300);
    return interval;
  };
  
  // 处理贴纸转换
  const handleStickerConvert = async () => {
    if (!position.target || !position.target.canvas) return;
    
    try {
      // 开始处理
      setIsProcessing(true);
      setProgress(0);
      setError(null);
      
      // 获取图像数据
      const imageUrl = getImageDataUrl();
      console.debug('[FloatingButton] Initial image data URL (length):', imageUrl ? imageUrl.length : 'null');
      if (!imageUrl) {
        throw new Error('无法获取图像数据');
      }

      // Convert data URL to File object
      const imageFile = CloudinaryService.dataURLtoFile(imageUrl, `sticker_${Date.now()}.png`);
      console.debug('[FloatingButton] Converted imageFile:', imageFile ? { name: imageFile.name, size: imageFile.size, type: imageFile.type } : 'null');
      if (!imageFile) {
        throw new Error('无法将图像数据转换为文件格式');
      }
      
      // 设置图像为不可选中状态
      position.target.set({
        selectable: false,
        evented: false
      });
      position.target.canvas.renderAll();
      
      // 开始进度更新
      const progressInterval = updateProgress();
      
      // 获取图像处理服务
      const imageService = ImageServiceFactory.getService('aihubmix');
      
      // Upload image to Cloudinary
      console.log('[FloatingButton] Uploading image to Cloudinary...');
      setProgress(20); // Update progress for upload step
      
      console.log('[FloatingButton] Preparing to upload. ImageFile name:', imageFile ? imageFile.name : 'null', 'type:', imageFile ? imageFile.type : 'null');
      const cloudinaryUploadResult = await CloudinaryService.uploadImage(imageFile);
      console.log('[FloatingButton] CloudinaryService.uploadImage RAW RESULT:', cloudinaryUploadResult);
      console.log('[FloatingButton] CloudinaryService.uploadImage RAW RESULT typeof:', typeof cloudinaryUploadResult);

      const cloudinaryUrl = cloudinaryUploadResult; // Explicitly assign after logging

      console.log('[FloatingButton] Value assigned to cloudinaryUrl after upload:', cloudinaryUrl);
      setProgress(50); // Update progress after upload
      
      // 调用服务转换贴纸 (using Cloudinary URL)
      console.log('[FloatingButton] Calling convertToSticker with Cloudinary URL:', cloudinaryUrl);
      const stickerUrl = await imageService.convertToSticker(cloudinaryUrl);
      console.debug('[FloatingButton] Received sticker URL:', stickerUrl);
      
      // 替换为贴纸
      await replaceWithSticker(stickerUrl);
      
      // 清理
      clearInterval(progressInterval);
      setProgress(100);
      
      // 显示完成状态，然后关闭浮动按钮
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 1000);
      
    } catch (error: any) {
      console.error('贴纸转换失败:', error);
      
      // 提供更友好的错误提示
      let errorMessage = '转换失败';
      if (error.message) {
        if (error.message.includes('API2D服务无响应')) {
          errorMessage = '网络连接失败，请检查网络';
        } else if (error.message.includes('无法从响应中提取图片')) {
          errorMessage = '图片处理失败，请尝试其他图片';
        } else if (error.message.includes('API2D密钥')) {
          errorMessage = 'API密钥配置错误，请联系管理员';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      setIsProcessing(false);
      
      // 恢复图像可选中状态
      if (position.target && position.target.canvas) {
        position.target.set({
          selectable: true,
          evented: true
        });
        position.target.canvas.renderAll();
      }
      
      // 3秒后自动清除错误提示
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };
  
  // 替换为贴纸
  const replaceWithSticker = (stickerUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!position.target || !position.target.canvas) {
        reject(new Error('无效的图像或画布'));
        return;
      }
      
      const fabricCanvas = position.target.canvas;
      
      // 获取原图像属性
      const originalProps = {
        left: position.target.left,
        top: position.target.top,
        scaleX: position.target.scaleX || 1,
        scaleY: position.target.scaleY || 1,
        angle: position.target.angle || 0,
        originX: position.target.originX || 'center',
        originY: position.target.originY || 'center',
        flipX: position.target.flipX || false,
        flipY: position.target.flipY || false
      };
      
      // 创建新图像
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      img.onload = () => {
        try {
          // 创建新的fabric图像
          const fabricImage = new fabric.Image(img, {
            ...originalProps,
            selectable: true,
            hasControls: true,
            evented: true
          });
          
          // 移除原图像
          fabricCanvas.remove(position.target);
          
          // 添加新图像
          fabricCanvas.add(fabricImage);
          fabricCanvas.setActiveObject(fabricImage);
          fabricCanvas.renderAll();
          
          // 触发修改事件用于撤销
          if (typeof fabricCanvas.fire === 'function') {
            fabricCanvas.fire('object:modified');
          }
          
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = (error) => {
        reject(new Error('加载贴纸图像失败'));
      };
      
      img.src = stickerUrl;
    });
  };
  
  // 计算处理覆盖层的尺寸和位置
  const getOverlayDimensions = () => {
    if (!position.target) return { width: 0, height: 0 };
    
    const width = position.target.width * (position.target.scaleX || 1);
    const height = position.target.height * (position.target.scaleY || 1);
    
    return { width, height };
  };
  
  return (
    <>
      {!isProcessing ? (
        <div style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          display: 'flex',
          gap: '8px'
        }}>
          <button
            onClick={handleStickerConvert}
            style={{
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            贴纸化
          </button>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#f5f5f5',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            关闭
          </button>
        </div>
      ) : (
        position.target && (
          <div style={{
            position: 'absolute',
            left: `${position.target.left}px`,
            top: `${position.target.top}px`,
            transform: `translate(-50%, -50%) rotate(${position.target.angle || 0}deg)`,
            transformOrigin: 'center center',
            zIndex: 1000
          }}>
            <ProcessingOverlay 
              progress={progress} 
              {...getOverlayDimensions()}
            />
          </div>
        )
      )}
      
      {error && (
        <div style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y + 30}px`,
          transform: 'translate(-50%, 0)',
          backgroundColor: '#ffebee',
          color: '#d32f2f',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1001
        }}>
          {error}
        </div>
      )}
    </>
  );
};

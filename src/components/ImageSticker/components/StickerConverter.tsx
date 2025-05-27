import React, { useState } from 'react';
import { ImageServiceFactory } from '../services/image-service.factory';
import { CloudinaryService } from '../services/CloudinaryService';

interface StickerConverterProps {
  imageUrl: string;
  onConversionComplete: (stickerUrl: string) => void;
  onCancel: () => void;
}

/**
 * 贴纸转换组件 - 处理图像转换为贴纸的UI和逻辑
 */
const StickerConverter: React.FC<StickerConverterProps> = ({
  imageUrl,
  onConversionComplete,
  onCancel
}) => {
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 模拟进度更新
  const updateProgress = () => {
    const interval = setInterval(() => {
      setProgress(prev => {
        // 最多更新到90%，剩下的10%留给实际完成时
        const newProgress = prev + (90 - prev) * 0.1;
        return newProgress > 90 ? 90 : newProgress;
      });
    }, 1000);
    return interval;
  };

  const handleConvertClick = async () => {
    console.log('开始贴纸转换过程');
    setIsConverting(true);
    setError(null);
    setProgress(10);
    
    // 启动进度更新
    const progressInterval = updateProgress();
    
    try {
      console.log('原始图像 URL 长度:', imageUrl.length);
      console.log('原始图像 URL 前50个字符:', imageUrl.substring(0, 50) + '...');
      
      // 获取图像处理服务
      const imageService = ImageServiceFactory.getService('aihubmix');

      // Convert data URL to File object for Cloudinary upload
      // Assuming imageUrl is a data URL. If it's from a File input, this component should ideally receive the File object.
      const imageFile = CloudinaryService.dataURLtoFile(imageUrl, `sticker_upload_${Date.now()}.png`);
      console.debug('[StickerConverter] Converted imageFile:', imageFile ? { name: imageFile.name, size: imageFile.size, type: imageFile.type } : 'null');
      if (!imageFile) {
        throw new Error('无法将图像数据转换为文件格式以进行上传');
      }
      
      // Upload image to Cloudinary
      console.log('[StickerConverter] Uploading image to Cloudinary...');
      setProgress(20); // Or adjust progress steps as needed
      const cloudinaryUrl = await CloudinaryService.uploadImage(imageFile);
      console.log('[StickerConverter] Image uploaded to Cloudinary:', cloudinaryUrl);
      setProgress(50); // Or adjust progress steps

      // 调用服务转换贴纸
      console.log('[StickerConverter] 开始调用图像处理服务转换贴纸 (using Cloudinary URL)...', cloudinaryUrl);
      const stickerUrl = await imageService.convertToSticker(cloudinaryUrl);
      console.log('贴纸转换成功, 返回 URL 长度:', stickerUrl.length);
      console.debug('[StickerConverter] Received sticker URL:', stickerUrl);
      console.log('贴纸 URL 前50个字符:', stickerUrl.substring(0, 50) + '...');
      
      // 完成转换
      setProgress(100);
      console.log('调用转换完成回调...');
      onConversionComplete(stickerUrl);
    } catch (error: any) {
      console.error('贴纸转换过程出错:', error);
      console.error('[StickerConverter] Sticker conversion error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      // 提供更详细的错误信息
      let errorMessage = '转换失败，请重试';
      
      if (error.response) {
        // API响应中的错误
        console.error('API错误响应:', {
          status: error.response.status,
          data: error.response.data
        });
        errorMessage = `API错误 (${error.response.status}): ${error.response.data?.error?.message || '未知错误'}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setProgress(0);
    } finally {
      clearInterval(progressInterval);
      setIsConverting(false);
      console.log('贴纸转换过程结束');
    }
  };

  return (
    <div className="sticker-converter" style={{
      position: 'absolute',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
      zIndex: 1000,
      width: '300px'
    }}>
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 8px' }}>转换为贴纸</h3>
        <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
          将移除图像背景，只保留主体内容
        </p>
      </div>
      
      <div style={{ display: 'flex', marginBottom: '16px' }}>
        <div style={{ flex: 1, marginRight: '8px' }}>
          <img 
            src={imageUrl} 
            alt="原图" 
            style={{ 
              width: '100%', 
              height: 'auto', 
              borderRadius: '4px',
              border: '1px solid #eee'
            }} 
          />
          <p style={{ textAlign: 'center', margin: '4px 0', fontSize: '12px' }}>原图</p>
        </div>
        <div style={{ flex: 1, marginLeft: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          {isConverting ? (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px'
            }}>
              <div style={{ 
                width: '80%', 
                height: '8px', 
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${progress}%`, 
                  height: '100%', 
                  backgroundColor: '#2196F3',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <p style={{ fontSize: '12px', margin: '8px 0 0' }}>处理中...</p>
            </div>
          ) : (
            <>
              <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                border: '1px dashed #ccc'
              }}>
                <span style={{ fontSize: '12px', color: '#666' }}>贴纸预览</span>
              </div>
              <p style={{ textAlign: 'center', margin: '4px 0', fontSize: '12px' }}>贴纸</p>
            </>
          )}
        </div>
      </div>
      
      {error && (
        <div style={{ 
          padding: '8px', 
          backgroundColor: '#ffebee', 
          color: '#d32f2f',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button 
          onClick={onCancel}
          disabled={isConverting}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: isConverting ? 'not-allowed' : 'pointer',
            opacity: isConverting ? 0.7 : 1
          }}
        >
          取消
        </button>
        <button 
          onClick={handleConvertClick}
          disabled={isConverting}
          style={{
            padding: '8px 16px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConverting ? 'not-allowed' : 'pointer',
            opacity: isConverting ? 0.7 : 1
          }}
        >
          {isConverting ? '处理中...' : '开始转换'}
        </button>
      </div>
    </div>
  );
};

export default StickerConverter;

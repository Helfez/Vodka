import React, { useRef } from 'react';
import { ImageProcessor, ProcessedImage } from './ImageProcessor';
import { SUPPORTED_FORMATS } from './types/image.types';

interface ImageUploaderProps {
  onImageProcessed: (image: ProcessedImage) => void;
  children: React.ReactNode | ((triggerUpload: () => void) => React.ReactNode);
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageProcessed,
  children
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const validTypes = SUPPORTED_FORMATS.map(format => format.mime);
    if (!validTypes.includes(file.type)) {
      console.error(`不支持的文件类型，仅支持 ${SUPPORTED_FORMATS.map(f => f.description).join('、')}`);
      return;
    }

    try {
      const processedImage = await ImageProcessor.processImage(file);
      onImageProcessed(processedImage);
    } catch (error: any) {
      console.error('图片处理失败:', {
        message: error?.message || '未知错误',
        stack: error?.stack
      });
      alert(`图片处理失败: ${error?.message || '未知错误'}`);
    }

    // 清除input的值，这样相同的文件可以再次上传
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      {typeof children === 'function' ? (
        children(handleClick)
      ) : (
        <div onClick={handleClick} style={{ cursor: 'pointer' }}>
          {children}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".webp,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </>
  );
};

export default ImageUploader;

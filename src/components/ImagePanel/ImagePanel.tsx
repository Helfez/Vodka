import React, { useState } from 'react';
import './ImagePanel.css';
import { TripoService } from '../ImageSticker/services/tripo.service';

interface GeneratedImage {
  id: string;
  url: string;
  timestamp: number;
  prompt?: string;
}

interface ImagePanelProps {
  isOpen: boolean;
  generatedImages: GeneratedImage[];
  onImageDragToCanvas: (imageUrl: string) => void;
  onClose: () => void;
}

export const ImagePanel: React.FC<ImagePanelProps> = ({
  isOpen,
  generatedImages,
  onImageDragToCanvas,
  onClose
}) => {
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [tripoProgress, setTripoProgress] = useState<{
    isGenerating: boolean;
    progress: number;
    status: string;
    error?: string;
    modelUrl?: string;
  }>({
    isGenerating: false,
    progress: 0,
    status: ''
  });

  // 一键生成3D模型
  const handleGenerate3D = async (imageUrl: string, imageId: string) => {
    if (!imageUrl) {
      alert('请先选择一张图片');
      return;
    }

    setActiveImageId(imageId);
    setTripoProgress({
      isGenerating: true,
      progress: 0,
      status: '准备生成3D模型...',
      error: undefined,
      modelUrl: undefined
    });

    try {
      console.log('🎲 [ImagePanel] 开始生成3D模型:', imageUrl);

      // 将图片URL转换为base64（如果需要）
      let imageBase64 = imageUrl;
      if (!imageUrl.startsWith('data:')) {
        // 如果是URL，需要先获取图片数据
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        imageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const tripoService = TripoService.getInstance();
      
      // 设置进度回调
      const progressCallback = (progress: number) => {
        console.log(`📊 [ImagePanel] 3D生成进度: ${progress}%`);
        setTripoProgress(prev => ({
          ...prev,
          progress,
          status: `生成中... ${progress}%`
        }));
      };

      // 开始生成
      const result = await tripoService.imageToModel(
        imageBase64,
        {
          outputFormat: 'glb',
          removeBackground: true,
          foregroundRatio: 0.85,
          mcResolution: 256
        },
        progressCallback
      );

      console.log('✅ [ImagePanel] 3D模型生成完成:', result.modelUrl);

      setTripoProgress({
        isGenerating: false,
        progress: 100,
        status: '3D模型生成完成！',
        modelUrl: result.modelUrl
      });

      // 可以在这里添加下载或预览3D模型的功能

    } catch (error) {
      console.error('❌ [ImagePanel] 3D生成失败:', error);
      setTripoProgress({
        isGenerating: false,
        progress: 0,
        status: '',
        error: error instanceof Error ? error.message : '3D生成失败'
      });
    }
  };

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, imageUrl: string) => {
    e.dataTransfer.setData('text/plain', imageUrl);
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="image-panel">
      <div className="image-panel-header">
        <h3>🎨 生成图片</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="image-panel-content">
        {generatedImages.length === 0 ? (
          <div className="empty-state">
            <p>暂无生成的图片</p>
            <p>点击"🎨 生图"按钮开始创作</p>
          </div>
        ) : (
          <div className="images-grid">
            {generatedImages.map((image) => (
              <div 
                key={image.id} 
                className={`image-item ${activeImageId === image.id ? 'active' : ''}`}
              >
                <div className="image-container">
                  <img
                    src={image.url}
                    alt="Generated"
                    draggable
                    onDragStart={(e) => handleDragStart(e, image.url)}
                    onClick={() => onImageDragToCanvas(image.url)}
                    title="点击添加到画板或拖拽到指定位置"
                  />
                  <div className="image-overlay">
                    <button
                      className="add-to-canvas-btn"
                      onClick={() => onImageDragToCanvas(image.url)}
                      title="添加到画板"
                    >
                      📌
                    </button>
                  </div>
                </div>

                <div className="image-actions">
                  <button
                    className="generate-3d-btn"
                    onClick={() => handleGenerate3D(image.url, image.id)}
                    disabled={tripoProgress.isGenerating && activeImageId === image.id}
                  >
                    {tripoProgress.isGenerating && activeImageId === image.id ? 
                      '🔄 生成中...' : '🎲 生成3D'}
                  </button>
                </div>

                {/* 3D生成进度 */}
                {activeImageId === image.id && tripoProgress.isGenerating && (
                  <div className="progress-section">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${tripoProgress.progress}%` }}
                      ></div>
                    </div>
                    <p className="progress-text">{tripoProgress.status}</p>
                  </div>
                )}

                {/* 生成完成状态 */}
                {activeImageId === image.id && tripoProgress.modelUrl && (
                  <div className="success-section">
                    <p className="success-text">✅ 3D模型生成完成</p>
                    <a 
                      href={tripoProgress.modelUrl} 
                      download="model.glb"
                      className="download-btn"
                    >
                      📥 下载模型
                    </a>
                  </div>
                )}

                {/* 错误状态 */}
                {activeImageId === image.id && tripoProgress.error && (
                  <div className="error-section">
                    <p className="error-text">❌ {tripoProgress.error}</p>
                    <button 
                      className="retry-btn"
                      onClick={() => handleGenerate3D(image.url, image.id)}
                    >
                      🔄 重试
                    </button>
                  </div>
                )}

                {image.prompt && (
                  <div className="image-prompt">
                    <small>{image.prompt.substring(0, 100)}...</small>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 
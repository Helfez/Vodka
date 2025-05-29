import React, { useState, useCallback } from 'react';
import { AihubmixVisionService } from '../ImageSticker/services/aihubmix-vision.service';
import { AihubmixDalleService } from '../ImageSticker/services/aihubmix-dalle.service';
import './AIGenerationPanel.css';
import { getSystemPromptWithImage } from '../../config/ai-prompts';

interface AIGenerationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  canvasSnapshot: string; // base64 encoded canvas snapshot
  onImageGenerated: (imageUrl: string) => void;
}

export const AIGenerationPanel: React.FC<AIGenerationPanelProps> = ({
  isOpen,
  onClose,
  canvasSnapshot,
  onImageGenerated
}) => {
  const [generatedImages, setGeneratedImages] = useState<Array<{ url: string; revised_prompt?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [analysisPrompt, setAnalysisPrompt] = useState<string>(''); // 存储AI分析返回的生图prompt
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const visionService = AihubmixVisionService.getInstance();
  const dalleService = AihubmixDalleService.getInstance();

  // 硬编码的参考图片URL
  const REFERENCE_IMAGE_URL = 'https://res.cloudinary.com/dqs6g6vrd/image/upload/v1748501675/wechat_2025-05-28_153406_424_rhmgt4.png';

  // 加载参考图片为base64
  const loadReferenceImage = useCallback(async (): Promise<string | null> => {
    console.log('[AIGenerationPanel loadReferenceImage] 📸 开始加载参考图片...');
    
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          console.log('[AIGenerationPanel loadReferenceImage] ✅ 参考图片加载成功');
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            console.error('[AIGenerationPanel loadReferenceImage] ❌ 无法获取canvas context');
            resolve(null);
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          console.log('[AIGenerationPanel loadReferenceImage] 🔄 转换为base64完成，大小:', Math.round(base64.length / 1024), 'KB');
          resolve(base64);
        } catch (error) {
          console.error('[AIGenerationPanel loadReferenceImage] ❌ 转换base64失败:', error);
          resolve(null);
        }
      };

      img.onerror = (error) => {
        console.error('[AIGenerationPanel loadReferenceImage] ❌ 参考图片加载失败:', error);
        resolve(null);
      };

      img.src = REFERENCE_IMAGE_URL;
    });
  }, []);

  // 使用生成的图片
  const handleUseImage = useCallback((imageUrl: string) => {
    console.log('[AIGenerationPanel handleUseImage] === 图片使用流程开始 ===');
    console.log('[AIGenerationPanel handleUseImage] 🖼️ 选择的图片URL:', imageUrl.substring(0, 50) + '...');
    
    onImageGenerated(imageUrl);
    onClose();
    
    console.log('[AIGenerationPanel handleUseImage] ✅ 图片已传递给父组件');
    console.log('[AIGenerationPanel handleUseImage] 🔄 关闭AI生成面板');
    console.log('[AIGenerationPanel handleUseImage] === 图片使用流程完成 ===');
  }, [onImageGenerated, onClose]);

  // 一键生成功能
  const handleOneClickGenerate = useCallback(async () => {
    console.log('[AIGenerationPanel handleOneClickGenerate] === 一键生成流程开始 ===');
    
    if (!canvasSnapshot) {
      console.error('[AIGenerationPanel handleOneClickGenerate] ❌ 画板快照不可用');
      setError('请先获取画板快照');
      return;
    }

    console.log('[AIGenerationPanel handleOneClickGenerate] 📋 一键生成配置:');
    console.log('  - 快照大小:', Math.round(canvasSnapshot.length / 1024), 'KB');
    console.log('  - 使用固定System Prompt + 参考图片');

    setIsLoading(true);
    setError('');

    try {
      // 加载参考图片
      console.log('[AIGenerationPanel handleOneClickGenerate] 📸 加载参考图片...');
      const referenceImageBase64 = await loadReferenceImage();
      
      if (referenceImageBase64) {
        console.log('[AIGenerationPanel handleOneClickGenerate] ✅ 参考图片加载成功');
      } else {
        console.warn('[AIGenerationPanel handleOneClickGenerate] ⚠️ 参考图片加载失败，继续使用画板快照');
      }

      // 第一步：使用固定System Prompt分析图像
      console.log('[AIGenerationPanel handleOneClickGenerate] 📸 分析画板内容...');
      const analysisStartTime = performance.now();
      
      // 生成包含参考图片的systemPrompt
      const systemPromptWithImage = await getSystemPromptWithImage(REFERENCE_IMAGE_URL);
      
      const analysisResult = await visionService.analyzeImage(
        canvasSnapshot,
        systemPromptWithImage
      );

      const analysisEndTime = performance.now();
      const analysisTime = Math.round(analysisEndTime - analysisStartTime);
      
      console.log('[AIGenerationPanel handleOneClickGenerate] ✅ 分析完成:');
      console.log('  - 分析耗时:', analysisTime, 'ms');
      console.log('  - 优化prompt长度:', analysisResult.analysis.length, '字符');
      console.log('  - 优化prompt预览:', analysisResult.analysis.substring(0, 100) + '...');

      const optimizedPrompt = analysisResult.analysis;
      setAnalysisPrompt(optimizedPrompt); // 保存AI分析返回的prompt

      // 第二步：直接使用优化后的prompt生成图片
      console.log('[AIGenerationPanel handleOneClickGenerate] 🎨 使用优化prompt生成图片...');
      
      const generateStartTime = performance.now();
      
      const generationResult = await dalleService.generateImage(optimizedPrompt, {
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid"
      });

      const generateEndTime = performance.now();
      const generateTime = Math.round(generateEndTime - generateStartTime);
      
      console.log('[AIGenerationPanel handleOneClickGenerate] ✅ 图片生成完成:');
      console.log('  - 生成耗时:', generateTime, 'ms');
      console.log('  - 生成图片数量:', generationResult.images.length);
      console.log('  - 总耗时:', Math.round(generateEndTime - analysisStartTime), 'ms');

      // 第三步：保存生成的图片到存储服务并替换URL
      console.log('[AIGenerationPanel handleOneClickGenerate] 💾 保存生成的图片...');
      const processedImages = [];
      
      try {
        for (const image of generationResult.images) {
          // 上传到Cloudinary
          console.log('[AIGenerationPanel handleOneClickGenerate] 📤 上传图片到Cloudinary...');
          const uploadResponse = await fetch(`${window.location.origin}/.netlify/functions/upload-to-cloudinary`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageUrl: image.url,
              prompt: optimizedPrompt
            }),
          });

          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            if (uploadResult.success) {
              console.log('[AIGenerationPanel handleOneClickGenerate] ✅ 图片已上传到Cloudinary:', uploadResult.cloudinaryUrl);
              // 使用Cloudinary URL替换原始URL
              processedImages.push({
                ...image,
                url: uploadResult.cloudinaryUrl
              });
            } else {
              console.warn('[AIGenerationPanel handleOneClickGenerate] ⚠️ Cloudinary上传失败，使用原始URL:', uploadResult.error);
              processedImages.push(image);
            }
          } else {
            console.warn('[AIGenerationPanel handleOneClickGenerate] ⚠️ 上传请求失败，使用原始URL:', uploadResponse.status);
            processedImages.push(image);
          }
        }
      } catch (saveError) {
        console.warn('[AIGenerationPanel handleOneClickGenerate] ⚠️ 图片保存失败，使用原始URL:', saveError);
        // 保存失败时使用原始图片
        processedImages.push(...generationResult.images);
      }

      // 第四步：显示结果（使用处理后的图片URL）
      setGeneratedImages(processedImages);
      
      console.log('[AIGenerationPanel handleOneClickGenerate] ✅ 一键生成完成');
      console.log('[AIGenerationPanel handleOneClickGenerate] === 一键生成流程完成 ===');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '一键生成失败';
      console.error('[AIGenerationPanel handleOneClickGenerate] ❌ 一键生成失败:', error);
      console.error('  - 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('  - 错误消息:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      console.log('[AIGenerationPanel handleOneClickGenerate] 🔄 清理加载状态');
    }
  }, [canvasSnapshot, visionService, dalleService, loadReferenceImage, systemPrompt]);

  // 重置状态
  const handleReset = useCallback(() => {
    console.log('[AIGenerationPanel handleReset] === 重置流程开始 ===');
    console.log('[AIGenerationPanel handleReset] 🔄 清理所有状态...');
    
    setGeneratedImages([]);
    setError('');
    setAnalysisPrompt(''); // 清空分析prompt
    
    console.log('[AIGenerationPanel handleReset] ✅ 状态重置完成，将重新生成');
    console.log('[AIGenerationPanel handleReset] === 重置流程完成 ===');
    
    // 重置后自动重新生成
    setTimeout(() => {
      handleOneClickGenerate();
    }, 100);
  }, [handleOneClickGenerate]);

  if (!isOpen) return null;

  return (
    <div className="ai-generation-overlay">
      <div className="ai-generation-panel">
        <div className="panel-header">
          <h2>一键生成</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* System Prompt 编辑区域 - 始终显示 */}
        <div className="system-prompt-section">
          <div className="section-header">
            <h4>🎯 System Prompt 编辑</h4>
            <button 
              className="generate-button"
              onClick={handleOneClickGenerate}
              disabled={isLoading}
            >
              {isLoading ? '生成中...' : '🚀 生成图片'}
            </button>
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="输入System Prompt..."
            rows={6}
            className="system-prompt-textarea"
          />
          
          {/* 显示参考图片 */}
          <div className="reference-images">
            <h5>📸 参考图片：</h5>
            <div className="reference-grid">
              <div className="reference-item">
                <img src={REFERENCE_IMAGE_URL} alt="参考图片" />
                <span className="reference-index">1</span>
              </div>
            </div>
            <p className="reference-note">AI将参考这张图片的风格和元素</p>
          </div>
        </div>

        {/* 显示AI分析返回的生图prompt */}
        {analysisPrompt && (
          <div className="analysis-prompt-section">
            <h4>🤖 AI分析返回的生图Prompt</h4>
            <div className="analysis-prompt-content">
              <pre>{analysisPrompt}</pre>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* 加载状态 */}
        {isLoading && (
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h3>AI正在生成图片...</h3>
            <p>请稍候，这可能需要几秒钟时间</p>
          </div>
        )}

        {/* 生成结果 */}
        {!isLoading && generatedImages.length > 0 && (
          <div className="result-content">
            <h3>生成完成</h3>
            <p>选择一张图片添加到画板：</p>
            
            <div className="generated-images">
              {generatedImages.map((image, index) => (
                <div key={index} className="generated-image">
                  <img src={image.url} alt={`Generated ${index + 1}`} />
                  <div className="image-actions">
                    <button 
                      className="use-image-button"
                      onClick={() => handleUseImage(image.url)}
                    >
                      使用此图片
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="result-actions">
              <button className="secondary-button" onClick={handleReset}>
                重新生成
              </button>
            </div>
          </div>
        )}

        {/* 初始状态 */}
        {!isLoading && generatedImages.length === 0 && !error && (
          <div className="initial-content">
            <div className="welcome-message">
              <h3>🎨 AI图片生成器</h3>
              <p>编辑上方的System Prompt，然后点击"生成图片"按钮开始</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 
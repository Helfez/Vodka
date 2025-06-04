import React, { useState, useCallback } from 'react';
import { AihubmixDalleService } from '../ImageSticker/services/aihubmix-dalle.service';
import './PromptGenerator.css';

export const PromptGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationOptions, setGenerationOptions] = useState({
    size: "1024x1024" as "1024x1024" | "1792x1024" | "1024x1792",
    quality: "standard" as "standard" | "hd",
    style: "vivid" as "vivid" | "natural"
  });

  const dalleService = AihubmixDalleService.getInstance();

  // 生成图片
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }

    if (prompt.trim().length < 10) {
      setError('提示词至少需要10个字符');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      console.log('[PromptGenerator] 🎨 开始生成图片...');
      console.log('[PromptGenerator] 📝 提示词:', prompt);
      console.log('[PromptGenerator] ⚙️ 参数:', generationOptions);

      const result = await dalleService.generateImage(prompt, {
        n: 1,
        ...generationOptions
      });

      if (result?.images?.length > 0) {
        const imageUrl = result.images[0].url;
        setGeneratedImage(imageUrl);
        console.log('[PromptGenerator] ✅ 图片生成成功');
        
        // 如果有修订的提示词，显示在控制台
        if (result.images[0].revised_prompt) {
          console.log('[PromptGenerator] 📝 DALL-E修订的提示词:', result.images[0].revised_prompt);
        }
      } else {
        throw new Error('没有生成任何图片');
      }
    } catch (error) {
      console.error('[PromptGenerator] ❌ 生成失败:', error);
      setError(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, generationOptions, dalleService]);

  // 下载图片
  const handleDownload = useCallback(async () => {
    if (!generatedImage) return;

    try {
      console.log('[PromptGenerator] 📥 开始下载图片...');
      
      // 获取图片数据
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 生成文件名（基于时间戳和部分提示词）
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const promptPart = prompt.slice(0, 30).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
      const filename = `dalle_${timestamp}_${promptPart}.png`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('[PromptGenerator] ✅ 下载完成:', filename);
    } catch (error) {
      console.error('[PromptGenerator] ❌ 下载失败:', error);
      setError('下载失败，请重试');
    }
  }, [generatedImage, prompt]);

  // 清除结果
  const handleClear = useCallback(() => {
    setGeneratedImage(null);
    setError(null);
  }, []);

  // 示例提示词
  const examplePrompts = [
    "一只可爱的卡通猫咪，穿着小巫师袍，手持魔法棒，背景是星空",
    "赛博朋克风格的城市夜景，霓虹灯闪烁，未来感十足",
    "水彩画风格的樱花树，粉色花瓣飘落，春天的氛围",
    "像素艺术风格的8位游戏角色，勇士形象，手持宝剑",
    "梵高风格的向日葵田野，色彩鲜艳，笔触明显"
  ];

  const insertExample = (example: string) => {
    setPrompt(example);
  };

  return (
    <div className="prompt-generator">
      <div className="prompt-generator-header">
        <h1>🎨 AI图片生成器</h1>
        <p>输入提示词，使用DALL-E 3生成高质量图片</p>
      </div>

      <div className="prompt-generator-content">
        {/* 输入区域 */}
        <div className="input-section">
          <div className="prompt-input-container">
            <label htmlFor="prompt-input">提示词 (Prompt)</label>
            <textarea
              id="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述您想要生成的图片，例如：一只可爱的橘猫在草地上玩耍，阳光明媚，卡通风格..."
              rows={4}
              disabled={isGenerating}
            />
            <div className="prompt-counter">
              {prompt.length} 字符
            </div>
          </div>

          {/* 生成选项 */}
          <div className="generation-options">
            <h3>生成选项</h3>
            <div className="options-grid">
              <div className="option-group">
                <label>图片尺寸</label>
                <select 
                  value={generationOptions.size} 
                  onChange={(e) => setGenerationOptions(prev => ({
                    ...prev, 
                    size: e.target.value as any
                  }))}
                  disabled={isGenerating}
                >
                  <option value="1024x1024">方形 (1024×1024)</option>
                  <option value="1792x1024">横向 (1792×1024)</option>
                  <option value="1024x1792">竖向 (1024×1792)</option>
                </select>
              </div>
              
              <div className="option-group">
                <label>图片质量</label>
                <select 
                  value={generationOptions.quality} 
                  onChange={(e) => setGenerationOptions(prev => ({
                    ...prev, 
                    quality: e.target.value as any
                  }))}
                  disabled={isGenerating}
                >
                  <option value="standard">标准质量</option>
                  <option value="hd">高清质量</option>
                </select>
              </div>
              
              <div className="option-group">
                <label>图片风格</label>
                <select 
                  value={generationOptions.style} 
                  onChange={(e) => setGenerationOptions(prev => ({
                    ...prev, 
                    style: e.target.value as any
                  }))}
                  disabled={isGenerating}
                >
                  <option value="vivid">生动风格</option>
                  <option value="natural">自然风格</option>
                </select>
              </div>
            </div>
          </div>

          {/* 示例提示词 */}
          <div className="example-prompts">
            <h3>示例提示词</h3>
            <div className="examples-grid">
              {examplePrompts.map((example, index) => (
                <button
                  key={index}
                  className="example-button"
                  onClick={() => insertExample(example)}
                  disabled={isGenerating}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="action-buttons">
            <button
              className="generate-button"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? (
                <>
                  <span className="loading-spinner"></span>
                  生成中...
                </>
              ) : (
                '🎨 生成图片'
              )}
            </button>
            
            {generatedImage && (
              <>
                <button
                  className="download-button"
                  onClick={handleDownload}
                  disabled={isGenerating}
                >
                  📥 下载图片
                </button>
                <button
                  className="clear-button"
                  onClick={handleClear}
                  disabled={isGenerating}
                >
                  🗑️ 清除结果
                </button>
              </>
            )}
          </div>
        </div>

        {/* 结果区域 */}
        <div className="result-section">
          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}

          {isGenerating && (
            <div className="generating-message">
              <div className="loading-animation">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
              <p>正在生成图片，请稍候...</p>
              <small>这可能需要10-30秒</small>
            </div>
          )}

          {generatedImage && (
            <div className="generated-result">
              <h3>✅ 生成完成</h3>
              <div className="image-container">
                <img 
                  src={generatedImage} 
                  alt="Generated by DALL-E" 
                  className="generated-image"
                />
              </div>
              <div className="image-info">
                <p><strong>提示词:</strong> {prompt}</p>
                <p><strong>尺寸:</strong> {generationOptions.size}</p>
                <p><strong>质量:</strong> {generationOptions.quality}</p>
                <p><strong>风格:</strong> {generationOptions.style}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptGenerator; 
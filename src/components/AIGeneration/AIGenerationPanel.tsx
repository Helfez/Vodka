import React, { useState, useCallback } from 'react';
import { AihubmixVisionService } from '../ImageSticker/services/aihubmix-vision.service';
import { AihubmixDalleService } from '../ImageSticker/services/aihubmix-dalle.service';
import { PromptTemplateManager, PromptTemplate } from '../ImageSticker/services/prompt-templates';
import './AIGenerationPanel.css';

interface AIGenerationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  canvasSnapshot: string; // base64 encoded canvas snapshot
  onImageGenerated: (imageUrl: string) => void;
}

interface GenerationStep {
  id: 'analyze' | 'generate' | 'complete';
  name: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

export const AIGenerationPanel: React.FC<AIGenerationPanelProps> = ({
  isOpen,
  onClose,
  canvasSnapshot,
  onImageGenerated
}) => {
  const [currentStep, setCurrentStep] = useState<'analyze' | 'generate' | 'complete'>('analyze');
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [editablePrompt, setEditablePrompt] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<Array<{ url: string; revised_prompt?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const templateManager = PromptTemplateManager.getInstance();
  const visionService = AihubmixVisionService.getInstance();
  const dalleService = AihubmixDalleService.getInstance();

  const steps: GenerationStep[] = [
    { id: 'analyze', name: '分析画板', status: currentStep === 'analyze' ? 'loading' : currentStep > 'analyze' ? 'completed' : 'pending' },
    { id: 'generate', name: '生成图片', status: currentStep === 'generate' ? 'loading' : currentStep > 'generate' ? 'completed' : 'pending' },
    { id: 'complete', name: '完成', status: currentStep === 'complete' ? 'completed' : 'pending' }
  ];

  // 分析画板内容
  const handleAnalyze = useCallback(async () => {
    console.log('[AIGenerationPanel handleAnalyze] === 画板分析流程开始 ===');
    
    if (!selectedTemplate || !canvasSnapshot) {
      const errorMsg = !selectedTemplate ? '请选择分析模板' : '画板快照不可用';
      console.error('[AIGenerationPanel handleAnalyze] ❌ 前置条件检查失败:', errorMsg);
      console.error('  - 选中模板:', !!selectedTemplate);
      console.error('  - 快照可用:', !!canvasSnapshot);
      setError(errorMsg);
      return;
    }

    console.log('[AIGenerationPanel handleAnalyze] 📋 分析配置:');
    console.log('  - 模板ID:', selectedTemplate.id);
    console.log('  - 模板名称:', selectedTemplate.name);
    console.log('  - 模板类别:', selectedTemplate.category);
    console.log('  - 快照大小:', Math.round(canvasSnapshot.length / 1024), 'KB');

    setIsLoading(true);
    setError('');

    try {
      console.log('[AIGenerationPanel handleAnalyze] 🔍 开始调用Vision分析服务...');
      const analysisStartTime = performance.now();
      
      const result = await visionService.analyzeImage(
        canvasSnapshot,
        selectedTemplate.systemPrompt,
        selectedTemplate.userPrompt
      );

      const analysisEndTime = performance.now();
      const analysisTime = Math.round(analysisEndTime - analysisStartTime);
      
      console.log('[AIGenerationPanel handleAnalyze] ✅ 分析完成:');
      console.log('  - 分析耗时:', analysisTime, 'ms');
      console.log('  - 分析结果长度:', result.analysis.length, '字符');
      console.log('  - 使用情况:', result.usage);
      console.log('  - 分析结果预览:', result.analysis.substring(0, 100) + '...');

      setAnalysisResult(result.analysis);
      setEditablePrompt(result.analysis);
      setCurrentStep('generate');
      
      console.log('[AIGenerationPanel handleAnalyze] 🎯 切换到生成步骤');
      console.log('[AIGenerationPanel handleAnalyze] === 画板分析流程完成 ===');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '分析失败';
      console.error('[AIGenerationPanel handleAnalyze] ❌ 分析失败:', err);
      console.error('  - 错误类型:', err instanceof Error ? err.constructor.name : typeof err);
      console.error('  - 错误消息:', errorMessage);
      console.error('  - 分析耗时:', Math.round(performance.now() - (performance.now() - 1000)), 'ms'); // 估算
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      console.log('[AIGenerationPanel handleAnalyze] 🔄 清理加载状态');
    }
  }, [selectedTemplate, canvasSnapshot, visionService]);

  // 生成图片
  const handleGenerate = useCallback(async () => {
    console.log('[AIGenerationPanel handleGenerate] === 图片生成流程开始 ===');
    
    if (!editablePrompt.trim()) {
      console.error('[AIGenerationPanel handleGenerate] ❌ 提示词为空');
      setError('请输入图片生成提示词');
      return;
    }

    console.log('[AIGenerationPanel handleGenerate] 📝 生成配置:');
    console.log('  - 提示词长度:', editablePrompt.length, '字符');
    console.log('  - 提示词预览:', editablePrompt.substring(0, 100) + '...');
    console.log('  - 生成参数: 1张图片, 1024x1024, standard质量, vivid风格');

    setIsLoading(true);
    setError('');

    try {
      console.log('[AIGenerationPanel handleGenerate] 🎨 开始调用DALL-E生成服务...');
      const generateStartTime = performance.now();
      
      const result = await dalleService.generateImage(editablePrompt, {
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid"
      });

      const generateEndTime = performance.now();
      const generateTime = Math.round(generateEndTime - generateStartTime);
      
      console.log('[AIGenerationPanel handleGenerate] ✅ 图片生成完成:');
      console.log('  - 生成耗时:', generateTime, 'ms');
      console.log('  - 生成图片数量:', result.images.length);
      console.log('  - 使用情况:', result.usage);
      
      result.images.forEach((image, index) => {
        console.log(`  - 图片${index + 1}:`, {
          url: image.url.substring(0, 50) + '...',
          hasRevisedPrompt: !!image.revised_prompt,
          revisedPromptLength: image.revised_prompt?.length || 0
        });
      });

      setGeneratedImages(result.images);
      setCurrentStep('complete');
      
      console.log('[AIGenerationPanel handleGenerate] 🎯 切换到完成步骤');
      console.log('[AIGenerationPanel handleGenerate] === 图片生成流程完成 ===');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '图片生成失败';
      console.error('[AIGenerationPanel handleGenerate] ❌ 生成失败:', err);
      console.error('  - 错误类型:', err instanceof Error ? err.constructor.name : typeof err);
      console.error('  - 错误消息:', errorMessage);
      console.error('  - 生成耗时:', Math.round(performance.now() - (performance.now() - 1000)), 'ms'); // 估算
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      console.log('[AIGenerationPanel handleGenerate] 🔄 清理加载状态');
    }
  }, [editablePrompt, dalleService]);

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

  // 重置状态
  const handleReset = useCallback(() => {
    console.log('[AIGenerationPanel handleReset] === 重置流程开始 ===');
    console.log('[AIGenerationPanel handleReset] 🔄 清理所有状态...');
    
    setCurrentStep('analyze');
    setSelectedTemplate(null);
    setAnalysisResult('');
    setEditablePrompt('');
    setGeneratedImages([]);
    setError('');
    
    console.log('[AIGenerationPanel handleReset] ✅ 状态重置完成');
    console.log('[AIGenerationPanel handleReset] === 重置流程完成 ===');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="ai-generation-overlay">
      <div className="ai-generation-panel">
        <div className="panel-header">
          <h2>AI 图片生成</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* 进度指示器 */}
        <div className="progress-steps">
          {steps.map((step, index) => (
            <div key={step.id} className={`step ${step.status}`}>
              <div className="step-number">{index + 1}</div>
              <div className="step-name">{step.name}</div>
              {index < steps.length - 1 && <div className="step-connector" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* 步骤1: 选择分析模板 */}
        {currentStep === 'analyze' && (
          <div className="step-content">
            <h3>选择分析模板</h3>
            <p>选择一个模板来分析您的画板内容：</p>
            
            <div className="template-categories">
              {['analysis', 'generation', 'style'].map(category => (
                <div key={category} className="template-category">
                  <h4>
                    {category === 'analysis' && '分析模板'}
                    {category === 'generation' && '生成模板'}
                    {category === 'style' && '风格模板'}
                  </h4>
                  <div className="template-grid">
                    {templateManager.getTemplatesByCategory(category as any).map(template => (
                      <div
                        key={template.id}
                        className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="template-name">{template.name}</div>
                        <div className="template-description">{template.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="step-actions">
              <button 
                className="primary-button" 
                onClick={handleAnalyze}
                disabled={!selectedTemplate || isLoading}
              >
                {isLoading ? '分析中...' : '开始分析'}
              </button>
            </div>
          </div>
        )}

        {/* 步骤2: 编辑提示词 */}
        {currentStep === 'generate' && (
          <div className="step-content">
            <h3>编辑生成提示词</h3>
            <p>AI已分析您的画板内容，您可以编辑下面的提示词：</p>
            
            {analysisResult && (
              <div className="analysis-result">
                <h4>分析结果：</h4>
                <div className="analysis-text">{analysisResult}</div>
              </div>
            )}

            <div className="prompt-editor">
              <label htmlFor="prompt-textarea">图片生成提示词：</label>
              <textarea
                id="prompt-textarea"
                value={editablePrompt}
                onChange={(e) => setEditablePrompt(e.target.value)}
                placeholder="请输入或编辑图片生成提示词..."
                rows={6}
              />
            </div>

            <div className="step-actions">
              <button className="secondary-button" onClick={() => setCurrentStep('analyze')}>
                返回
              </button>
              <button 
                className="primary-button" 
                onClick={handleGenerate}
                disabled={!editablePrompt.trim() || isLoading}
              >
                {isLoading ? '生成中...' : '生成图片'}
              </button>
            </div>
          </div>
        )}

        {/* 步骤3: 查看生成结果 */}
        {currentStep === 'complete' && (
          <div className="step-content">
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
                  {image.revised_prompt && (
                    <div className="revised-prompt">
                      <small>修订后的提示词: {image.revised_prompt}</small>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="step-actions">
              <button className="secondary-button" onClick={handleReset}>
                重新开始
              </button>
              <button className="secondary-button" onClick={() => setCurrentStep('generate')}>
                重新生成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 
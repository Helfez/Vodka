import React, { useEffect, useCallback, useState, useRef } from 'react';
import { AihubmixVisionService } from '../ImageSticker/services/aihubmix-vision.service';
import { AihubmixDalleService } from '../ImageSticker/services/aihubmix-dalle.service';
import { DEFAULT_SYSTEM_PROMPT } from '../../config/ai-prompts';

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

  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const visionService = AihubmixVisionService.getInstance();
  const dalleService = AihubmixDalleService.getInstance();
  const hasStartedRef = useRef<boolean>(false);

  // 硬编码的参考图片URL
  const REFERENCE_IMAGE_URL = 'https://res.cloudinary.com/dqs6g6vrd/image/upload/v1748501675/wechat_2025-05-28_153406_424_rhmgt4.png';

  // 组件初始化时加载System Prompt
  useEffect(() => {
    console.log('[AIGenerationPanel] 🔄 初始化System Prompt...');
    
    // 直接使用不含图片的系统提示词，避免请求过大
    const textOnlySystemPrompt = DEFAULT_SYSTEM_PROMPT('');
    setSystemPrompt(textOnlySystemPrompt);
    console.log('[AIGenerationPanel] ✅ System Prompt加载成功，长度:', textOnlySystemPrompt.length);
  }, []);

  // 一键生成功能
  const handleOneClickGenerate = useCallback(async () => {
    if (!canvasSnapshot) {
      console.error('[AIGenerationPanel] ❌ 画板快照不可用');
      onClose();
      return;
    }

    if (!systemPrompt) {
      console.error('[AIGenerationPanel] ❌ System Prompt未加载');
      alert('System Prompt未加载完成，请稍后重试');
      onClose();
      return;
    }

    if (isGenerating) {
      console.log('[AIGenerationPanel] ⚠️ 生成中，跳过重复请求');
      return;
    }

    console.log('[AIGenerationPanel] === 开始AI图片生成流程 ===');
    console.log('[AIGenerationPanel] 📋 使用System Prompt长度:', systemPrompt.length);

    setIsGenerating(true);

    try {
      // 第一步：使用已加载的系统提示词分析图像
      console.log('[AIGenerationPanel] 📸 分析画板内容...');
      
      const analysisResult = await visionService.analyzeImageWithReference(
        canvasSnapshot,
        systemPrompt,  // 纯文本系统提示词
        REFERENCE_IMAGE_URL,  // 参考图片URL
        undefined  // 使用后端的默认用户提示词
      );

      console.log('[AIGenerationPanel] ✅ 分析完成，生成prompt长度:', analysisResult.analysis.length);
      
      // 打印完整的AI生成的提示词到控制台
      console.log('[AIGenerationPanel] 📝 === AI生成的DALL-E提示词 ===');
      console.log(analysisResult.analysis);
      console.log('[AIGenerationPanel] 📝 === 提示词结束 ===');

      // 第二步：生成图片
      console.log('[AIGenerationPanel] 🎨 生成图片...');
      const generationResult = await dalleService.generateImage(analysisResult.analysis, {
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid"
      });

      if (generationResult?.images?.length > 0) {
        const image = generationResult.images[0];
        console.log('[AIGenerationPanel] ✅ 图片生成成功');

        // 第三步：上传到Cloudinary
        console.log('[AIGenerationPanel] 📤 上传到Cloudinary...');
        try {
          const uploadResponse = await fetch(`${window.location.origin}/.netlify/functions/upload-to-cloudinary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: image.url,
              prompt: analysisResult.analysis
            }),
          });

          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            if (uploadResult.success && uploadResult.cloudinaryUrl) {
              console.log('[AIGenerationPanel] ✅ Cloudinary上传成功');
              onImageGenerated(uploadResult.cloudinaryUrl);
              onClose();
              return;
            }
          }
          
          console.warn('[AIGenerationPanel] ⚠️ Cloudinary上传失败，使用原始URL');
        } catch (uploadError) {
          console.error('[AIGenerationPanel] ❌ 上传异常:', uploadError);
        }

        // 如果上传失败，直接使用原始URL
        onImageGenerated(image.url);
        onClose();
      } else {
        throw new Error('没有生成任何图片');
      }

    } catch (error) {
      console.error('[AIGenerationPanel] ❌ AI生成失败:', error);
      alert('AI图片生成失败: ' + (error instanceof Error ? error.message : '未知错误'));
      onClose();
    } finally {
      setIsGenerating(false);
    }
  }, [canvasSnapshot, systemPrompt, isGenerating, visionService, dalleService, onImageGenerated, onClose]); // 添加所有依赖项

  // 面板打开时自动开始生成（只执行一次）
  useEffect(() => {
    if (isOpen && canvasSnapshot && systemPrompt && !hasStartedRef.current && !isGenerating) {
      console.log('[AIGenerationPanel] 🚀 面板打开，System Prompt已就绪，开始生成');
      hasStartedRef.current = true;
      handleOneClickGenerate();
    }
    
    // 面板关闭时重置状态
    if (!isOpen) {
      hasStartedRef.current = false;
      setIsGenerating(false);
    }
  }, [isOpen, canvasSnapshot, systemPrompt, isGenerating, handleOneClickGenerate]); // 添加所有依赖项

  // 不渲染任何UI
  return null;
}; 
import React, { useState, useCallback } from 'react';
import { TripoService } from '../ImageSticker/services/tripo.service';
import { ModelViewer } from '../ModelViewer/ModelViewer';
import './Tripo3DPanel.css';

interface Tripo3DPanelProps {
  isOpen: boolean;
  onClose: () => void;
  canvasSnapshot: string; // base64编码的画布快照
  onModelGenerated?: (modelUrl: string, format: string) => void;
}

export const Tripo3DPanel: React.FC<Tripo3DPanelProps> = ({
  isOpen,
  onClose,
  canvasSnapshot,
  onModelGenerated
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    modelUrl: string;
    format: string;
    fileSize?: number;
  } | null>(null);
  const [showModelViewer, setShowModelViewer] = useState(false);

  const tripoService = TripoService.getInstance();

  const handleGenerate = useCallback(async () => {
    if (!canvasSnapshot) {
      setError('画布快照不可用');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      console.log('[Tripo3DPanel] 开始3D模型生成...');
      
      const result = await tripoService.imageToModel(
        canvasSnapshot,
        {
          outputFormat: 'glb', // 使用GLB格式，更适合在线预览
          removeBackground: true,
          mcResolution: 256
        },
        (progressValue) => {
          setProgress(progressValue);
        }
      );

      console.log('[Tripo3DPanel] 3D模型生成成功:', result);
      setResult(result);
      onModelGenerated?.(result.modelUrl, result.format);
      
    } catch (error) {
      console.error('[Tripo3DPanel] 3D生成失败:', error);
      setError(error instanceof Error ? error.message : '3D模型生成失败');
    } finally {
      setIsGenerating(false);
    }
  }, [canvasSnapshot, tripoService, onModelGenerated]);

  const handleDownload = useCallback(() => {
    if (result?.modelUrl) {
      const link = document.createElement('a');
      link.href = result.modelUrl;
      link.download = `3d-model.${result.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [result]);

  if (!isOpen) return null;

  return (
    <div className="tripo3d-overlay">
      <div className="tripo3d-panel">
        <div className="tripo3d-header">
          <h3>🎲 AI 3D模型生成</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="tripo3d-content">
          {!isGenerating && !result && !error && (
            <div className="tripo3d-intro">
              <p>将你的画板内容转换为3D模型！</p>
              <ul>
                <li>🎨 AI自动识别画板中的物体</li>
                <li>🏗️ 生成高质量3D网格模型</li>
                <li>📱 支持GLB格式，可在线预览</li>
                <li>⚡ 大约需要30-60秒</li>
              </ul>
              <button 
                className="generate-btn" 
                onClick={handleGenerate}
                disabled={!canvasSnapshot}
              >
                开始生成3D模型
              </button>
            </div>
          )}

          {isGenerating && (
            <div className="tripo3d-progress">
              <div className="progress-header">
                <h4>🔄 正在生成3D模型...</h4>
                <span className="progress-percent">{progress}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="progress-status">
                {progress < 30 && '📤 上传画板快照...'}
                {progress >= 30 && progress < 60 && '🤖 AI分析中...'}
                {progress >= 60 && progress < 90 && '🏗️ 构建3D网格...'}
                {progress >= 90 && '✨ 最后处理...'}
              </div>
            </div>
          )}

          {error && (
            <div className="tripo3d-error">
              <h4>❌ 生成失败</h4>
              <p>{error}</p>
              <button className="retry-btn" onClick={handleGenerate}>
                🔄 重试
              </button>
            </div>
          )}

          {result && (
            <div className="tripo3d-success">
              <h4>✅ 3D模型生成完成！</h4>
              <div className="model-info">
                <p><strong>格式:</strong> {result.format.toUpperCase()}</p>
                {result.fileSize && (
                  <p><strong>大小:</strong> {Math.round(result.fileSize / 1024)} KB</p>
                )}
              </div>
              
              <div className="model-actions">
                <button className="download-btn" onClick={handleDownload}>
                  📥 下载模型
                </button>
                <button 
                  className="view-btn"
                  onClick={() => window.open(result.modelUrl, '_blank')}
                >
                  👁️ 在线预览
                </button>
                <button 
                  className="preview-btn"
                  onClick={() => setShowModelViewer(true)}
                >
                  🎬 预览3D模型
                </button>
              </div>
              
              <div className="model-tip">
                <p>💡 提示: GLB文件可以在Blender、Unity等软件中打开，也支持AR/VR应用。</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3D模型查看器 */}
      {result && (
        <ModelViewer
          isOpen={showModelViewer}
          onClose={() => setShowModelViewer(false)}
          modelUrl={result.modelUrl}
          modelFormat={result.format}
          modelName="AI生成的3D模型"
        />
      )}
    </div>
  );
}; 
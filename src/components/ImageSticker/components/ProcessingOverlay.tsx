import React, { useEffect, useState } from 'react';
import './ProcessingOverlay.css';

interface ProcessingOverlayProps {
  progress: number;
  width: number;
  height: number;
}

/**
 * 处理中覆盖层组件 - 显示扫描线动画和处理进度
 */
const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ progress, width, height }) => {
  const [showText, setShowText] = useState(true);
  
  // 文字闪烁效果
  useEffect(() => {
    if (progress >= 100) return;
    
    const interval = setInterval(() => {
      setShowText(prev => !prev);
    }, 500);
    
    return () => clearInterval(interval);
  }, [progress]);
  
  // 计算扫描线位置，确保在进度100%时不显示
  const scanLinePosition = progress >= 100 ? '-10%' : `${progress}%`;
  
  // 处理完成状态
  const isComplete = progress >= 100;
  
  return (
    <div 
      className={`processing-overlay ${isComplete ? 'complete' : ''}`}
      style={{ width, height }}
    >
      {!isComplete && (
        <>
          <div className="scan-line" style={{ top: scanLinePosition }} />
          <div className="processing-text" style={{ opacity: showText ? 1 : 0.3 }}>
            处理中...
          </div>
        </>
      )}
      <div className={`progress-text ${isComplete ? 'complete' : ''}`}>
        {isComplete ? '完成' : `${Math.round(progress)}%`}
      </div>
    </div>
  );
};

export default ProcessingOverlay;

import React from 'react';
import './LoadingOverlay.css';

interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = '正在处理中...'
}) => {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner"></div>
      <div className="loading-message">{message}</div>
    </div>
  );
};

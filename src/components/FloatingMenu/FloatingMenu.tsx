import React from 'react';
import './FloatingMenu.css';

interface FloatingMenuProps {
  position: { x: number; y: number };
  onUploadClick: () => void;
  onStickyNoteClick: () => void;
  on3DGenerateClick: () => void;
  onClose: () => void;
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({
  position,
  onUploadClick,
  onStickyNoteClick,
  on3DGenerateClick,
  onClose
}) => {
  return (
    <div 
      className="floating-menu"
      style={{
        left: position.x,
        top: position.y
      }}
    >
      <button onClick={onUploadClick}>
        📷 上传图片
      </button>
      <button onClick={onStickyNoteClick}>
        📝 便签
      </button>
      <button onClick={on3DGenerateClick}>
        🎲 生成3D
      </button>
      <button className="close-button" onClick={onClose}>
        ×
      </button>
    </div>
  );
};

export default FloatingMenu;

import React from 'react';
import './FloatingMenu.css';

interface FloatingMenuProps {
  position: { x: number; y: number };
  onUploadClick: () => void;
  onStickyNoteClick: () => void;
  onClose: () => void;
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({
  position,
  onUploadClick,
  onStickyNoteClick,
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
      <button className="close-button" onClick={onClose}>
        ×
      </button>
    </div>
  );
};

export default FloatingMenu;

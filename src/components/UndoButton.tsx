import React from 'react';
import './UndoButton.css';

interface UndoButtonProps {
  canUndo: boolean;
  onUndo: () => void;
}

const UndoButton: React.FC<UndoButtonProps> = ({ canUndo, onUndo }) => {
  return (
    <button 
      className="undo-button" 
      onClick={onUndo} 
      disabled={!canUndo}
      title="撤销 (Ctrl+Z)"
    >
      <svg 
        viewBox="0 0 24 24" 
        width="24" 
        height="24" 
        stroke="currentColor" 
        strokeWidth="2" 
        fill="none"
      >
        <path d="M3 10h10c4.42 0 8 3.58 8 8v0-4" />
        <path d="M3 10l5-5" />
        <path d="M3 10l5 5" />
      </svg>
    </button>
  );
};

export default UndoButton;

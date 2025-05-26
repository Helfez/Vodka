import React from 'react';
import * as fabric from 'fabric';
import { Canvas, Image, Object as FabricObject } from 'fabric/fabric-impl';
import { FloatingButtonPosition } from '../../services/types';
import './FloatingButton.css';

interface FloatingButtonProps {
  position: FloatingButtonPosition;
  onConvert: () => void;
  onClose: () => void;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({ position, onConvert, onClose }) => {
  return (
    <div className="floating-button" style={{ left: position.x, top: position.y }}>
      <button 
        onClick={onConvert} 
        className="convert-button"
        style={{ left: 0, top: 0 }}
      >
        转为贴纸
      </button>
      <button 
        onClick={onClose} 
        className="close-button"
        style={{ position: 'absolute', right: -20, top: -20 }}
      >
        ×
      </button>
    </div>
  );
};

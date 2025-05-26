import React from 'react';
import './Toolbar.css';

interface ToolbarProps {
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  brushSize,
  onBrushSizeChange
}) => {
  return (
    <div className="toolbar">
      <div className="brush-size">
        <label>笔刷大小:</label>
        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
        />
        <span>{brushSize}px</span>
      </div>
    </div>
  );
};

export default Toolbar;

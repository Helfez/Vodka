import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import './Whiteboard.css';
import Toolbar from './Toolbar';
import { AIGenerationPanel } from './AIGeneration/AIGenerationPanel';
import { LogViewer } from './LogViewer/LogViewer';

// Type alias for Fabric.js Canvas instance with custom properties if any
interface FabricCanvas extends fabric.Canvas {
  freeDrawingBrush?: fabric.PencilBrush;
}

// Props for the Whiteboard component
interface WhiteboardProps {
  width?: number;
  height?: number;
  isDrawingMode?: boolean;
}

// Whiteboard component: Main component for the drawing canvas
const Whiteboard = ({ 
  width = 900,  // 修复：与CSS容器尺寸匹配
  height = 650, // 修复：与CSS容器尺寸匹配
  isDrawingMode: initialIsDrawingMode = true // Renamed prop to avoid conflict with canvas property
}: WhiteboardProps) => {
  // Refs for canvas DOM element and Fabric canvas instance
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);

  // State for UI elements and drawing properties
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor] = useState('#000000'); // 移除setBrushColor，暂时不需要
  
  // State for AI generation panel - isAIGenerationOpen might not be needed if panel is fully replaced
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAIGenerationOpen, setIsAIGenerationOpen] = useState(false); 
  // canvasSnapshot is still useful for analysis/generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [canvasSnapshot, setCanvasSnapshot] = useState<string>(''); 

  // State for log viewer
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  // 🔍 组件渲染监控 - 关键：检测是否因为StrictMode导致重复渲染
  console.log('🔄 [Whiteboard] Component RENDER - brushSize:', brushSize, 'timestamp:', Date.now());

  // --- Helper Functions ---
  
  // 移除未使用的createBrush函数 - 现在都用内联创建
  // 移除未使用的recordCanvasState函数 - 现在都用内联记录  
  // 移除未使用的generateCanvasSnapshot函数 - 现在都用内联生成
  // 移除未使用的handleUndo函数 - 现在都用内联处理
  // 移除未使用的manageSelectionRect函数 - 现在都用内联管理

  // --- Callbacks ---

  // Handler for brush size changes
  const handleBrushSizeChange = useCallback((newSize: number) => {
    setBrushSize(newSize);
  }, []);

  // 删除clearCanvas函数 - 暂时不需要

  // AI生成面板处理
  const handleOpenAIPanel = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas not available for AI generation');
      return;
    }

    // 生成画布快照
    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 0.8,
      multiplier: 1
    });
    
    setCanvasSnapshot(dataURL);
    setIsAIGenerationOpen(true);
  }, []);

  // 处理AI生成的图片
  const handleAIImageGenerated = useCallback((imageDataUrl: string) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas not available for AI image insertion');
      return;
    }

    const img = new Image();
    img.onload = () => {
      // 计算图片位置（居中放置）
      const canvasCenter = {
        x: canvas.width! / 2,
        y: canvas.height! / 2
      };

      // 计算适当的缩放比例
      const maxSize = Math.min(canvas.width! * 0.6, canvas.height! * 0.6);
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

      const fabricImage = new fabric.Image(img, {
        left: canvasCenter.x - (img.width * scale) / 2,
        top: canvasCenter.y - (img.height * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        selectable: true,
        hasControls: true,
        evented: true
      });

      canvas.add(fabricImage);
      canvas.renderAll();
    };

    img.onerror = () => {
      console.error('[Whiteboard] Failed to load AI generated image');
      alert('生成的图片加载失败，请重试');
    };

    img.src = imageDataUrl;
  }, []);

  // --- Effects --- 

  // Effect for initializing and managing the Fabric canvas instance
  useEffect(() => {
    console.log('🚀 [Whiteboard] Initializing canvas with dimensions:', width, 'x', height);
    
    if (!canvasElRef.current) {
      console.error('[Whiteboard] Canvas element not found');
      return;
    }

    // 如果已存在canvas实例，先清理
    if (fabricCanvasRef.current) {
      console.log('🧹 [Whiteboard] Disposing existing canvas instance');
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    // 创建新的 Fabric.js 画布实例
    const canvasInstance = new fabric.Canvas(canvasElRef.current, {
      width,
      height,
      backgroundColor: '#fefcf8',
      isDrawingMode: initialIsDrawingMode,
    }) as FabricCanvas;

    // 🔧 强制设置DOM canvas元素尺寸，确保与Fabric实例匹配
    if (canvasElRef.current) {
      canvasElRef.current.width = width;
      canvasElRef.current.height = height;
      canvasElRef.current.style.width = width + 'px';
      canvasElRef.current.style.height = height + 'px';
      console.log('🔧 [Whiteboard] Forced DOM canvas size to match Fabric:', width, 'x', height);
    }

    // 设置画笔 - 使用固定初始值，避免依赖状态变量
    const brush = new fabric.PencilBrush(canvasInstance);
    brush.width = 5; // 固定初始值
    brush.color = '#000000'; // 固定初始值
    // 🔧 移除可能导致问题的高级属性
    // (brush as any).decimate = 8;
    // (brush as any).controlPointsNum = 2;
    canvasInstance.freeDrawingBrush = brush;
    
    // 设置canvas属性
    canvasInstance.renderOnAddRemove = true;
    canvasInstance.preserveObjectStacking = true;
    
    // 🔧 尝试强制设置更简单的画笔模式
    canvasInstance.isDrawingMode = true;
    canvasInstance.freeDrawingBrush.width = 5;
    canvasInstance.freeDrawingBrush.color = '#000000';

    // 路径创建事件 - 关键的绘制完成LOG
    const handlePathCreated = (e: fabric.TEvent & { path: fabric.Path }) => {
      console.log('🎯 [Whiteboard] PATH CREATED - Objects:', canvasInstance.getObjects().length);
      
      // 🔧 简单方案：只做强制渲染，不清空canvas
      canvasInstance.renderAll();
      console.log('✅ [Whiteboard] Simple render completed');
    };

    // 对象添加事件
    const handleObjectAdded = (e: fabric.TEvent & { target: fabric.Object }) => {
      console.log('➕ [Whiteboard] Object ADDED:', e.target.type, 'Total:', canvasInstance.getObjects().length);
    };

    // 对象移除事件 - 关键的消失监控
    const handleObjectRemoved = (e: fabric.TEvent & { target: fabric.Object }) => {
      console.log('➖ [Whiteboard] Object REMOVED:', e.target.type, 'Remaining:', canvasInstance.getObjects().length);
    };

    // 画布清空事件 - 这是导致绘制消失的主要原因
    const handleCanvasCleared = () => {
      console.log('🧹 [Whiteboard] CANVAS CLEARED!');
    };

    // 绑定所有事件监听器
    console.log('🔗 [Whiteboard] Binding essential event listeners only');
    
    // 🔧 只绑定最关键的事件，减少冲突
    canvasInstance.on('path:created', handlePathCreated);
    canvasInstance.on('object:added', handleObjectAdded);
    canvasInstance.on('object:removed', handleObjectRemoved);
    canvasInstance.on('canvas:cleared', handleCanvasCleared);
    
    // 🔧 暂时移除可能冲突的事件监听器
    // canvasInstance.on('mouse:down', handleMouseDown);
    // canvasInstance.on('mouse:up', handleMouseUp);
    // canvasInstance.on('before:path:created', handleDrawingStart);
    
    console.log('✅ [Whiteboard] Essential events bound successfully');

    fabricCanvasRef.current = canvasInstance;
    
    console.log('✅ [Whiteboard] Canvas initialization completed successfully');
    console.log('📐 [Whiteboard] Canvas size:', canvasInstance.getWidth(), 'x', canvasInstance.getHeight());
    console.log('📐 [Whiteboard] Expected size:', width, 'x', height);

    // 清理函数
    return () => {
      console.log('🧹 [Whiteboard] Cleaning up canvas');
      
      if (canvasInstance && fabricCanvasRef.current === canvasInstance) {
        // 移除所有事件监听器
        canvasInstance.off('path:created', handlePathCreated);
        canvasInstance.off('object:added', handleObjectAdded);
        canvasInstance.off('object:removed', handleObjectRemoved);
        canvasInstance.off('canvas:cleared', handleCanvasCleared);
        
        canvasInstance.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [width, height, initialIsDrawingMode]); // 🔧 修复：只依赖canvas尺寸和绘图模式，画笔属性通过单独Effect更新

  // 🔧 画笔更新Effect - 暂时禁用来测试
  useEffect(() => {
    console.log('🖌️ [Whiteboard] Brush update effect triggered - Size:', brushSize, 'Color:', brushColor);
    
    // 🚨 暂时禁用画笔更新来排查是否它导致清空
    console.log('⚠️ [Whiteboard] BRUSH UPDATE DISABLED FOR TESTING');
    return;
  }, [brushSize, brushColor]); // 只依赖画笔属性，不会导致canvas重建

  return (
    <div className="whiteboard-wrapper">
      <Toolbar 
        brushSize={brushSize}
        onBrushSizeChange={handleBrushSizeChange}
      />
      
      <div className="ai-generation-trigger">
        <button
          className="ai-generation-btn"
          onClick={handleOpenAIPanel}
          title="AI分析画板并自动生成图片"
          disabled={isAIGenerationOpen}
        >
          {isAIGenerationOpen ? '🎨 生成中...' : '🎨 生图'}
        </button>
        <button 
          className="log-viewer-button"
          onClick={() => setIsLogViewerOpen(true)}
          title="查看系统日志"
        >
          📊 日志
        </button>
      </div>

      <div className="whiteboard-main-content">
        <div className="whiteboard-container">
          <div className="canvas-wrapper">
            <canvas ref={canvasElRef} />
          </div>
        </div>
      </div>

      {/* AI生成面板 */}
      <AIGenerationPanel
        isOpen={isAIGenerationOpen} 
        onClose={() => setIsAIGenerationOpen(false)}
        canvasSnapshot={canvasSnapshot}
        onImageGenerated={handleAIImageGenerated}
      />

      {/* 日志查看器 */}
      <LogViewer
        isOpen={isLogViewerOpen}
        onClose={() => setIsLogViewerOpen(false)}
      />
    </div>
  );
};

export default Whiteboard;

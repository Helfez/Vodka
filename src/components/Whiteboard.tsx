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
  width = 800, 
  height = 600, 
  isDrawingMode: initialIsDrawingMode = true // Renamed prop to avoid conflict with canvas property
}: WhiteboardProps) => {
  // Refs for canvas DOM element and Fabric canvas instance
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);

  // State for UI elements and drawing properties
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  
  // State for AI generation panel - isAIGenerationOpen might not be needed if panel is fully replaced
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAIGenerationOpen, setIsAIGenerationOpen] = useState(false); 
  // canvasSnapshot is still useful for analysis/generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [canvasSnapshot, setCanvasSnapshot] = useState<string>(''); 

  // State for log viewer
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

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

  // 清空画布函数
  const clearCanvas = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.warn('[Whiteboard] Cannot clear: canvas not available');
      return;
    }

    console.log('🧹 [Whiteboard] Clearing canvas manually');
    canvas.clear();
    
    // 重新设置画布的绘图模式和画笔
    canvas.isDrawingMode = initialIsDrawingMode;
    const brush = new fabric.PencilBrush(canvas);
    brush.width = brushSize;
    brush.color = brushColor;
    (brush as any).decimate = 8;
    (brush as any).controlPointsNum = 2;
    canvas.freeDrawingBrush = brush;
    canvas.renderAll();
  }, [initialIsDrawingMode, brushSize, brushColor]);

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

    // 设置画笔
    const brush = new fabric.PencilBrush(canvasInstance);
    brush.width = brushSize;
    brush.color = brushColor;
    (brush as any).decimate = 8;
    (brush as any).controlPointsNum = 2;
    canvasInstance.freeDrawingBrush = brush;
    
    // 设置canvas属性
    canvasInstance.renderOnAddRemove = true;
    canvasInstance.preserveObjectStacking = true;

    // 绘制开始事件 - 落笔LOG
    const handleDrawingStart = (e: any) => {
      console.log('✏️ [Whiteboard] Drawing STARTED at:', e.pointer);
      console.log('📊 [Whiteboard] Current canvas objects count:', canvasInstance.getObjects().length);
    };

    // 路径创建事件 - 关键的绘制完成LOG
    const handlePathCreated = (e: fabric.TEvent & { path: fabric.Path }) => {
      console.log('🎯 [Whiteboard] ===== PATH CREATED =====');
      console.log('📐 [Whiteboard] Path object:', e.path);
      console.log('📊 [Whiteboard] Canvas objects BEFORE adding path:', canvasInstance.getObjects().length);
      
      // 立即检查对象是否被添加
      setTimeout(() => {
        const objectCount = canvasInstance.getObjects().length;
        console.log('📊 [Whiteboard] Canvas objects AFTER path creation:', objectCount);
        
        if (objectCount === 0) {
          console.error('🚨 [Whiteboard] CRITICAL BUG: All objects disappeared after path creation!');
        } else {
          console.log('✅ [Whiteboard] Path successfully preserved, total objects:', objectCount);
        }
      }, 10);

      // 延迟检查是否有清空事件
      setTimeout(() => {
        const finalCount = canvasInstance.getObjects().length;
        console.log('🔍 [Whiteboard] Final object count after 1 second:', finalCount);
        if (finalCount === 0) {
          console.error('🚨 [Whiteboard] Objects disappeared after 1 second - possible state refresh bug!');
        }
      }, 1000);
    };

    // 对象添加事件
    const handleObjectAdded = (e: fabric.TEvent & { target: fabric.Object }) => {
      console.log('➕ [Whiteboard] Object ADDED:', e.target.type, 'Total objects:', canvasInstance.getObjects().length);
    };

    // 对象移除事件 - 关键的消失监控
    const handleObjectRemoved = (e: fabric.TEvent & { target: fabric.Object }) => {
      console.error('➖ [Whiteboard] Object REMOVED:', e.target.type, 'Remaining objects:', canvasInstance.getObjects().length);
      console.trace('📍 [Whiteboard] Object removal stack trace');
    };

    // 画布清空事件 - 这是导致绘制消失的主要原因
    const handleCanvasCleared = () => {
      console.error('🧹 [Whiteboard] CANVAS CLEARED! This causes drawing disappearance!');
      console.trace('📍 [Whiteboard] Canvas clear stack trace');
    };

    // 鼠标按下事件
    const handleMouseDown = (e: any) => {
      console.log('🖱️ [Whiteboard] Mouse DOWN at:', e.pointer);
    };

    // 鼠标释放事件
    const handleMouseUp = (e: any) => {
      console.log('🖱️ [Whiteboard] Mouse UP at:', e.pointer);
    };

    // 绑定所有事件监听器
    console.log('🔗 [Whiteboard] Binding event listeners');
    canvasInstance.on('mouse:down', handleMouseDown);
    canvasInstance.on('mouse:up', handleMouseUp);
    canvasInstance.on('path:created', handlePathCreated);
    canvasInstance.on('object:added', handleObjectAdded);
    canvasInstance.on('object:removed', handleObjectRemoved);
    canvasInstance.on('canvas:cleared', handleCanvasCleared);
    
    // 绘制相关事件 - 修复事件绑定
    canvasInstance.on('before:path:created', handleDrawingStart);

    // 🔍 添加更多监控事件
    canvasInstance.on('before:render', () => {
      console.log('🎨 [Whiteboard] Canvas BEFORE render, objects:', canvasInstance.getObjects().length);
    });

    canvasInstance.on('after:render', () => {
      const objectCount = canvasInstance.getObjects().length;
      console.log('🎨 [Whiteboard] Canvas AFTER render, objects:', objectCount);
      if (objectCount === 0) {
        console.error('🚨 [Whiteboard] RENDER CLEARED ALL OBJECTS!');
        console.trace('📍 [Whiteboard] Render clear stack trace');
      }
    });

    // 🔍 监控画布状态变化
    const originalClear = canvasInstance.clear.bind(canvasInstance);
    canvasInstance.clear = function(...args) {
      console.error('🚨 [Whiteboard] CANVAS.CLEAR() CALLED!');
      console.trace('📍 [Whiteboard] Clear method stack trace');
      return originalClear(...args);
    };

    // 🔍 监控loadFromJSON调用
    const originalLoadFromJSON = canvasInstance.loadFromJSON.bind(canvasInstance);
    canvasInstance.loadFromJSON = function(json, callback, ...args) {
      console.log('📥 [Whiteboard] LOAD_FROM_JSON called');
      console.trace('📍 [Whiteboard] LoadFromJSON stack trace');
      return originalLoadFromJSON(json, callback, ...args);
    };

    // 🔍 监控画布大小变化
    const originalSetDimensions = canvasInstance.setDimensions.bind(canvasInstance);
    canvasInstance.setDimensions = function(dimensions: any, options?: any) {
      console.log('📐 [Whiteboard] CANVAS SIZE CHANGE:', dimensions);
      const beforeCount = canvasInstance.getObjects().length;
      const result = originalSetDimensions(dimensions, options);
      const afterCount = canvasInstance.getObjects().length;
      if (beforeCount !== afterCount) {
        console.error('🚨 [Whiteboard] SIZE CHANGE CLEARED OBJECTS!', beforeCount, '->', afterCount);
      }
      return result;
    };

    // 🔍 定期检查画布状态
    const statusChecker = setInterval(() => {
      const objectCount = canvasInstance.getObjects().length;
      console.log('⏰ [Whiteboard] Periodic check - Objects:', objectCount, 'Timestamp:', new Date().toLocaleTimeString());
      
      if (objectCount === 0) {
        console.warn('⚠️ [Whiteboard] Periodic check found EMPTY canvas!');
      }
    }, 3000); // 每3秒检查一次

    fabricCanvasRef.current = canvasInstance;
    
    console.log('✅ [Whiteboard] Canvas initialization completed successfully');

    // 清理函数
    return () => {
      console.log('🧹 [Whiteboard] Cleaning up canvas');
      clearInterval(statusChecker); // 清理定时器
      
      if (canvasInstance && fabricCanvasRef.current === canvasInstance) {
        // 移除所有事件监听器
        canvasInstance.off('mouse:down', handleMouseDown);
        canvasInstance.off('mouse:up', handleMouseUp);
        canvasInstance.off('path:created', handlePathCreated);
        canvasInstance.off('object:added', handleObjectAdded);
        canvasInstance.off('object:removed', handleObjectRemoved);
        canvasInstance.off('canvas:cleared', handleCanvasCleared);
        canvasInstance.off('before:path:created', handleDrawingStart);
        
        canvasInstance.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [width, height, initialIsDrawingMode]); // 🔧 修复：只依赖canvas尺寸和绘图模式，不依赖画笔属性

  // 🔧 修复画笔更新Effect - 添加详细LOG监控
  useEffect(() => {
    console.log('🖌️ [Whiteboard] Brush update effect triggered - Size:', brushSize, 'Color:', brushColor);
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.warn('⚠️ [Whiteboard] Canvas not available for brush update');
      return;
    }

    // 更新画笔属性，保持现有画笔实例
    if (canvas.freeDrawingBrush) {
      console.log('🔄 [Whiteboard] Updating existing brush properties');
      canvas.freeDrawingBrush.width = brushSize;
      canvas.freeDrawingBrush.color = brushColor;
    } else {
      console.log('🆕 [Whiteboard] Creating new brush instance');
      const brush = new fabric.PencilBrush(canvas);
      brush.width = brushSize;
      brush.color = brushColor;
      (brush as any).decimate = 8;
      (brush as any).controlPointsNum = 2;
      canvas.freeDrawingBrush = brush;
    }
    
    console.log('✅ [Whiteboard] Brush update completed - Width:', canvas.freeDrawingBrush?.width, 'Color:', canvas.freeDrawingBrush?.color);
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

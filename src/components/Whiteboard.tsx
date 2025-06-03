import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import './Whiteboard.css'; // 重新启用CSS
// import Toolbar from './Toolbar'; // 移除Toolbar
import { AIGenerationPanel } from './AIGeneration/AIGenerationPanel';
import { LogViewer } from './LogViewer/LogViewer';
import FloatingMenu from './FloatingMenu/FloatingMenu';
import ImageUploader from './ImageUpload/ImageUploader';
import { ProcessedImage } from './ImageUpload/ImageProcessor';

// Type alias for Fabric.js Canvas instance with custom properties if any
interface FabricCanvas extends fabric.Canvas {
  freeDrawingBrush?: fabric.PencilBrush;
}

// Props for the Whiteboard component
interface WhiteboardProps {
  width?: number;
  height?: number;
  // isDrawingMode?: boolean; // 移除未使用的参数
}

// Whiteboard component: Main component for the drawing canvas
const Whiteboard = ({ 
  width = 900,  // 修复：与CSS容器尺寸匹配
  height = 650, // 修复：与CSS容器尺寸匹配
}: WhiteboardProps) => {
  // Refs for canvas DOM element and Fabric canvas instance
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);

  // State for UI elements and drawing properties
  // const [brushSize, setBrushSize] = useState(5); // 注释掉未使用的变量
  // const [brushColor] = useState('#000000'); // 注释掉未使用的变量
  
  // State for AI generation panel - isAIGenerationOpen might not be needed if panel is fully replaced
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAIGenerationOpen, setIsAIGenerationOpen] = useState(false); 
  // canvasSnapshot is still useful for analysis/generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [canvasSnapshot, setCanvasSnapshot] = useState<string>(''); 

  // State for log viewer
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  // State for floating menu (right-click upload)
  const [floatingMenuPosition, setFloatingMenuPosition] = useState<{x: number, y: number} | null>(null);
  const [showImageUploader, setShowImageUploader] = useState(false);

  // 🔍 组件渲染监控 - 暂时注释掉避免编译错误
  // console.log('🔄 [Whiteboard] Component RENDER - brushSize:', brushSize, 'timestamp:', Date.now());

  // --- Helper Functions ---
  
  // 移除未使用的createBrush函数 - 现在都用内联创建
  // 移除未使用的recordCanvasState函数 - 现在都用内联记录  
  // 移除未使用的generateCanvasSnapshot函数 - 现在都用内联生成
  // 移除未使用的handleUndo函数 - 现在都用内联处理
  // 移除未使用的manageSelectionRect函数 - 现在都用内联管理

  // --- Callbacks ---

  // Handler for brush size changes - 注释掉未使用的函数
  // const handleBrushSizeChange = useCallback((newSize: number) => {
  //   setBrushSize(newSize);
  // }, []);

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

  // 处理图片上传
  const handleImageUploaded = useCallback((processedImage: ProcessedImage) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas not available for image upload');
      return;
    }

    const img = new Image();
    img.onload = () => {
      const fabricImage = new fabric.Image(img, {
        left: floatingMenuPosition?.x || 100,
        top: floatingMenuPosition?.y || 100,
        scaleX: 0.3,
        scaleY: 0.3,
        selectable: true,
        hasControls: true,
        evented: true
      });

      canvas.add(fabricImage);
      canvas.renderAll();
    };

    img.src = processedImage.dataUrl;
    setFloatingMenuPosition(null); // 关闭菜单
    setShowImageUploader(false); // 关闭上传器
  }, [floatingMenuPosition]);

  // --- Effects ---

  // Effect for initializing and managing the Fabric canvas instance
  useEffect(() => {
    console.log('🚀 [Whiteboard] Initializing canvas with dimensions:', width, 'x', height);
    
    if (!canvasElRef.current) {
      console.error('[Whiteboard] Canvas element not found');
      return;
    }

    // 复制canvasElRef.current到局部变量，避免在cleanup中访问可能已变化的ref
    const canvasElement = canvasElRef.current;

    // 如果已存在canvas实例，先清理
    if (fabricCanvasRef.current) {
      console.log('🧹 [Whiteboard] Disposing existing canvas instance');
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    // 创建新的 Fabric.js 画布实例 - 最简配置
    const canvasInstance = new fabric.Canvas(canvasElement, {
        width,
        height,
      backgroundColor: '#fefcf8',
        isDrawingMode: true, // 直接启用绘图模式
        stopContextMenu: true, // 阻止原生右键菜单
        fireRightClick: true,  // 启用右键事件
      }) as FabricCanvas;

    // 🔧 强制设置DOM canvas元素尺寸，确保与Fabric实例匹配
    canvasElement.width = width;
    canvasElement.height = height;
    canvasElement.style.width = width + 'px';
    canvasElement.style.height = height + 'px';
    console.log('🔧 [Whiteboard] Forced DOM canvas size to match Fabric:', width, 'x', height);

    // 设置画笔 - 最简配置
    const brush = new fabric.PencilBrush(canvasInstance);
    brush.width = 5;
    brush.color = '#000000';
    canvasInstance.freeDrawingBrush = brush;
    
    // 使用fabric.js的事件系统处理右键点击
    const rightClickHandler = (opt: any) => {
      if (opt.e instanceof MouseEvent && opt.e.button === 2) {
        opt.e.preventDefault();
        // 使用fabric.js提供的指针位置，更准确
        const pointer = canvasInstance.getPointer(opt.e);
        setFloatingMenuPosition({
          x: pointer.x,
          y: pointer.y
        });
        console.log('🖱️ Right click at:', pointer.x, pointer.y);
      }
    };
    
    // 添加fabric事件监听器
    canvasInstance.on('mouse:down', rightClickHandler);
    
    // 额外确保阻止DOM的contextmenu事件
    const domContextMenuHandler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    canvasElement.addEventListener('contextmenu', domContextMenuHandler, { capture: true });

    // 🔧 移除所有事件监听器，只保留基本功能
    console.log('✅ [Whiteboard] Minimal canvas setup completed');

    fabricCanvasRef.current = canvasInstance;
    
    // 简化的清理函数
    return () => {
      console.log('🧹 [Whiteboard] Cleaning up canvas');
      canvasElement.removeEventListener('contextmenu', domContextMenuHandler);
      canvasInstance.off('mouse:down', rightClickHandler);
      if (canvasInstance && fabricCanvasRef.current === canvasInstance) {
        canvasInstance.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [width, height]);

  return (
    <div className="whiteboard-wrapper">
      {/* <Toolbar /> */}
      
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

      {/* 右键浮动菜单 */}
      {floatingMenuPosition && (
        <FloatingMenu
          position={floatingMenuPosition}
          onUploadClick={() => {
            console.log('🔄 FloatingMenu upload clicked');
            setShowImageUploader(true);
          }}
          onClose={() => setFloatingMenuPosition(null)}
        />
      )}

      {/* 图片上传器 */}
      {showImageUploader && (
        <ImageUploader onImageProcessed={handleImageUploaded}>
          {(triggerUpload) => {
            // 自动触发上传
            console.log('📁 ImageUploader rendered, auto-triggering upload');
            setTimeout(() => triggerUpload(), 100);
            return <div style={{ display: 'none' }} />;
          }}
        </ImageUploader>
      )}
    </div>
  );
};

export default Whiteboard;

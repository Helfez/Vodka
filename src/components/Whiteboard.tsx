import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import './Whiteboard.css';
import Toolbar from './Toolbar';
import UndoButton from './UndoButton';
import FloatingMenu from './FloatingMenu/FloatingMenu';
import ImageUploader from './ImageUpload/ImageUploader';
import { ProcessedImage } from './ImageUpload/ImageProcessor';
import { PhotoEffect } from './ImageUpload/PhotoEffect/PhotoEffect';
import { FloatingButton } from './ImageSticker/components/FloatingButton';
import { FloatingButtonPosition } from './ImageSticker/services/types';
import { LogViewer } from './LogViewer/LogViewer';
import { AIGenerationPanel } from './AIGeneration/AIGenerationPanel';

// Type alias for Fabric.js Canvas instance with custom properties if any
// (Currently, freeDrawingBrush is a standard property but explicitly typed for clarity)
interface FabricCanvas extends fabric.Canvas {
  freeDrawingBrush?: fabric.PencilBrush;
}

// Interface for storing a snapshot of the canvas state for history
interface DrawingState {
  canvasState: string; // JSON string representation of canvas objects
  timestamp: number;   // Timestamp of when the state was saved
}

// Props for the Whiteboard component
interface WhiteboardProps {
  width?: number;
  height?: number;
  isDrawingMode?: boolean;
}

// 配置画笔函数
const configureBrush = (canvas: FabricCanvas, size: number, color: string) => {
  console.log('[Whiteboard configureBrush] Configuring brush with size:', size);
  const brush = new fabric.PencilBrush(canvas);
  brush.width = size;
  brush.color = color;
  
  // 添加贝塞尔曲线平滑
  (brush as any).decimate = 8;         // 采样点间隔
  (brush as any).controlPointsNum = 2; // 控制点数量
  return brush;
};

// Whiteboard component: Main component for the drawing canvas
const Whiteboard = ({ 
  width = 800, 
  height = 600, 
  isDrawingMode: initialIsDrawingMode = true // Renamed prop to avoid conflict with canvas property
}: WhiteboardProps) => {
  console.log('[Whiteboard] Component rendered/re-rendered');

  // Refs for canvas DOM element and Fabric canvas instance
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);

  // State for UI elements and drawing properties
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState(5);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [brushColor, setBrushColor] = useState('#000000');
  const [history, setHistory] = useState<DrawingState[]>([]);
  
  // State for sticker button visibility and position
  const [stickerButtonPosition, setStickerButtonPosition] = useState<FloatingButtonPosition | null>(null);

  // State for AI generation panel - isAIGenerationOpen might not be needed if panel is fully replaced
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAIGenerationOpen, setIsAIGenerationOpen] = useState(false); 
  // canvasSnapshot is still useful for analysis/generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [canvasSnapshot, setCanvasSnapshot] = useState<string>(''); 

  // State for log viewer
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  // --- Callbacks --- 

  // Callback to record the current canvas state for undo history
  const recordState = useCallback(() => {
    const currentCanvas = fabricCanvasRef.current;
    if (!currentCanvas) {
      console.warn('[Whiteboard recordState] Canvas ref is null, cannot record state.');
      return;
    }
    console.log('[Whiteboard recordState] Recording state. Objects:', currentCanvas.getObjects().length);
    const currentState: DrawingState = {
      canvasState: JSON.stringify(currentCanvas.toJSON()),
      timestamp: Date.now()
    };
    setHistory(prev => {
      const newHistory = [...prev, currentState].slice(-20); 
      return newHistory;
    });
  }, [fabricCanvasRef, setHistory]);

  // Callback to handle the undo action
  const handleUndo = useCallback(() => {
    const currentCanvas = fabricCanvasRef.current;
    if (!currentCanvas) {
      console.warn('[Whiteboard handleUndo] Canvas ref is null, cannot undo.');
      return;
    }

    setHistory(prevHistory => {
      console.log('[Whiteboard handleUndo] Attempting undo. History length:', prevHistory.length);
      if (prevHistory.length <= 1) { 
        console.log('[Whiteboard handleUndo] No more states to undo or only initial state left.');
        return prevHistory; 
      }

      try {
        const prevState = prevHistory[prevHistory.length - 2]; 
        console.log('[Whiteboard handleUndo] Reverting to state from timestamp:', prevState.timestamp);
        currentCanvas.loadFromJSON(JSON.parse(prevState.canvasState), () => {
          currentCanvas.renderAll();
          currentCanvas.isDrawingMode = initialIsDrawingMode; 
          currentCanvas.freeDrawingBrush = configureBrush(currentCanvas, brushSize, brushColor);
          console.log('[Whiteboard handleUndo] Canvas loaded from previous state.');
        });
        return prevHistory.slice(0, -1); 
      } catch (error) {
        console.error('[Whiteboard handleUndo] Failed to undo:', error);
        return prevHistory; 
      }
    });
  }, [setHistory, fabricCanvasRef, brushSize, brushColor, initialIsDrawingMode]); 

  // Helper to get canvas snapshot
  const getCanvasSnapshotDataURL = useCallback((): string | null => {
    console.log('[Whiteboard getCanvasSnapshotDataURL] Attempting to get canvas snapshot.');
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard getCanvasSnapshotDataURL] ❌ Canvas is not available.');
      return null;
    }
    try {
      const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 1,
      });
      console.log('[Whiteboard getCanvasSnapshotDataURL] ✅ Snapshot generated successfully.');
      // Auto-download PNG
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = dataURL;
      link.download = `whiteboard-snapshot-${timestamp}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('[Whiteboard getCanvasSnapshotDataURL] 💾 Snapshot auto-downloaded.');
      setCanvasSnapshot(dataURL); // Keep updating this state if other parts still use it
      return dataURL;
    } catch (error) {
      console.error('[Whiteboard getCanvasSnapshotDataURL] ❌ Failed to generate snapshot:', error);
      return null;
    }
  }, [fabricCanvasRef]); // Removed setCanvasSnapshot from deps as it's directly in function

  // New: "生图" button's main handler - 改为打开AIGenerationPanel
  const handleDirectImageGeneration = useCallback(async () => {
    console.log('[Whiteboard handleDirectImageGeneration] === Opening AI Generation Panel ===');
    
    // 获取画布快照
    const snapshot = getCanvasSnapshotDataURL();
    if (snapshot) {
      setCanvasSnapshot(snapshot);
      setIsAIGenerationOpen(true);
    } else {
      alert('无法获取画板快照，请重试');
    }
  }, [getCanvasSnapshotDataURL]);

  // 处理AI生成的图片
  const handleAIImageGenerated = useCallback((imageUrl: string) => {
    console.log('[Whiteboard handleAIImageGenerated] === AI图片集成开始 ===');
    console.log('[Whiteboard handleAIImageGenerated] 📥 接收到图片URL:', imageUrl.substring(0, 50) + '...');
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard handleAIImageGenerated] ❌ Canvas不可用，无法添加图片');
      return;
    }

    console.log('[Whiteboard handleAIImageGenerated] 🖼️ 开始加载图片...');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const loadStartTime = performance.now();
    
    img.onload = () => {
      const loadEndTime = performance.now();
      console.log('[Whiteboard handleAIImageGenerated] ✅ 图片加载完成:');
      console.log('  - 加载耗时:', Math.round(loadEndTime - loadStartTime), 'ms');
      console.log('  - 图片尺寸:', img.width, 'x', img.height);
      
      try {
        console.log('[Whiteboard handleAIImageGenerated] 🎯 计算图片位置...');
        const canvasCenter = {
          x: canvas.getWidth() / 2,
          y: canvas.getHeight() / 2
        };
        const imagePosition = {
          x: clickPosition?.x || canvasCenter.x - img.width / 4,
          y: clickPosition?.y || canvasCenter.y - img.height / 4
        };
        
        console.log('[Whiteboard handleAIImageGenerated] 📍 图片位置信息:');
        console.log('  - 画布中心:', canvasCenter);
        console.log('  - 图片位置:', imagePosition);
        console.log('  - 缩放比例: 0.5');

        const fabricImage = new fabric.Image(img, {
          left: imagePosition.x,
          top: imagePosition.y,
          scaleX: 0.5,
          scaleY: 0.5,
          selectable: true,
          hasControls: true,
          evented: true
        });

        console.log('[Whiteboard handleAIImageGenerated] ➕ 添加图片到画布...');
        canvas.add(fabricImage);
        canvas.setActiveObject(fabricImage);
        canvas.renderAll();

        console.log('[Whiteboard handleAIImageGenerated] 💾 记录历史状态...');
        requestAnimationFrame(() => {
          recordState();
        });

        console.log('[Whiteboard handleAIImageGenerated] ✅ AI图片集成完成');
      } catch (error) {
        console.error('[Whiteboard handleAIImageGenerated] ❌ 图片添加到画布失败:', error);
      }
    };

    img.onerror = (errorEvent) => {
      console.error('[Whiteboard handleAIImageGenerated] ❌ 图片加载失败:', errorEvent);
    };

    img.src = imageUrl;
  }, [clickPosition, recordState]);

  // --- Effects --- 

  // Effect for initializing and managing the Fabric canvas instance
  useEffect(() => {
    console.log('[Whiteboard CanvasLifecycle useEffect] Running. Deps:', { width, height, initialIsDrawingMode, brushSize, brushColor });

    if (!canvasElRef.current) {
      console.warn('[Whiteboard CanvasLifecycle useEffect] canvasElRef is null. Bailing out.');
      return;
    }

    let canvasInstance = fabricCanvasRef.current;

    if (!canvasInstance || canvasInstance.getWidth() !== width || canvasInstance.getHeight() !== height) {
      if (canvasInstance) {
        console.log('[Whiteboard CanvasLifecycle useEffect] Disposing existing canvas.');
        canvasInstance.dispose(); 
      }
      console.log('[Whiteboard CanvasLifecycle useEffect] Creating new Fabric canvas.');
      canvasInstance = new fabric.Canvas(canvasElRef.current, {
        width,
        height,
        backgroundColor: '#ffffff', 
        isDrawingMode: initialIsDrawingMode, 
      }) as FabricCanvas;
      fabricCanvasRef.current = canvasInstance; 
      console.log('[Whiteboard CanvasLifecycle useEffect] New canvas created.');
    } else {
      console.log('[Whiteboard CanvasLifecycle useEffect] Using existing canvas.');
    }

    console.log('[Whiteboard CanvasLifecycle useEffect] Applying properties. DrawingMode:', initialIsDrawingMode, 'BrushSize:', brushSize);
    canvasInstance.isDrawingMode = initialIsDrawingMode;
    canvasInstance.freeDrawingBrush = configureBrush(canvasInstance, brushSize, brushColor);
    canvasInstance.renderOnAddRemove = true; 
    canvasInstance.preserveObjectStacking = true;

    const handleMouseDownLocal = (e: fabric.TEvent) => { 
      console.log('[Whiteboard mouse:down] Event:', e);
      if (fabricCanvasRef.current?.isDrawingMode) {
        setStickerButtonPosition(null); 
      }
    };

    const handlePathCreatedLocal = (e: fabric.TEvent & { path: fabric.Path }) => { 
      console.log('[Whiteboard path:created] Path created:', e.path);
      requestAnimationFrame(recordState); 
    };

    const handleMouseUpLocal = (e: fabric.TEvent) => { 
      console.log('[Whiteboard mouse:up] Event:', e);
    };

    const handleKeyboardLocal = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); 
        handleUndo(); 
      }
      // Ctrl/Cmd + G for the new direct image generation flow
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        // handleOpenAIGeneration(); // Old behavior
        handleDirectImageGeneration(); // New behavior
      }
    };

    console.log('[Whiteboard CanvasLifecycle useEffect] Attaching event listeners.');
    canvasInstance.on('mouse:down', handleMouseDownLocal);
    canvasInstance.on('path:created', handlePathCreatedLocal);
    canvasInstance.on('mouse:up', handleMouseUpLocal);
    window.addEventListener('keydown', handleKeyboardLocal);

    return () => {
      console.log('[Whiteboard CanvasLifecycle useEffect Cleanup] Cleaning up listeners.');
      window.removeEventListener('keydown', handleKeyboardLocal);
      if (canvasInstance && fabricCanvasRef.current === canvasInstance) {
        console.log('[Whiteboard CanvasLifecycle useEffect Cleanup] Detaching listeners.');
        canvasInstance.off('mouse:down', handleMouseDownLocal);
        canvasInstance.off('path:created', handlePathCreatedLocal);
        canvasInstance.off('mouse:up', handleMouseUpLocal);
      }
    };
  }, [width, height, initialIsDrawingMode, brushSize, brushColor, handleUndo, recordState, handleDirectImageGeneration]); // Added handleDirectImageGeneration to deps

  // Effect for setting the initial history
  useEffect(() => {
    if (fabricCanvasRef.current && history.length === 0) {
      console.log('[Whiteboard InitialHistory useEffect] Setting initial history state.');
      const initialState: DrawingState = {
        canvasState: JSON.stringify(fabricCanvasRef.current.toJSON()), 
        timestamp: Date.now()
      };
      setHistory([initialState]); 
      console.log('[Whiteboard InitialHistory useEffect] Initial history state set.');
    }
  }, [fabricCanvasRef, history.length]); 

  // Effect for component unmount
  useEffect(() => {
    return () => {
      if (fabricCanvasRef.current) {
        console.log('[Whiteboard Unmount Cleanup] Disposing canvas on component unmount.');
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []); 

  // Handler for context menu (right-click)
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    console.log('[Whiteboard handleContextMenu] Context menu event triggered at:', event.clientX, event.clientY);
    event.preventDefault();
    
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const pointer = canvas.getPointer(event.nativeEvent);
    const objects = canvas.getObjects();
    const clickedImage = objects.find(obj => 
      obj instanceof fabric.Image && 
      obj.containsPoint(pointer)
    ) as fabric.Image | undefined;

    if (clickedImage) {
      const bounds = clickedImage.getBoundingRect();
      
      const existingSelection = objects.find(obj => 
        obj instanceof fabric.Rect && 
        (obj as any).data?.type === 'selection-rect'
      );
      if (existingSelection) {
        canvas.remove(existingSelection);
      }
      
      const selectionRect = new fabric.Rect({
        left: bounds.left - 2,
        top: bounds.top - 2,
        width: bounds.width + 4,
        height: bounds.height + 4,
        fill: 'transparent',
        stroke: '#2196F3',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        data: { type: 'selection-rect' }
      });
      
      canvas.add(selectionRect);
      canvas.renderAll();

      setStickerButtonPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top - 20,
        target: clickedImage
      });
    } else {
      const existingSelection = objects.find(obj => 
        obj instanceof fabric.Rect && 
        (obj as any).data?.type === 'selection-rect'
      );
      if (existingSelection) {
        canvas.remove(existingSelection);
        canvas.renderAll();
      }

      setMenuPosition({ x: event.clientX, y: event.clientY });
      setClickPosition({ x, y });
      setStickerButtonPosition(null);
    }
  }, []);

  // 处理贴纸转换
  const handleStickerConvert = useCallback(() => {
    console.log('[Whiteboard handleStickerConvert] Sticker convert called.');
    if (!stickerButtonPosition) return;
    console.log('[Whiteboard handleStickerConvert] 开始转换贴纸...');
    // Logic is in FloatingButton
  }, [stickerButtonPosition]);

  // 处理图片上传
  const handleImageProcessed = useCallback(async (processedImage: ProcessedImage) => {
    console.log('[Whiteboard handleImageProcessed] === 图片上传处理开始 ===');
    console.log('  - 尺寸:', processedImage.width, 'x', processedImage.height);
    
    if (!fabricCanvasRef.current || !clickPosition) {
        console.error('[Whiteboard handleImageProcessed] ❌ Canvas或点击位置不可用');
        return;
    }

    const canvas = fabricCanvasRef.current;
    console.log('[Whiteboard handleImageProcessed] 📍 放置位置:', clickPosition);
    
    const img = new Image();
    const loadStartTime = performance.now();
    
    img.onload = () => {
      const loadEndTime = performance.now();
      console.log('[Whiteboard handleImageProcessed] ✅ 图片加载完成，耗时:', Math.round(loadEndTime - loadStartTime), 'ms');
      
      const imagePosition = {
        x: clickPosition.x - processedImage.width / 2,
        y: clickPosition.y - processedImage.height / 2
      };
      
      const fabricImage = new fabric.Image(img, {
        left: imagePosition.x,
        top: imagePosition.y,
        selectable: false,
        hasControls: false,
        evented: true
      });

      canvas.add(fabricImage);

      try {
        console.log('[Whiteboard handleImageProcessed] ✨ 应用照片效果...');
        PhotoEffect.applyPhotoEffect(fabricImage, {
          animation: {
            initial: { scale: 0.7, opacity: 0, rotation: -20 },
            final: { scale: 1, opacity: 1, rotation: Math.random() * 6 - 3 },
            duration: 1200,
            easing: 'easeOutBack'
          }
        });

        fabricImage.set({ selectable: true, hasControls: true, evented: true });

        fabricImage.on('selected', () => {
          console.log('[Whiteboard handleImageProcessed] 🎯 图片被选中');
          const bounds = fabricImage.getBoundingRect();
          setStickerButtonPosition({
            x: bounds.left + bounds.width / 2,
            y: bounds.top - 20,
            target: fabricImage
          });
        });

        fabricImage.on('deselected', () => {
          console.log('[Whiteboard handleImageProcessed] ⭕ 图片取消选中');
          setStickerButtonPosition(null);
        });

      } catch (error: any) {
        console.error('[Whiteboard handleImageProcessed] ❌ 照片效果应用失败:', error);
      } finally {
        canvas.renderAll();
      }

      requestAnimationFrame(() => {
        recordState(); // Use existing recordState
      });

      setMenuPosition(null);
      setClickPosition(null);
      console.log('[Whiteboard handleImageProcessed] === 图片上传处理完成 ===');
    };

    img.src = processedImage.dataUrl;
  }, [clickPosition, recordState]); // Added recordState

  return (
    <div className="whiteboard-wrapper">
      <Toolbar 
        brushSize={brushSize}
        onBrushSizeChange={(newSize: number) => {
          console.log('[Whiteboard handleBrushSizeChange] New size:', newSize);
          setBrushSize(newSize);
          const canvas = fabricCanvasRef.current;
          if (canvas?.freeDrawingBrush) {
            canvas.freeDrawingBrush.width = newSize;
          }
        }}
      />
      
      <div className="ai-generation-trigger">
        <button
          className="ai-generation-btn"
          onClick={handleDirectImageGeneration} // Updated onClick
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
        <div 
          className="whiteboard-container"
          onContextMenu={handleContextMenu}
        >
          <UndoButton 
            canUndo={history.length > 1}
            onUndo={handleUndo}
          />
          <div className="canvas-wrapper">
            <canvas ref={canvasElRef} />
          </div>
          {menuPosition && (
            <ImageUploader onImageProcessed={handleImageProcessed}>
              <FloatingMenu
                position={menuPosition}
                onUploadClick={() => {}} // This probably triggers the uploader
                onClose={() => {
                  setMenuPosition(null);
                  setClickPosition(null);
                }}
              />
            </ImageUploader>
          )}
          {stickerButtonPosition && (
            <FloatingButton
              position={stickerButtonPosition}
              onConvert={handleStickerConvert}
              onClose={() => setStickerButtonPosition(null)}
              targetImage={stickerButtonPosition.target}
            />
          )}
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

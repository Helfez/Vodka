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

  // --- Helper Functions ---
  
  // 统一的画笔创建函数，避免重复代码
  const createBrush = useCallback((canvas: FabricCanvas, width: number = 5, color: string = '#000000') => {
    const brush = new fabric.PencilBrush(canvas);
    brush.width = width;
    brush.color = color;
    (brush as any).decimate = 8;
    (brush as any).controlPointsNum = 2;
    return brush;
  }, []);

  // 统一的历史记录函数，避免重复代码
  const recordCanvasState = useCallback(() => {
    const currentCanvas = fabricCanvasRef.current;
    if (!currentCanvas) {
      console.warn('[Whiteboard recordCanvasState] Canvas ref is null, cannot record state.');
      return;
    }
    console.log('[Whiteboard recordCanvasState] Recording state. Objects:', currentCanvas.getObjects().length);
    const currentState: DrawingState = {
      canvasState: JSON.stringify(currentCanvas.toJSON()),
      timestamp: Date.now()
    };
    setHistory(prev => {
      const newHistory = [...prev, currentState].slice(-20); 
      return newHistory;
    });
  }, []);

  // 统一的快照生成和下载函数，避免重复代码
  const generateCanvasSnapshot = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard generateCanvasSnapshot] ❌ Canvas is not available.');
      return null;
    }
    try {
      const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 1,
      });
      console.log('[Whiteboard generateCanvasSnapshot] ✅ Snapshot generated successfully.');
      
      // Auto-download PNG
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = dataURL;
      link.download = `whiteboard-snapshot-${timestamp}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('[Whiteboard generateCanvasSnapshot] 💾 Snapshot auto-downloaded.');
      
      return dataURL;
    } catch (error) {
      console.error('[Whiteboard generateCanvasSnapshot] ❌ Failed to generate snapshot:', error);
      alert('无法获取画板快照，请重试');
      return null;
    }
  }, []);

  // 统一的撤销函数，避免重复代码
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
          console.log('[Whiteboard handleUndo] 🖌️ 恢复画布绘图状态...');
          currentCanvas.isDrawingMode = initialIsDrawingMode; 
          // 恢复画笔设置 - 使用统一的createBrush函数，确保画笔状态正确恢复
          const currentBrushSize = brushSize; // 使用当前的画笔大小，不是之前的
          const currentBrushColor = brushColor; // 使用当前的画笔颜色，不是之前的
          currentCanvas.freeDrawingBrush = createBrush(currentCanvas, currentBrushSize, currentBrushColor);
          currentCanvas.renderAll();
          console.log('[Whiteboard handleUndo] ✅ Canvas loaded from previous state with drawing mode restored.');
        });
        return prevHistory.slice(0, -1); 
      } catch (error) {
        console.error('[Whiteboard handleUndo] Failed to undo:', error);
        return prevHistory; 
      }
    });
  }, [initialIsDrawingMode, createBrush, brushSize, brushColor]);

  // 统一的选择矩形管理函数，避免重复代码
  const manageSelectionRect = useCallback((canvas: FabricCanvas, bounds?: { left: number; top: number; width: number; height: number } | null) => {
    // 移除现有的选择矩形
    const objects = canvas.getObjects();
    const existingSelection = objects.find(obj => 
      obj.type === 'rect' && 
      (obj as any).data?.type === 'selection-rect'
    );
    if (existingSelection) {
      canvas.remove(existingSelection);
    }

    // 如果提供了bounds，创建新的选择矩形
    if (bounds) {
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
    }
    
    canvas.renderAll();
  }, []);

  // --- Callbacks ---

  // 处理画笔大小变化
  const handleBrushSizeChange = useCallback((newSize: number) => {
    console.log('[Whiteboard handleBrushSizeChange] New size:', newSize);
    setBrushSize(newSize);
    const canvas = fabricCanvasRef.current;
    if (canvas?.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = newSize;
    }
  }, []);

  // 处理AI生成面板打开
  const handleOpenAIPanel = useCallback(() => {
    console.log('[Whiteboard handleOpenAIPanel] === Opening AI Generation Panel ===');
    
    // 生成快照并打开AI面板
    const dataURL = generateCanvasSnapshot();
    if (dataURL) {
      setCanvasSnapshot(dataURL);
      setIsAIGenerationOpen(true);
    }
  }, [generateCanvasSnapshot]);

  // 处理AI生成的图片
  const handleAIImageGenerated = useCallback((imageUrl: string) => {
    console.log('[Whiteboard] AI图片集成开始');
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas不可用，无法添加图片');
      return;
    }

    // 保存当前画布状态
    const currentDrawingMode = canvas.isDrawingMode;
    const currentBrush = canvas.freeDrawingBrush;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvasCenter = {
          x: canvas.getWidth() / 2,
          y: canvas.getHeight() / 2
        };
        const imagePosition = {
          x: clickPosition?.x || canvasCenter.x - img.width / 4,
          y: clickPosition?.y || canvasCenter.y - img.height / 4
        };

        const fabricImage = new fabric.Image(img, {
          left: imagePosition.x,
          top: imagePosition.y,
          scaleX: 0.5,
          scaleY: 0.5,
          selectable: true,
          hasControls: true,
          evented: true
        });

        canvas.add(fabricImage);
        canvas.setActiveObject(fabricImage);
        
        // 恢复画布绘图状态
        canvas.isDrawingMode = currentDrawingMode;
        if (!currentBrush) {
          canvas.freeDrawingBrush = createBrush(canvas, canvas.freeDrawingBrush?.width || brushSize, canvas.freeDrawingBrush?.color || brushColor);
        } else {
          canvas.freeDrawingBrush = currentBrush;
        }
        canvas.renderAll();

        requestAnimationFrame(() => {
          // 记录历史状态
          recordCanvasState();
        });

        console.log('[Whiteboard] AI图片集成完成');
      } catch (error) {
        console.error('[Whiteboard] 图片添加到画布失败:', error);
        // 恢复画布状态
        canvas.isDrawingMode = currentDrawingMode;
        if (!currentBrush) {
          canvas.freeDrawingBrush = createBrush(canvas, canvas.freeDrawingBrush?.width || brushSize, canvas.freeDrawingBrush?.color || brushColor);
        } else {
          canvas.freeDrawingBrush = currentBrush;
        }
        canvas.renderAll();
      }
    };

    img.onerror = (errorEvent) => {
      console.error('[Whiteboard] 图片加载失败:', errorEvent);
      // 恢复画布状态
      canvas.isDrawingMode = currentDrawingMode;
      if (!currentBrush) {
        canvas.freeDrawingBrush = createBrush(canvas, canvas.freeDrawingBrush?.width || brushSize, canvas.freeDrawingBrush?.color || brushColor);
      } else {
        canvas.freeDrawingBrush = currentBrush;
      }
    };

    img.src = imageUrl;
  }, [clickPosition, createBrush, recordCanvasState, brushSize, brushColor]);

  // --- Effects --- 

  // Effect for initializing and managing the Fabric canvas instance
  useEffect(() => {
    console.log('[Whiteboard CanvasLifecycle useEffect] Running. Deps:', { width, height, initialIsDrawingMode });

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

    console.log('[Whiteboard CanvasLifecycle useEffect] Applying properties. DrawingMode:', initialIsDrawingMode);
    canvasInstance.isDrawingMode = initialIsDrawingMode;
    // 初始画笔设置 - 使用统一的createBrush函数
    canvasInstance.freeDrawingBrush = createBrush(canvasInstance, brushSize, brushColor);
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
      // 记录当前状态到历史 - 使用统一的recordCanvasState函数
      recordCanvasState();
    };

    const handleMouseUpLocal = (e: fabric.TEvent) => { 
      console.log('[Whiteboard mouse:up] Event:', e);
    };

    const handleKeyboardLocal = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); 
        // 使用内联函数调用undo逻辑
        handleUndo();
      }
      // Ctrl/Cmd + G for the new direct image generation flow
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        // 内联调用直接生图逻辑
        console.log('[Whiteboard handleDirectImageGeneration] === Opening AI Generation Panel ===');
        
        // 生成快照并打开AI面板
        const dataURL = generateCanvasSnapshot();
        if (dataURL) {
          setCanvasSnapshot(dataURL);
          setIsAIGenerationOpen(true);
        }
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
  }, [width, height, initialIsDrawingMode, createBrush, brushSize, brushColor, handleUndo, generateCanvasSnapshot, recordCanvasState]);

  // 单独的Effect来处理画笔属性更新，避免重新创建画布
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas && canvas.isDrawingMode) {
      console.log('[Whiteboard BrushUpdate useEffect] Updating brush properties:', { brushSize, brushColor });
      // 总是创建新画笔以确保属性正确应用，避免属性不同步
      canvas.freeDrawingBrush = createBrush(canvas, brushSize, brushColor);
    }
  }, [brushSize, brushColor, createBrush]);

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
  }, [history.length]); // 移除fabricCanvasRef依赖，避免死循环

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
    console.log('[Whiteboard handleContextMenu] === 右键菜单事件触发 ===');
    console.log('[Whiteboard handleContextMenu] 事件类型:', event.type);
    console.log('[Whiteboard handleContextMenu] 鼠标位置:', event.clientX, event.clientY);
    console.log('[Whiteboard handleContextMenu] 当前target:', event.currentTarget);
    
    event.preventDefault();
    event.stopPropagation();
    
    if (!fabricCanvasRef.current) {
      console.warn('[Whiteboard handleContextMenu] ❌ Canvas不可用');
      return;
    }
    
    const canvas = fabricCanvasRef.current;
    console.log('[Whiteboard handleContextMenu] ✅ Canvas状态:', {
      width: canvas.getWidth(),
      height: canvas.getHeight(),
      isDrawingMode: canvas.isDrawingMode,
      objectsCount: canvas.getObjects().length
    });
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    console.log('[Whiteboard handleContextMenu] 相对位置计算:');
    console.log('  - 容器边界:', rect);
    console.log('  - 画布内相对位置:', x, y);
    
    const pointer = canvas.getPointer(event.nativeEvent);
    console.log('[Whiteboard handleContextMenu] Fabric指针位置:', pointer);
    
    const objects = canvas.getObjects();
    const clickedImage = objects.find(obj => 
      obj.type === 'image' && 
      obj.containsPoint(pointer)
    ) as fabric.Image | undefined;

    if (clickedImage) {
      console.log('[Whiteboard handleContextMenu] 🖼️ 点击到图片，显示贴纸按钮');
      console.log('[Whiteboard handleContextMenu] 图片信息:', {
        left: clickedImage.left,
        top: clickedImage.top,
        width: clickedImage.width,
        height: clickedImage.height
      });
      
      const bounds = clickedImage.getBoundingRect();
      
      // 使用统一的选择矩形管理函数
      manageSelectionRect(canvas, bounds);

      setStickerButtonPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top - 20,
        target: clickedImage
      });
      
      console.log('[Whiteboard handleContextMenu] 贴纸按钮位置设置完成');
    } else {
      console.log('[Whiteboard handleContextMenu] 📋 点击空白区域，显示上传菜单');
      
      // 移除现有选择矩形
      manageSelectionRect(canvas, null);

      console.log('[Whiteboard handleContextMenu] 设置菜单位置:', { x: event.clientX, y: event.clientY });
      console.log('[Whiteboard handleContextMenu] 设置点击位置:', { x, y });
      
      setMenuPosition({ x: event.clientX, y: event.clientY });
      setClickPosition({ x, y });
      setStickerButtonPosition(null);
      
      console.log('[Whiteboard handleContextMenu] 菜单状态设置完成');
    }
    
    console.log('[Whiteboard handleContextMenu] === 右键菜单事件处理完成 ===');
  }, [manageSelectionRect]);

  // 处理贴纸转换
  const handleStickerConvert = useCallback((imageUrl: string) => {
    console.log('[Whiteboard] Converting image to journal-style sticker...');
    
    if (!imageUrl) {
      console.error('[Whiteboard] No image URL provided');
      return;
    }

    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas not available');
      return;
    }

    // Record state before conversion
    recordCanvasState();

    // Close sticker button
    setStickerButtonPosition(null);
    
    console.log('[Whiteboard handleStickerConvert] Converting with URL:', imageUrl);
  }, [recordCanvasState]);

  // 处理图片上传
  const handleImageProcessed = useCallback(async (processedImage: ProcessedImage) => {
    console.log('[Whiteboard] 图片上传处理开始');
    
    if (!fabricCanvasRef.current || !clickPosition) {
        console.error('[Whiteboard] Canvas或点击位置不可用');
        return;
    }

    const canvas = fabricCanvasRef.current;
    
    // 保存当前画布状态
    const currentDrawingMode = canvas.isDrawingMode;
    const currentBrush = canvas.freeDrawingBrush;
    
    const img = new Image();
    
    img.onload = () => {
      console.log('[Whiteboard] 图片加载完成');
      
      // 计算图片缩放比例，确保图片不会太大
      const maxSize = 250;
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      
      const imagePosition = {
        x: clickPosition.x - (img.width * scale) / 2,
        y: clickPosition.y - (img.height * scale) / 2
      };
      
      const fabricImage = new fabric.Image(img, {
        left: imagePosition.x,
        top: imagePosition.y,
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        hasControls: false,
        evented: false
      });

      try {
        // 设置canvas引用
        fabricImage.canvas = canvas;
        
        // 应用照片效果
        PhotoEffect.applyPhotoEffect(fabricImage, {
          animation: {
            initial: { scale: 0.7, opacity: 0, rotation: -15 },
            final: { scale: 1, opacity: 1, rotation: PhotoEffect.getRandomRotation() },
            duration: 1400,
            easing: 'easeOutBack'
          }
        });

        // 使用动画完成回调而不是固定timeout
        fabricImage.animate({}, {
          duration: 1400,
          onChange: () => canvas.renderAll(),
          onComplete: () => {
            console.log('[Whiteboard] Animation completed, setting up interactions');
            fabricImage.set({ 
              selectable: true, 
              hasControls: true, 
              evented: true 
            });
            
            // 添加选中事件监听
            fabricImage.on('selected', () => {
              const bounds = fabricImage.getBoundingRect();
              setStickerButtonPosition({
                x: bounds.left + bounds.width / 2,
                y: bounds.top - 20,
                target: fabricImage
              });
            });

            fabricImage.on('deselected', () => {
              setStickerButtonPosition(null);
            });
            
            // 恢复画布绘图状态
            canvas.isDrawingMode = currentDrawingMode;
            if (!currentBrush) {
              canvas.freeDrawingBrush = createBrush(canvas, canvas.freeDrawingBrush?.width || brushSize, canvas.freeDrawingBrush?.color || brushColor);
            } else {
              canvas.freeDrawingBrush = currentBrush;
            }
            canvas.renderAll();
            
            // 记录历史状态
            recordCanvasState();
          }
        });

      } catch (error: any) {
        console.error('[Whiteboard] 照片效果应用失败:', error);
        // fallback: 简单添加图片
        canvas.add(fabricImage);
        fabricImage.set({ selectable: true, hasControls: true, evented: true });
        
        // 恢复画笔状态
        canvas.isDrawingMode = currentDrawingMode;
        if (!currentBrush) {
          canvas.freeDrawingBrush = createBrush(canvas, canvas.freeDrawingBrush?.width || brushSize, canvas.freeDrawingBrush?.color || brushColor);
        } else {
          canvas.freeDrawingBrush = currentBrush;
        }
        canvas.renderAll();
        
        // 记录历史状态
        recordCanvasState();
      }

      setMenuPosition(null);
      setClickPosition(null);
    };

    img.onerror = (errorEvent) => {
      console.error('[Whiteboard] 图片加载失败:', errorEvent);
      // 恢复画布状态
      canvas.isDrawingMode = currentDrawingMode;
      if (!currentBrush) {
        canvas.freeDrawingBrush = createBrush(canvas, canvas.freeDrawingBrush?.width || brushSize, canvas.freeDrawingBrush?.color || brushColor);
      } else {
        canvas.freeDrawingBrush = currentBrush;
      }
      alert('图片加载失败，请重试');
    };

    img.src = processedImage.dataUrl;
  }, [clickPosition, createBrush, recordCanvasState, brushSize, brushColor]);

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
              {(triggerUpload) => (
                <FloatingMenu
                  position={menuPosition}
                  onUploadClick={triggerUpload}
                  onClose={() => {
                    setMenuPosition(null);
                    setClickPosition(null);
                  }}
                />
              )}
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

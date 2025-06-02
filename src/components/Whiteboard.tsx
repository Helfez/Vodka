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
  
  // 移除未使用的createBrush函数 - 现在都用内联创建
  // 移除未使用的recordCanvasState函数 - 现在都用内联记录  
  // 移除未使用的generateCanvasSnapshot函数 - 现在都用内联生成
  // 移除未使用的handleUndo函数 - 现在都用内联处理
  // 移除未使用的manageSelectionRect函数 - 现在都用内联管理

  // --- Callbacks ---

  // 处理画笔大小变化
  const handleBrushSizeChange = useCallback((newSize: number) => {
    setBrushSize(newSize);
    const canvas = fabricCanvasRef.current;
    if (canvas?.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = newSize;
    }
  }, []);

  // 处理画笔颜色变化 - 为未来功能预留
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleBrushColorChange = useCallback((newColor: string) => {
    setBrushColor(newColor);
    const canvas = fabricCanvasRef.current;
    if (canvas?.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = newColor;
    }
  }, []);

  // 处理AI生成面板打开
  const handleOpenAIPanel = useCallback(() => {
    // 内联快照生成
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas not available for snapshot');
      return;
    }
    try {
      const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 1,
      });
      
      // Auto-download PNG
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = dataURL;
      link.download = `whiteboard-snapshot-${timestamp}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setCanvasSnapshot(dataURL);
      setIsAIGenerationOpen(true);
    } catch (error) {
      console.error('[Whiteboard] Failed to generate snapshot:', error);
      alert('无法获取画板快照，请重试');
    }
  }, []);

  // 处理AI生成的图片
  const handleAIImageGenerated = useCallback((imageUrl: string) => {
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
          const brush = new fabric.PencilBrush(canvas);
          brush.width = canvas.freeDrawingBrush?.width || brushSize;
          brush.color = canvas.freeDrawingBrush?.color || brushColor;
          (brush as any).decimate = 8;
          (brush as any).controlPointsNum = 2;
          canvas.freeDrawingBrush = brush;
        } else {
          canvas.freeDrawingBrush = currentBrush;
        }
        canvas.renderAll();

        requestAnimationFrame(() => {
          // 记录历史状态 - 内联避免依赖
          const currentCanvas = fabricCanvasRef.current;
          if (currentCanvas) {
            const currentState: DrawingState = {
              canvasState: JSON.stringify(currentCanvas.toJSON()),
              timestamp: Date.now()
            };
            setHistory(prev => {
              const newHistory = [...prev, currentState].slice(-20); 
              return newHistory;
            });
          }
        });
      } catch (error) {
        console.error('[Whiteboard] 图片添加到画布失败:', error);
        // 恢复画布状态
        canvas.isDrawingMode = currentDrawingMode;
        if (!currentBrush) {
          const brush = new fabric.PencilBrush(canvas);
          brush.width = canvas.freeDrawingBrush?.width || brushSize;
          brush.color = canvas.freeDrawingBrush?.color || brushColor;
          (brush as any).decimate = 8;
          (brush as any).controlPointsNum = 2;
          canvas.freeDrawingBrush = brush;
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
        const brush = new fabric.PencilBrush(canvas);
        brush.width = canvas.freeDrawingBrush?.width || brushSize;
        brush.color = canvas.freeDrawingBrush?.color || brushColor;
        (brush as any).decimate = 8;
        (brush as any).controlPointsNum = 2;
        canvas.freeDrawingBrush = brush;
      } else {
        canvas.freeDrawingBrush = currentBrush;
      }
    };

    img.src = imageUrl;
  }, [clickPosition, brushSize, brushColor]);

  // --- Effects --- 

  // Effect for initializing and managing the Fabric canvas instance
  useEffect(() => {
    if (!canvasElRef.current) {
      console.warn('[Whiteboard] Canvas element not available');
      return;
    }

    let canvasInstance = fabricCanvasRef.current;

    if (!canvasInstance || canvasInstance.getWidth() !== width || canvasInstance.getHeight() !== height) {
      if (canvasInstance) {
        canvasInstance.dispose(); 
      }
      canvasInstance = new fabric.Canvas(canvasElRef.current, {
        width,
        height,
        backgroundColor: '#ffffff', 
        isDrawingMode: initialIsDrawingMode, 
      }) as FabricCanvas;
      fabricCanvasRef.current = canvasInstance; 
    }

    canvasInstance.isDrawingMode = initialIsDrawingMode;
    // 初始画笔设置 - 使用固定初始值，避免依赖状态变量
    const brush = new fabric.PencilBrush(canvasInstance);
    brush.width = 5; // 使用固定初始值
    brush.color = '#000000'; // 使用固定初始值
    (brush as any).decimate = 8;
    (brush as any).controlPointsNum = 2;
    canvasInstance.freeDrawingBrush = brush;
    canvasInstance.renderOnAddRemove = true; 
    canvasInstance.preserveObjectStacking = true;

    const handleMouseDownLocal = (e: fabric.TEvent) => { 
      if (fabricCanvasRef.current?.isDrawingMode) {
        setStickerButtonPosition(null); 
      }
    };

    const handlePathCreatedLocal = (e: fabric.TEvent & { path: fabric.Path }) => { 
      // 记录当前状态到历史 - 内联函数避免依赖
      const currentCanvas = fabricCanvasRef.current;
      if (!currentCanvas) {
        console.warn('[Whiteboard] Cannot record state: canvas not available');
        return;
      }
      const currentState: DrawingState = {
        canvasState: JSON.stringify(currentCanvas.toJSON()),
        timestamp: Date.now()
      };
      setHistory(prev => {
        const newHistory = [...prev, currentState].slice(-20); 
        return newHistory;
      });
    };

    const handleMouseUpLocal = (e: fabric.TEvent) => { 
      // Mouse up handler - kept for future use
    };

    const handleKeyboardLocal = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); 
        // 内联撤销逻辑避免依赖
        const currentCanvas = fabricCanvasRef.current;
        if (!currentCanvas) {
          console.warn('[Whiteboard] Cannot undo: canvas not available');
          return;
        }

        setHistory(prevHistory => {
          if (prevHistory.length <= 1) { 
            return prevHistory; 
          }

          try {
            const prevState = prevHistory[prevHistory.length - 2]; 
            currentCanvas.loadFromJSON(JSON.parse(prevState.canvasState), () => {
              currentCanvas.isDrawingMode = initialIsDrawingMode; 
              // 恢复画笔设置 - 使用当前状态值，确保撤销后画笔正确
              const currentBrushSize = fabricCanvasRef.current?.freeDrawingBrush?.width || 5;
              const currentBrushColor = fabricCanvasRef.current?.freeDrawingBrush?.color || '#000000';
              const brush = new fabric.PencilBrush(currentCanvas);
              brush.width = currentBrushSize;
              brush.color = currentBrushColor;
              (brush as any).decimate = 8;
              (brush as any).controlPointsNum = 2;
              currentCanvas.freeDrawingBrush = brush;
              currentCanvas.renderAll();
            });
            return prevHistory.slice(0, -1); 
          } catch (error) {
            console.error('[Whiteboard] Undo failed:', error);
            return prevHistory; 
          }
        });
      }
      // Ctrl/Cmd + G for the new direct image generation flow
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        // 内联快照生成避免依赖
        const canvas = fabricCanvasRef.current;
        if (!canvas) {
          console.error('[Whiteboard] Canvas not available for snapshot');
          return;
        }
        try {
          const dataURL = canvas.toDataURL({
            format: 'png',
            quality: 0.8,
            multiplier: 1,
          });
          
          // Auto-download PNG
          const link = document.createElement('a');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          link.href = dataURL;
          link.download = `whiteboard-snapshot-${timestamp}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          setCanvasSnapshot(dataURL);
          setIsAIGenerationOpen(true);
        } catch (error) {
          console.error('[Whiteboard] Failed to generate snapshot:', error);
          alert('无法获取画板快照，请重试');
        }
      }
    };

    canvasInstance.on('mouse:down', handleMouseDownLocal);
    canvasInstance.on('path:created', handlePathCreatedLocal);
    canvasInstance.on('mouse:up', handleMouseUpLocal);
    window.addEventListener('keydown', handleKeyboardLocal);

    return () => {
      window.removeEventListener('keydown', handleKeyboardLocal);
      if (canvasInstance && fabricCanvasRef.current === canvasInstance) {
        canvasInstance.off('mouse:down', handleMouseDownLocal);
        canvasInstance.off('path:created', handlePathCreatedLocal);
        canvasInstance.off('mouse:up', handleMouseUpLocal);
      }
    };
  }, [width, height, initialIsDrawingMode]);

  // 单独的Effect来处理画笔属性更新，避免重新创建画布
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      // 总是更新画笔属性，不管是否在绘图模式下
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.width = brushSize;
        canvas.freeDrawingBrush.color = brushColor;
        (canvas.freeDrawingBrush as any).decimate = 8;
        (canvas.freeDrawingBrush as any).controlPointsNum = 2;
      } else {
        canvas.freeDrawingBrush.width = brushSize;
        canvas.freeDrawingBrush.color = brushColor;
      }
    }
  }, [brushSize, brushColor]);

  // Effect for component unmount
  useEffect(() => {
    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []);

  // Handler for context menu (right-click)
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!fabricCanvasRef.current) {
      console.warn('[Whiteboard] Canvas not available for context menu');
      return;
    }
    
    const canvas = fabricCanvasRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pointer = canvas.getPointer(event.nativeEvent);
    
    const objects = canvas.getObjects();
    const clickedImage = objects.find(obj => 
      obj.type === 'image' && 
      obj.containsPoint(pointer)
    ) as fabric.Image | undefined;

    if (clickedImage) {
      const bounds = clickedImage.getBoundingRect();
      
      // 内联选择矩形管理 - 移除现有的选择矩形
      const existingSelection = objects.find(obj => 
        obj.type === 'rect' && 
        (obj as any).data?.type === 'selection-rect'
      );
      if (existingSelection) {
        canvas.remove(existingSelection);
      }

      // 创建新的选择矩形
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
      // 移除现有选择矩形
      const existingSelection = objects.find(obj => 
        obj.type === 'rect' && 
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
  const handleStickerConvert = useCallback((imageUrl: string) => {
    if (!imageUrl) {
      console.error('[Whiteboard] No image URL provided for sticker conversion');
      return;
    }

    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas not available for sticker conversion');
      return;
    }

    // Record state before conversion
    const currentState: DrawingState = {
      canvasState: JSON.stringify(canvas.toJSON()),
      timestamp: Date.now()
    };
    setHistory(prev => {
      const newHistory = [...prev, currentState].slice(-20); 
      return newHistory;
    });

    // Close sticker button
    setStickerButtonPosition(null);
  }, []);

  // 处理图片上传
  const handleImageProcessed = useCallback(async (processedImage: ProcessedImage) => {
    if (!fabricCanvasRef.current || !clickPosition) {
        console.error('[Whiteboard] Canvas or click position not available for image upload');
        return;
    }

    const canvas = fabricCanvasRef.current;
    
    // 保存当前画布状态
    const currentDrawingMode = canvas.isDrawingMode;
    const currentBrush = canvas.freeDrawingBrush;
    
    const img = new Image();
    
    img.onload = () => {
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
        // 先添加图片到画布，确保图片能显示
        canvas.add(fabricImage);
        
        // 设置canvas引用
        fabricImage.canvas = canvas;
        
        // 应用照片效果，PhotoEffect内部已经包含动画
        PhotoEffect.applyPhotoEffect(fabricImage, {
          animation: {
            initial: { scale: 0.7, opacity: 0, rotation: -15 },
            final: { scale: 1, opacity: 1, rotation: PhotoEffect.getRandomRotation() },
            duration: 1400,
            easing: 'easeOutBack'
          }
        });

        // 立即渲染，不等待动画
        canvas.renderAll();

        // 等待动画完成后设置交互性
        setTimeout(() => {
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
            const brush = new fabric.PencilBrush(canvas);
            brush.width = canvas.freeDrawingBrush?.width || brushSize;
            brush.color = canvas.freeDrawingBrush?.color || brushColor;
            (brush as any).decimate = 8;
            (brush as any).controlPointsNum = 2;
            canvas.freeDrawingBrush = brush;
          } else {
            canvas.freeDrawingBrush = currentBrush;
          }
          canvas.renderAll();
          
          // 记录历史状态 - 内联避免依赖
          const currentCanvas = fabricCanvasRef.current;
          if (currentCanvas) {
            const currentState: DrawingState = {
              canvasState: JSON.stringify(currentCanvas.toJSON()),
              timestamp: Date.now()
            };
            setHistory(prev => {
              const newHistory = [...prev, currentState].slice(-20); 
              return newHistory;
            });
          }
        }, 100); // 缩短等待时间，让用户更快看到效果

      } catch (error: any) {
        console.error('[Whiteboard] 照片效果应用失败:', error);
        // fallback: 简单添加图片
        canvas.add(fabricImage);
        fabricImage.set({ selectable: true, hasControls: true, evented: true });
        
        // 恢复画笔状态
        canvas.isDrawingMode = currentDrawingMode;
        if (!currentBrush) {
          const brush = new fabric.PencilBrush(canvas);
          brush.width = brushSize;
          brush.color = brushColor;
          (brush as any).decimate = 8;
          (brush as any).controlPointsNum = 2;
          canvas.freeDrawingBrush = brush;
        } else {
          canvas.freeDrawingBrush = currentBrush;
        }
        canvas.renderAll();
        
        // 记录历史状态 - 内联避免依赖
        const currentCanvas = fabricCanvasRef.current;
        if (currentCanvas) {
          const currentState: DrawingState = {
            canvasState: JSON.stringify(currentCanvas.toJSON()),
            timestamp: Date.now()
          };
          setHistory(prev => {
            const newHistory = [...prev, currentState].slice(-20); 
            return newHistory;
          });
        }
      }

      setMenuPosition(null);
      setClickPosition(null);
    };

    img.onerror = (errorEvent) => {
      console.error('[Whiteboard] 图片加载失败:', errorEvent);
      // 恢复画布状态
      canvas.isDrawingMode = currentDrawingMode;
      if (!currentBrush) {
        const brush = new fabric.PencilBrush(canvas);
        brush.width = brushSize;
        brush.color = brushColor;
        (brush as any).decimate = 8;
        (brush as any).controlPointsNum = 2;
        canvas.freeDrawingBrush = brush;
      } else {
        canvas.freeDrawingBrush = currentBrush;
      }
      alert('图片加载失败，请重试');
    };

    img.src = processedImage.dataUrl;
  }, [clickPosition, brushSize, brushColor]);

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
            onUndo={() => {
              const currentCanvas = fabricCanvasRef.current;
              if (!currentCanvas) {
                console.warn('[Whiteboard] Cannot undo: canvas not available');
                return;
              }

              setHistory(prevHistory => {
                if (prevHistory.length <= 1) { 
                  return prevHistory; 
                }

                try {
                  const prevState = prevHistory[prevHistory.length - 2]; 
                  currentCanvas.loadFromJSON(JSON.parse(prevState.canvasState), () => {
                    currentCanvas.isDrawingMode = initialIsDrawingMode; 
                    // 恢复画笔设置 - 使用当前状态值，确保撤销后画笔正确
                    const currentBrushSize = fabricCanvasRef.current?.freeDrawingBrush?.width || 5;
                    const currentBrushColor = fabricCanvasRef.current?.freeDrawingBrush?.color || '#000000';
                    const brush = new fabric.PencilBrush(currentCanvas);
                    brush.width = currentBrushSize;
                    brush.color = currentBrushColor;
                    (brush as any).decimate = 8;
                    (brush as any).controlPointsNum = 2;
                    currentCanvas.freeDrawingBrush = brush;
                    currentCanvas.renderAll();
                  });
                  return prevHistory.slice(0, -1); 
                } catch (error) {
                  console.error('[Whiteboard] Undo failed:', error);
                  return prevHistory; 
                }
              });
            }}
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

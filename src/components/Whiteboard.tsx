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
  }, [fabricCanvasRef, setHistory]); // Dependencies: ref and history setter (both stable or semi-stable)

  // Callback to handle the undo action
  const handleUndo = useCallback(() => {
    const currentCanvas = fabricCanvasRef.current;
    if (!currentCanvas) {
      console.warn('[Whiteboard handleUndo] Canvas ref is null, cannot undo.');
      return;
    }

    setHistory(prevHistory => {
      console.log('[Whiteboard handleUndo] Attempting undo. History length:', prevHistory.length);
      if (prevHistory.length <= 1) { // Need at least one state to revert to
        console.log('[Whiteboard handleUndo] No more states to undo or only initial state left.');
        return prevHistory; // Return current history if no undo is possible
      }

      try {
        const prevState = prevHistory[prevHistory.length - 2]; // Get the state before the last one
        console.log('[Whiteboard handleUndo] Reverting to state from timestamp:', prevState.timestamp);
        currentCanvas.loadFromJSON(JSON.parse(prevState.canvasState), () => {
          currentCanvas.renderAll();
          // Ensure canvas properties like brush and drawing mode are reapplied after loadFromJSON
          // This is important as loadFromJSON might reset some canvas settings.
          currentCanvas.isDrawingMode = initialIsDrawingMode; 
          currentCanvas.freeDrawingBrush = configureBrush(currentCanvas, brushSize, brushColor);
          console.log('[Whiteboard handleUndo] Canvas loaded from previous state.');
        });
        return prevHistory.slice(0, -1); // Return new history array with the last state removed
      } catch (error) {
        console.error('[Whiteboard handleUndo] Failed to undo:', error);
        return prevHistory; // Return current history in case of an error
      }
    });
  }, [setHistory, fabricCanvasRef, brushSize, brushColor, initialIsDrawingMode]); // Removed 'history' from deps

  // --- Effects --- 

  // Effect for initializing and managing the Fabric canvas instance and its direct properties/event listeners
  // This effect handles canvas creation, updates to drawing mode, brush, and attaches core event listeners.
  useEffect(() => {
    console.log('[Whiteboard CanvasLifecycle useEffect] Running. Deps:', { width, height, initialIsDrawingMode, brushSize, brushColor });

    if (!canvasElRef.current) {
      console.warn('[Whiteboard CanvasLifecycle useEffect] canvasElRef is null. Bailing out.');
      return;
    }

    let canvasInstance = fabricCanvasRef.current;

    // If canvas doesn't exist, or width/height changed, create a new one
    // This ensures the canvas is responsive to dimension props.
    if (!canvasInstance || canvasInstance.getWidth() !== width || canvasInstance.getHeight() !== height) {
      if (canvasInstance) {
        console.log('[Whiteboard CanvasLifecycle useEffect] Disposing existing canvas due to dimension change or recreation.');
        canvasInstance.dispose(); // Dispose old instance before creating new
      }
      console.log('[Whiteboard CanvasLifecycle useEffect] Creating new Fabric canvas.');
      canvasInstance = new fabric.Canvas(canvasElRef.current, {
        width,
        height,
        backgroundColor: '#ffffff', // Default background
        isDrawingMode: initialIsDrawingMode, // Set initial drawing mode
      }) as FabricCanvas;
      fabricCanvasRef.current = canvasInstance; // Store new instance in ref
      console.log('[Whiteboard CanvasLifecycle useEffect] New canvas created and assigned to ref.');
    } else {
      console.log('[Whiteboard CanvasLifecycle useEffect] Using existing canvas instance.');
    }

    // Apply/update canvas properties whenever dependencies change
    console.log('[Whiteboard CanvasLifecycle useEffect] Applying properties. DrawingMode:', initialIsDrawingMode, 'BrushSize:', brushSize);
    canvasInstance.isDrawingMode = initialIsDrawingMode;
    canvasInstance.freeDrawingBrush = configureBrush(canvasInstance, brushSize, brushColor);
    canvasInstance.renderOnAddRemove = true; // Important for Fabric.js behavior
    canvasInstance.preserveObjectStacking = true; // Maintains object layering

    // Define event handlers (local to this effect, will be re-attached if effect re-runs)
    // These handlers use the 'canvasInstance' from this effect's closure.
    const handleMouseDownLocal = (e: fabric.TEvent) => { // Changed IEvent to TEvent
      console.log('[Whiteboard mouse:down] Event:', e);
      if (fabricCanvasRef.current?.isDrawingMode) {
        setStickerButtonPosition(null); // Hide sticker button when drawing starts
      }
    };

    const handlePathCreatedLocal = (e: fabric.TEvent & { path: fabric.Path }) => { // Changed IEvent to TEvent
      console.log('[Whiteboard path:created] Path created:', e.path);
      requestAnimationFrame(recordState); // recordState is a stable useCallback
    };

    const handleMouseUpLocal = (e: fabric.TEvent) => { // Changed IEvent to TEvent
      console.log('[Whiteboard mouse:up] Event:', e);
      // Future logic for mouse up if needed
    };

    // Keyboard listener for shortcuts like Ctrl+Z for undo
    const handleKeyboardLocal = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); // Prevent browser's default undo action
        handleUndo(); // handleUndo is now a stable useCallback
      }
    };

    // Attach event listeners to the current canvas instance and window
    console.log('[Whiteboard CanvasLifecycle useEffect] Attaching event listeners.');
    canvasInstance.on('mouse:down', handleMouseDownLocal);
    canvasInstance.on('path:created', handlePathCreatedLocal);
    canvasInstance.on('mouse:up', handleMouseUpLocal);
    window.addEventListener('keydown', handleKeyboardLocal);

    // Cleanup function for this effect: remove listeners
    return () => {
      console.log('[Whiteboard CanvasLifecycle useEffect Cleanup] Cleaning up listeners.');
      window.removeEventListener('keydown', handleKeyboardLocal);
      // Check if canvasInstance is still valid and same as ref before detaching listeners.
      // This ensures we're cleaning up listeners from the correct instance.
      if (canvasInstance && fabricCanvasRef.current === canvasInstance) {
        console.log('[Whiteboard CanvasLifecycle useEffect Cleanup] Detaching listeners from canvas:', canvasInstance);
        canvasInstance.off('mouse:down', handleMouseDownLocal);
        canvasInstance.off('path:created', handlePathCreatedLocal);
        canvasInstance.off('mouse:up', handleMouseUpLocal);
      }
      // Note: Canvas disposal itself is handled if width/height change (at the start of this effect)
      // or on component unmount (in a separate effect).
    };
  }, [width, height, initialIsDrawingMode, brushSize, brushColor, handleUndo, recordState]); // Dependencies that manage canvas and its core behavior

  // Effect for setting the initial history, runs once after canvas is ready and history is empty
  useEffect(() => {
    // Only run if canvas is available and history hasn't been initialized yet.
    if (fabricCanvasRef.current && history.length === 0) {
      console.log('[Whiteboard InitialHistory useEffect] Setting initial history state.');
      const initialState: DrawingState = {
        canvasState: JSON.stringify(fabricCanvasRef.current.toJSON()), // Get initial state from canvas
        timestamp: Date.now()
      };
      setHistory([initialState]); // Initialize history with the current canvas state
      console.log('[Whiteboard InitialHistory useEffect] Initial history state set.');
    }
  }, [fabricCanvasRef, history.length]); // Runs when canvas ref object changes or history length changes

  // Effect for component unmount: ensure canvas is disposed to prevent memory leaks
  useEffect(() => {
    return () => {
      if (fabricCanvasRef.current) {
        console.log('[Whiteboard Unmount Cleanup] Disposing canvas on component unmount.');
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []); // Empty dependency array means this runs only on mount and unmount

  // Handler for context menu (right-click)
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    console.log('[Whiteboard handleContextMenu] Context menu event triggered at:', event.clientX, event.clientY);
    event.preventDefault();
    
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    
    // 获取画布上的点击位置
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 检查点击位置是否有图片
    const pointer = canvas.getPointer(event.nativeEvent);
    const objects = canvas.getObjects();
    const clickedImage = objects.find(obj => 
      obj instanceof fabric.Image && 
      obj.containsPoint(pointer)
    ) as fabric.Image | undefined;

    if (clickedImage) {
      // 如果点击了图片，显示贴纸按钮
      const bounds = clickedImage.getBoundingRect();
      
      // 移除之前的选中框
      const existingSelection = objects.find(obj => 
        obj instanceof fabric.Rect && 
        (obj as any).data?.type === 'selection-rect'
      );
      if (existingSelection) {
        canvas.remove(existingSelection);
      }
      
      // 创建新的选中框
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
      // 如果点击了空白处，显示上传菜单
      // 移除选中框
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
    // 贴纸转换逻辑已在FloatingButton组件中实现
    // 这里不需要做任何操作，因为FloatingButton组件会处理转换过程
    // 并在完成后自动关闭
  }, [stickerButtonPosition]);

  // 处理图片上传
  const handleImageProcessed = useCallback(async (processedImage: ProcessedImage) => {
    console.log('[Whiteboard handleImageProcessed] Image processed. Dimensions:', processedImage.width, 'x', processedImage.height);
    if (!fabricCanvasRef.current || !clickPosition) {
        console.error('[Whiteboard handleImageProcessed] Canvas or clickPosition not available.');
        return;
    }

    const canvas = fabricCanvasRef.current;
    
    const img = new Image();
    
    img.onload = () => {
      const fabricImage = new fabric.Image(img, {
        left: clickPosition.x - processedImage.width / 2,
        top: clickPosition.y - processedImage.height / 2,
        selectable: false,
        hasControls: false,
        evented: true
      });

      // 先添加到画布
      canvas.add(fabricImage);

      // 应用照片效果
      try {
        PhotoEffect.applyPhotoEffect(fabricImage, {
          animation: {
            initial: {
              scale: 0.7,
              opacity: 0,
              rotation: -20
            },
            final: {
              scale: 1,
              opacity: 1,
              rotation: Math.random() * 6 - 3
            },
            duration: 1200,
            easing: 'easeOutBack'
          }
        });

        // 设置图片可选中和可控制
        fabricImage.set({
          selectable: true,
          hasControls: true,
          evented: true
        });

        // 监听选中事件
        fabricImage.on('selected', () => {
          const bounds = fabricImage.getBoundingRect();
          setStickerButtonPosition({
            x: bounds.left + bounds.width / 2,
            y: bounds.top - 20,
            target: fabricImage
          });
        });

        // 监听取消选中事件
        fabricImage.on('deselected', () => {
          setStickerButtonPosition(null);
        });

      } catch (error: any) {
        console.error('[Whiteboard handleImageProcessed] Error applying photo effect or adding image to canvas:', error);
      } finally {
        canvas.renderAll();
      }

      // 记录状态用于撤销
      requestAnimationFrame(() => {
        const currentState: DrawingState = {
          canvasState: JSON.stringify(canvas.toJSON()),
          timestamp: Date.now()
        };

        setHistory(prev => {
          const newHistory = [...prev, currentState];
          if (newHistory.length > 20) {
            newHistory.shift();
          }
          return newHistory;
        });
      });

      // 关闭菜单
      setMenuPosition(null);
      setClickPosition(null);
    };

    img.src = processedImage.dataUrl;
  }, [clickPosition]);

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
              onUploadClick={() => {}}
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
  );
};

export default Whiteboard;

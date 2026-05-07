'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

type Tool = 'select' | 'pen' | 'rect' | 'circle' | 'text' | 'eraser' | 'line';

interface DrawingElement {
  id: string;
  type: Tool;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  text?: string;
}

interface WhiteboardProps {
  readOnly?: boolean;
  elements?: DrawingElement[];
  onChange?: (elements: DrawingElement[]) => void;
  className?: string;
}

export default function Whiteboard({
  readOnly = false,
  elements: externalElements,
  onChange,
  className = '',
}: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalElements, setInternalElements] = useState<DrawingElement[]>([]);
  const isLocalDrawingRef = useRef(false);
  const externalHashRef = useRef('');

  // Sync from server only when NOT currently drawing locally
  useEffect(() => {
    if (externalElements && !isLocalDrawingRef.current) {
      const hash = JSON.stringify(externalElements);
      if (hash === externalHashRef.current) return;
      externalHashRef.current = hash;
      setInternalElements(prev => {
        if (JSON.stringify(prev) === hash) return prev;
        return externalElements;
      });
    }
  }, [externalElements]);

  const elements = internalElements;

  const setElements = (els: DrawingElement[] | ((prev: DrawingElement[]) => DrawingElement[])) => {
    setInternalElements((prev) => {
      const updated = typeof els === 'function' ? els(prev) : els;
      onChange?.(updated);
      return updated;
    });
  };
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#e2e8f0');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw all elements
    const allElements = [...elements];
    if (currentPoints.length > 0) {
      allElements.push({
        id: 'temp',
        type: currentTool,
        points: currentPoints,
        color: currentColor,
        strokeWidth,
      });
    }

    for (const el of allElements) {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'pen' && el.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === 'rect' && el.points.length >= 2) {
        const [start, end] = [el.points[0], el.points[el.points.length - 1]];
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else if (el.type === 'circle' && el.points.length >= 2) {
        const [start, end] = [el.points[0], el.points[el.points.length - 1]];
        const rx = Math.abs(end.x - start.x) / 2;
        const ry = Math.abs(end.y - start.y) / 2;
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === 'line' && el.points.length >= 2) {
        const [start, end] = [el.points[0], el.points[el.points.length - 1]];
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      } else if (el.type === 'text' && el.text) {
        ctx.font = `${14 + el.strokeWidth * 2}px sans-serif`;
        ctx.fillText(el.text, el.points[0].x, el.points[0].y);
      }
    }
  }, [elements, currentPoints, currentTool, currentColor, strokeWidth]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [redrawCanvas]);

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    isLocalDrawingRef.current = true;
    const pos = getCanvasPos(e);

    if (currentTool === 'text') {
      setTextInput({ x: pos.x, y: pos.y, value: '' });
      isLocalDrawingRef.current = false;
      return;
    }

    setIsDrawing(true);
    setCurrentPoints([pos]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return;
    const pos = getCanvasPos(e);
    setCurrentPoints((prev) => [...prev, pos]);
  };

  const handleEnd = () => {
    if (!isDrawing || readOnly) return;
    setIsDrawing(false);
    isLocalDrawingRef.current = false;

    if (currentPoints.length === 0) return;

    const newElement: DrawingElement = {
      id: Date.now().toString(),
      type: currentTool,
      points: currentPoints,
      color: currentColor,
      strokeWidth,
    };

    const updated = [...elements, newElement];
    setElements(updated);
    setCurrentPoints([]);
  };

  const handleTextSubmit = () => {
    if (!textInput || !textInput.value.trim()) {
      setTextInput(null);
      return;
    }

    const newElement: DrawingElement = {
      id: Date.now().toString(),
      type: 'text',
      points: [{ x: textInput.x, y: textInput.y }],
      color: currentColor,
      strokeWidth: 0,
      text: textInput.value,
    };

    const updated = [...elements, newElement];
    setElements(updated);
    setTextInput(null);
  };

  const clearAll = () => {
    setElements([]);
  };

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'pen', icon: <span className="text-sm">✏️</span>, label: 'Pen' },
    { id: 'line', icon: <span className="text-sm">╱</span>, label: 'Line' },
    { id: 'rect', icon: <span className="text-sm">□</span>, label: 'Rectangle' },
    { id: 'circle', icon: <span className="text-sm">○</span>, label: 'Circle' },
    { id: 'text', icon: <span className="text-sm font-bold">T</span>, label: 'Text' },
    { id: 'eraser', icon: <span className="text-sm">◻️</span>, label: 'Eraser' },
  ];

  const colors = ['#e2e8f0', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-surface border-b border-border px-3 py-2 gap-2">
        <div className="flex items-center gap-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setCurrentTool(tool.id)}
              disabled={readOnly}
              title={tool.label}
              className={`p-2 rounded transition-colors ${
                currentTool === tool.id
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-muted hover:text-white hover:bg-white/5'
              } disabled:opacity-30`}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Colors */}
          <div className="flex items-center gap-1">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setCurrentColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                  currentColor === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Stroke width */}
          <input
            type="range"
            min={1}
            max={8}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-16 accent-primary"
          />

          {/* Clear */}
          <button
            onClick={clearAll}
            disabled={readOnly}
            className="p-2 text-red-400 hover:text-red-300 rounded transition-colors disabled:opacity-30"
            title="Clear all"
          >
            <span className="text-sm">🗑️</span>
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative bg-[#13131f]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: readOnly ? 'default' : currentTool === 'text' ? 'text' : currentTool === 'eraser' ? 'crosshair' : 'crosshair' }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />

        {/* Text input overlay */}
        {textInput && (
          <input
            autoFocus
            value={textInput.value}
            onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
            onBlur={handleTextSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTextSubmit();
              if (e.key === 'Escape') setTextInput(null);
            }}
            className="absolute bg-transparent text-white border border-primary outline-none font-mono text-sm px-1 py-0.5"
            style={{ left: textInput.x, top: textInput.y - 10 }}
            placeholder="Type here..."
          />
        )}

        {/* Current tool indicator */}
        <div className="absolute bottom-3 left-3 bg-surface/80 backdrop-blur px-2 py-1 rounded text-xs text-text-muted">
          {tools.find((t) => t.id === currentTool)?.label}
        </div>
      </div>
    </div>
  );
}

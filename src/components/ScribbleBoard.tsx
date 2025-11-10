import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Pen, RotateCcw, Grid, X } from "lucide-react";

/**
 * Lightweight scribble board with a simple pen/eraser.
 * - Only used on large screens (QuizGame hides it below lg).
 * - Fixed height so it doesn't shift surrounding layout.
 */
const CSS_CANVAS_H = 260; // css pixels; container uses this height

type Props = { onClose?: () => void };

export const ScribbleBoard: React.FC<Props> = ({ onClose }) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [mode, setMode] = useState<"pen" | "eraser">("pen");
  const [penSize, setPenSize] = useState(3);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Setup high-DPI scaling and context params
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapperRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const cssWidth = wrap.clientWidth; // responsive width of container
    const cssHeight = CSS_CANVAS_H;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // map to CSS pixels
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    lastPos.current = getPos(e);
    // draw a single dot right under cursor for immediate feedback
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.globalCompositeOperation = mode === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = mode === "eraser" ? "rgba(0,0,0,1)" : "#1f2937";
    ctx.fillStyle = mode === "eraser" ? "rgba(0,0,0,1)" : "#1f2937";
    ctx.beginPath();
    ctx.arc(lastPos.current.x, lastPos.current.y, penSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleUp = () => {
    setDrawing(false);
    lastPos.current = null;
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !lastPos.current) return;
    const curr = getPos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.globalCompositeOperation = mode === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = mode === "eraser" ? "rgba(0,0,0,1)" : "#1f2937";
    ctx.lineWidth = penSize;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
    lastPos.current = curr;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="w-full bg-white/80 backdrop-blur rounded-2xl border-2 border-primary/20 p-3 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Scribble Board</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant={mode === "pen" ? "default" : "outline"} className="h-7 w-7" onClick={() => setMode("pen")}>
            <Pen className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant={mode === "eraser" ? "default" : "outline"} className="h-7 w-7" onClick={() => setMode("eraser")}>
            <Eraser className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={clear}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          {onClose && (
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={onClose}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div ref={wrapperRef} className="mb-2">
        <canvas
          ref={canvasRef}
          className="w-full h-[260px] rounded-lg border bg-white cursor-crosshair"
          onMouseDown={handleDown}
          onMouseUp={handleUp}
          onMouseLeave={handleUp}
          onMouseMove={handleMove}
        />
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">Size</span>
          <input
            type="range"
            min={2}
            max={10}
            value={penSize}
            onChange={(e) => setPenSize(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

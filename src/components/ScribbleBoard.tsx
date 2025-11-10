import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pen, RotateCcw, Grid, X, Sparkles, Loader2, Copy, Type, Palette } from "lucide-react";
import type { Question } from "@/data/questions";
import { aiSolveShortIndian } from "@/services/openrouter";

/**
 * Lightweight scribble board with a simple pen/eraser.
 * - Only used on large screens (QuizGame hides it below lg).
 * - Fixed height so it doesn't shift surrounding layout.
 */
const CSS_CANVAS_H = 260; // css pixels; container uses this height

type Props = { onClose?: () => void; question?: Question; fullHeight?: boolean; onOpenTables?: () => void };

export const ScribbleBoard: React.FC<Props> = ({ onClose, question, fullHeight = false, onOpenTables }) => {
  const drawWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [mode, setMode] = useState<"pen" | "eraser">("pen");
  const [penSize, setPenSize] = useState(4);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [solution, setSolution] = useState<string | null>(null);
  const [loadingSolve, setLoadingSolve] = useState(false);
  const [showSolutionOverlay, setShowSolutionOverlay] = useState(false);
  const [penColor, setPenColor] = useState<string>("#1f2937");
  const resizeStateRef = useRef<{ active: boolean; startY: number; startH: number }>({ active: false, startY: 0, startH: 0 });

  // Resize canvas to match wrapper size (preserving existing drawing)
  const resizeToContainer = (preserve: boolean) => {
    const canvas = canvasRef.current;
    const wrap = drawWrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const cssWidth = Math.max(50, wrap.clientWidth);
    const cssHeight = Math.max(120, wrap.clientHeight);

    let snapshot: HTMLCanvasElement | null = null;
    if (preserve && canvas.width > 0 && canvas.height > 0) {
      snapshot = document.createElement('canvas');
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      const sctx = snapshot.getContext('2d');
      if (sctx) sctx.drawImage(canvas, 0, 0);
    }

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // map to CSS pixels
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (snapshot) {
      // Draw previous content scaled to new size
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, cssWidth, cssHeight);
      snapshot = null;
    }
  };

  // Setup ResizeObserver to track wrapper resizing
  useEffect(() => {
    const wrap = drawWrapRef.current;
    if (!wrap) return;
    // Initial setup without preserving (blank canvas)
    resizeToContainer(false);
    const ro = new ResizeObserver(() => resizeToContainer(true));
    ro.observe(wrap);
    const onWindowResize = () => resizeToContainer(true);
    window.addEventListener('resize', onWindowResize);
    // Global listeners for custom drag handle
    const onMove = (e: MouseEvent) => {
      if (!resizeStateRef.current.active) return;
      const wrap = drawWrapRef.current;
      if (!wrap) return;
      const dy = e.clientY - resizeStateRef.current.startY;
      const next = Math.max(160, resizeStateRef.current.startH + dy);
      wrap.style.height = `${next}px`;
      // ResizeObserver will sync the canvas
    };
    const onUp = () => { resizeStateRef.current.active = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Clear previous solution when question changes
  useEffect(() => {
    setSolution(null);
    setLoadingSolve(false);
  }, [question?.id]);

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
    ctx.strokeStyle = mode === "eraser" ? "rgba(0,0,0,1)" : penColor;
    ctx.fillStyle = mode === "eraser" ? "rgba(0,0,0,1)" : penColor;
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
    ctx.strokeStyle = mode === "eraser" ? "rgba(0,0,0,1)" : penColor;
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

  const handleSolve = async () => {
    if (!question) return;
    setShowSolutionOverlay(true);
    setLoadingSolve(true);
    try {
      const text = await aiSolveShortIndian(question);
      setSolution(text);
    } catch {
      setSolution("Sorry, couldn't fetch the solution. Try again.");
    } finally {
      setLoadingSolve(false);
    }
  };

  const copySolution = async () => {
    if (!solution) return;
    try { await navigator.clipboard.writeText(solution); } catch {}
  };

  const writeSolutionToCanvas = () => {
    if (!solution) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Draw text in a readable monospace font
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#1f2937"; // gray-800
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    const padding = 8;
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const maxWidth = canvas.width / dpr - padding * 2;
    let y = padding + 12;
    const lineHeight = 16;
    const lines = solution.split(/\r?\n/);
    for (const raw of lines) {
      const words = raw.split(/\s+/);
      let line = "";
      for (const word of words) {
        const test = line ? line + " " + word : word;
        const w = ctx.measureText(test).width;
        if (w > maxWidth && line) {
          ctx.fillText(line, padding, y);
          y += lineHeight;
          if (y > canvas.height / dpr - padding) { ctx.restore(); return; }
          line = word;
        } else {
          line = test;
        }
      }
      if (line) {
        ctx.fillText(line, padding, y);
        y += lineHeight;
        if (y > canvas.height / dpr - padding) { ctx.restore(); return; }
      }
    }
    ctx.restore();
  };

  return (
    <div className={`w-full bg-white/80 backdrop-blur rounded-2xl border-2 border-primary/20 p-4 shadow-lg ${fullHeight ? 'h-full flex flex-col' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Grid className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">Scribble Board</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant={mode === "pen" ? "default" : "outline"} className="h-8 w-8" onClick={() => setMode("pen")}>
            <Pen className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={clear}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          {question && (
            <Button size="sm" variant="outline" className="h-8 px-3 ml-1" onClick={handleSolve} disabled={loadingSolve}>
              {loadingSolve ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}        
              <span className="ml-1 text-[12px] font-semibold">Solve</span>
            </Button>
          )}
          {onOpenTables && (
            <Button size="sm" variant="outline" className="h-8 px-3" onClick={onOpenTables}>
              Tables 2–12
            </Button>
          )}
          {onClose && (
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      <div
        ref={drawWrapRef}
        className={`relative mb-3 overflow-auto rounded-lg border bg-white select-none ${fullHeight ? 'flex-1 min-h-[216px]' : 'min-h-[216px] h-[312px]'}`}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={handleDown}
          onMouseUp={handleUp}
          onMouseLeave={handleUp}
          onMouseMove={handleMove}
        />
        {/* Custom vertical resize handle (hidden in fullHeight mode) */}
        {!fullHeight && (
          <div
            role="separator"
            aria-label="resize board vertically"
            className="absolute bottom-0 left-0 right-0 h-5 cursor-ns-resize bg-gradient-to-t from-gray-200/80 to-transparent z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              const wrap = drawWrapRef.current;
              if (!wrap) return;
              resizeStateRef.current = { active: true, startY: e.clientY, startH: wrap.clientHeight };
            }}
          />
        )}

        {/* Solution overlay above scribble (like Tables) */}
        {showSolutionOverlay && (
          <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur rounded-lg border-2 border-primary/20 shadow-xl p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold">AI Solution</div>
              <div className="flex items-center gap-2">
                {solution && (
                  <>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={copySolution} title="Copy">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={writeSolutionToCanvas} title="Write on board">
                      <Type className="w-4 h-4" />
                    </Button>
                  </>
                )}
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setShowSolutionOverlay(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 rounded-md border bg-white/70 p-2 text-xs leading-snug overflow-auto">
              {loadingSolve ? (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Fetching solution...
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-xs">{solution}</pre>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Colors */}
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Palette className="w-3.5 h-3.5" /> Colors</span>
        {['#1f2937','#2563eb','#dc2626','#16a34a','#f59e0b','#7c3aed','#0ea5e9','#fb7185'].map(c => (
          <button
            key={c}
            aria-label={`color ${c}`}
            onClick={() => { setMode('pen'); setPenColor(c); }}
            className={`w-6 h-6 rounded-full border-2 ${penColor===c ? 'ring-2 ring-offset-1 ring-primary' : 'ring-0'} `}
            style={{ backgroundColor: c, borderColor: '#ffffff' }}
          />
        ))}
      </div>
      {/* Inline solution block removed; shown in overlay now */}
    </div>
  );
};

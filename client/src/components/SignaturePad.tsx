import { useRef, useEffect, useCallback } from "react";

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
}

export default function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
  }, []);

  const getPos = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      isDrawing.current = true;
      const ctx = canvasRef.current!.getContext("2d")!;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvasRef.current!.setPointerCapture(e.pointerId);
    },
    [getPos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return;
      const ctx = canvasRef.current!.getContext("2d")!;
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [getPos],
  );

  const handlePointerEnd = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    onChange(canvasRef.current!.toDataURL());
  }, [onChange]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  }, [onChange]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        className="w-full h-40 border border-border rounded-md bg-white"
        style={{ touchAction: "none" }}
      />
      <button
        type="button"
        onClick={handleClear}
        className="mt-2 h-control rounded-md border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"
      >
        Clear Signature
      </button>
    </div>
  );
}

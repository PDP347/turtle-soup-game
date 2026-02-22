"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import type { DrawingEvent, DrawingStroke } from "@/games/draw-and-guess/models/game";

interface DrawingCanvasProps {
    isPainter: boolean;
    strokes: DrawingStroke[];        // initial strokes (for late joiners)
    onDrawEvent: (event: DrawingEvent) => void;
    externalEvent: DrawingEvent | null; // events from other players
}

const COLORS = [
    "#1a1a1a", "#ffffff", "#e74c3c", "#e67e22", "#f1c40f",
    "#2ecc71", "#1abc9c", "#3498db", "#9b59b6", "#e91e8c",
    "#795548", "#607d8b",
];
const WIDTHS = [3, 6, 12, 20, 36];

export default function DrawingCanvas({ isPainter, strokes, onDrawEvent, externalEvent }: DrawingCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawing = useRef(false);
    const currentStrokeId = useRef<string>("");
    const currentPoints = useRef<{ x: number; y: number }[]>([]);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

    const [color, setColor] = useState("#1a1a1a");
    const [width, setWidth] = useState(6);
    const [isEraser, setIsEraser] = useState(false);

    // Store all strokes in memory for redraw
    const strokesRef = useRef<DrawingStroke[]>([]);
    const activeStrokes = useRef<Map<string, DrawingStroke>>(new Map());

    const getCtx = useCallback(() => {
        if (!canvasRef.current) return null;
        if (!ctxRef.current) {
            ctxRef.current = canvasRef.current.getContext("2d");
        }
        return ctxRef.current;
    }, []);

    // Redraw all strokes from scratch
    const redrawAll = useCallback(() => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const stroke of strokesRef.current) {
            if (stroke.points.length < 2) continue;
            ctx.beginPath();
            ctx.strokeStyle = stroke.type === "erase" ? "#ffffff" : stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.globalCompositeOperation = stroke.type === "erase" ? "destination-out" : "source-over";
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
    }, [getCtx]);

    // Draw a single segment (for live drawing)
    const drawSegment = useCallback((from: { x: number; y: number }, to: { x: number; y: number }, strokeColor: string, strokeWidth: number, type: "draw" | "erase") => {
        const ctx = getCtx();
        if (!ctx) return;
        ctx.beginPath();
        ctx.strokeStyle = type === "erase" ? "#ffffff" : strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalCompositeOperation = type === "erase" ? "destination-out" : "source-over";
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
    }, [getCtx]);

    // Initialize canvas with white background
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctxRef.current = ctx;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    // Load initial strokes for late joiners
    useEffect(() => {
        if (strokes.length === 0) return;
        strokesRef.current = [...strokes];
        redrawAll();
    }, [strokes, redrawAll]);

    // Handle external draw events from other players
    useEffect(() => {
        if (!externalEvent) return;
        const ev = externalEvent;

        if (ev.type === "clear") {
            strokesRef.current = [];
            activeStrokes.current.clear();
            redrawAll();
            return;
        }
        if (ev.type === "stroke_start" && ev.strokeId && ev.stroke) {
            const newStroke: DrawingStroke = {
                id: ev.strokeId,
                points: ev.point ? [ev.point] : [],
                color: ev.stroke.color || "#1a1a1a",
                width: ev.stroke.width || 6,
                type: ev.stroke.type || "draw",
            };
            activeStrokes.current.set(ev.strokeId, newStroke);
        }
        if (ev.type === "stroke_move" && ev.strokeId && ev.point) {
            const stroke = activeStrokes.current.get(ev.strokeId);
            if (stroke) {
                const prev = stroke.points[stroke.points.length - 1];
                if (prev) drawSegment(prev, ev.point, stroke.color, stroke.width, stroke.type);
                stroke.points.push(ev.point);
            }
        }
        if (ev.type === "stroke_end" && ev.strokeId) {
            const stroke = activeStrokes.current.get(ev.strokeId);
            if (stroke) {
                strokesRef.current.push(stroke);
                activeStrokes.current.delete(ev.strokeId);
            }
        }
    }, [externalEvent, redrawAll, drawSegment]);

    // Get canvas-relative coordinates
    const getPos = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ("touches" in e) {
            const touch = e.touches[0] || e.changedTouches[0];
            return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
        }
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    }, []);

    const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isPainter) return;
        e.preventDefault();
        const pos = getPos(e);
        if (!pos) return;
        isDrawing.current = true;
        lastPos.current = pos;
        currentPoints.current = [pos];
        currentStrokeId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const type = isEraser ? "erase" : "draw";
        onDrawEvent({
            type: "stroke_start",
            strokeId: currentStrokeId.current,
            point: pos,
            stroke: { color, width, type },
        });
    }, [isPainter, getPos, color, width, isEraser, onDrawEvent]);

    const moveDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isPainter || !isDrawing.current) return;
        e.preventDefault();
        const pos = getPos(e);
        if (!pos || !lastPos.current) return;
        const type = isEraser ? "erase" : "draw";
        drawSegment(lastPos.current, pos, color, width, type);
        currentPoints.current.push(pos);
        lastPos.current = pos;
        onDrawEvent({ type: "stroke_move", strokeId: currentStrokeId.current, point: pos });
    }, [isPainter, getPos, color, width, isEraser, drawSegment, onDrawEvent]);

    const endDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isPainter || !isDrawing.current) return;
        e.preventDefault();
        isDrawing.current = false;
        const type = isEraser ? "erase" : "draw";
        const finishedStroke: DrawingStroke = {
            id: currentStrokeId.current,
            points: currentPoints.current,
            color, width, type,
        };
        strokesRef.current.push(finishedStroke);
        onDrawEvent({ type: "stroke_end", strokeId: currentStrokeId.current });
        lastPos.current = null;
    }, [isPainter, color, width, isEraser, onDrawEvent]);

    const handleClear = useCallback(() => {
        if (!isPainter) return;
        strokesRef.current = [];
        activeStrokes.current.clear();
        redrawAll();
        onDrawEvent({ type: "clear" });
    }, [isPainter, redrawAll, onDrawEvent]);

    const effectiveColor = isEraser ? "#ffffff" : color;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
            {/* Toolbar (only for painter) */}
            {isPainter && (
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "10px 16px" }}>
                    {/* Colors */}
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => { setColor(c); setIsEraser(false); }}
                                style={{
                                    width: "24px", height: "24px", borderRadius: "50%", background: c,
                                    border: !isEraser && color === c ? "3px solid var(--accent-primary)" : "2px solid var(--border-subtle)",
                                    cursor: "pointer", transition: "transform 0.15s", flexShrink: 0,
                                    transform: !isEraser && color === c ? "scale(1.25)" : "scale(1)"
                                }}
                            />
                        ))}
                    </div>
                    {/* Separator */}
                    <div style={{ width: "1px", height: "28px", background: "var(--border-subtle)", flexShrink: 0 }} />
                    {/* Brush sizes */}
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {WIDTHS.map(w => (
                            <button
                                key={w}
                                onClick={() => { setWidth(w); setIsEraser(false); }}
                                style={{
                                    width: "32px", height: "32px", borderRadius: "50%", border: !isEraser && width === w ? "2px solid var(--accent-primary)" : "2px solid var(--border-subtle)",
                                    background: "var(--bg-surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                    transition: "all 0.15s"
                                }}
                            >
                                <div style={{ width: `${Math.min(w, 20)}px`, height: `${Math.min(w, 20)}px`, borderRadius: "50%", background: effectiveColor }} />
                            </button>
                        ))}
                    </div>
                    {/* Separator */}
                    <div style={{ width: "1px", height: "28px", background: "var(--border-subtle)", flexShrink: 0 }} />
                    {/* Eraser */}
                    <button
                        onClick={() => setIsEraser(e => !e)}
                        style={{ padding: "6px 12px", borderRadius: "8px", border: isEraser ? "2px solid var(--accent-primary)" : "2px solid var(--border-subtle)", background: isEraser ? "var(--accent-primary)" : "var(--bg-surface)", color: isEraser ? "#fff" : "var(--text-primary)", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                    >
                        ✏️ 橡皮
                    </button>
                    {/* Clear */}
                    <button
                        onClick={handleClear}
                        style={{ padding: "6px 12px", borderRadius: "8px", border: "2px solid #e74c3c33", background: "#e74c3c12", color: "#e74c3c", cursor: "pointer", fontSize: "13px", fontWeight: 600, marginLeft: "auto" }}
                    >
                        🗑️ 清空
                    </button>
                </div>
            )}
            {/* Canvas */}
            <div style={{ flex: 1, position: "relative", borderRadius: "16px", overflow: "hidden", border: "2px solid var(--border-subtle)", background: "#fff", minHeight: 0 }}>
                <canvas
                    ref={canvasRef}
                    width={1600}
                    height={900}
                    style={{
                        width: "100%", height: "100%", display: "block",
                        cursor: !isPainter ? "not-allowed" : isEraser ? "cell" : "crosshair",
                        touchAction: "none",
                    }}
                    onMouseDown={startDraw}
                    onMouseMove={moveDraw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={moveDraw}
                    onTouchEnd={endDraw}
                />
                {!isPainter && (
                    <div style={{ position: "absolute", inset: 0, cursor: "default" }} />
                )}
            </div>
        </div>
    );
}

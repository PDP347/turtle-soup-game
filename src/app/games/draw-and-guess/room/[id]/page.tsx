"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DrawingCanvas from "../../components/DrawingCanvas";
import type { DrawingEvent, DrawingStroke, DrawAndGuessRoom, Difficulty } from "@/games/draw-and-guess/models/game";

interface ChatMessage {
    id: string;
    player_name: string;
    content: string;
    is_correct_guess: boolean;
    created_at: string;
}

export default function DrawAndGuessRoom() {
    const { id: roomId } = useParams() as { id: string };
    const router = useRouter();

    const [playerName, setPlayerName] = useState("");
    const [room, setRoom] = useState<DrawAndGuessRoom | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [guessInput, setGuessInput] = useState("");
    const [timeLeft, setTimeLeft] = useState(0);
    const [externalDrawEvent, setExternalDrawEvent] = useState<DrawingEvent | null>(null);
    const [wordOptions, setWordOptions] = useState<{ word: string; hint: string; category: string }[]>([]);
    const [isLoadingWords, setIsLoadingWords] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [showWordReveal, setShowWordReveal] = useState(false);
    const [hintRevealed, setHintRevealed] = useState(false);
    const [onlinePlayers, setOnlinePlayers] = useState<string[]>([]);
    const [hasRefreshedAI, setHasRefreshedAI] = useState(false);

    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasGuessedRef = useRef(false);

    // Auto-scroll chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Restore player name
    useEffect(() => {
        const saved = localStorage.getItem("dag_player_name") || "";
        setPlayerName(saved);
    }, []);

    // Load room
    const loadRoom = useCallback(async () => {
        const { data } = await supabase.from("draw_rooms").select("*").eq("id", roomId).single();
        if (data) setRoom(data as DrawAndGuessRoom);
    }, [roomId]);

    // Load chat messages
    const loadMessages = useCallback(async () => {
        const { data } = await supabase.from("draw_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
        if (data) setMessages(data as ChatMessage[]);
    }, [roomId]);

    // Timer logic
    const startTimer = useCallback((startAt: string, durationSecs: number) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const calcLeft = () => {
            const elapsed = (Date.now() - new Date(startAt).getTime()) / 1000;
            return Math.max(0, Math.round(durationSecs - elapsed));
        };
        setTimeLeft(calcLeft());
        timerRef.current = setInterval(() => {
            const left = calcLeft();
            setTimeLeft(left);
            if (left <= 0 && timerRef.current) clearInterval(timerRef.current);
        }, 500);
    }, []);

    // Supabase Realtime
    const subscribe = useCallback(() => {
        if (channelRef.current) supabase.removeChannel(channelRef.current);

        const ch = supabase.channel(`dag-room:${roomId}`, {
            config: { presence: { key: playerName || "anon" } }
        });

        // Presence — online players
        ch.on("presence", { event: "sync" }, () => {
            const state = ch.presenceState<{ name: string }>();
            const names = Object.values(state).flat().map(p => p.name as string).filter(Boolean);
            setOnlinePlayers(names);
        });

        // DB: room updates
        ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "draw_rooms", filter: `id=eq.${roomId}` }, (payload) => {
            const updated = payload.new as DrawAndGuessRoom;
            setRoom(updated);
            hasGuessedRef.current = false;
            setHintRevealed(false);
            if (updated.status === "drawing" && updated.round_start_at) {
                startTimer(updated.round_start_at, updated.round_duration_seconds);
                setShowWordReveal(false);
            }
            if (updated.status === "round_end") {
                if (timerRef.current) clearInterval(timerRef.current);
                setShowWordReveal(true);
            }
        });

        // DB: new chat messages
        ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "draw_messages", filter: `room_id=eq.${roomId}` }, (payload) => {
            setMessages(prev => [...prev, payload.new as ChatMessage]);
        });

        // Broadcast: real-time drawing events
        ch.on("broadcast", { event: "draw" }, (payload) => {
            setExternalDrawEvent(payload.payload as DrawingEvent);
        });

        ch.subscribe(async (status) => {
            if (status === "SUBSCRIBED" && playerName) {
                await ch.track({ name: playerName });
            }
        });

        channelRef.current = ch;
    }, [roomId, playerName, startTimer]);

    useEffect(() => {
        if (!playerName) return;
        loadRoom();
        loadMessages();
        subscribe();
        return () => {
            if (channelRef.current) supabase.removeChannel(channelRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [playerName, loadRoom, loadMessages, subscribe]);

    // Sync timer on room load
    useEffect(() => {
        if (room?.status === "drawing" && room.round_start_at) {
            startTimer(room.round_start_at, room.round_duration_seconds);
        }
        if (room?.status === "round_end") setShowWordReveal(true);
    }, [room?.id, room?.status]); // eslint-disable-line

    // Hint reveal at 50% time
    useEffect(() => {
        if (room?.status === "drawing" && room.round_duration_seconds > 0) {
            if (timeLeft <= room.round_duration_seconds / 2 && !hintRevealed) {
                setHintRevealed(true);
            }
        }
    }, [timeLeft, hintRevealed, room]);

    const fetchWords = useCallback(async (useAI: boolean = false) => {
        if (!room) return;
        if (useAI) {
            setHasRefreshedAI(true);
        }
        setIsLoadingWords(true);
        try {
            const usedWords = (room.round_results || []).map((r: { word: string }) => r.word);
            const roomDifficulty = room.difficulty || "中等";

            const response = await fetch("/api/games/draw-and-guess/word", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ difficulty: roomDifficulty, excludeWords: usedWords, useAI }),
            });
            const data = await response.json();

            if (data.success && data.words && Array.isArray(data.words)) {
                setWordOptions(data.words.map((w: any) => ({
                    word: w.word, hint: w.hint, category: w.category, forceDifficulty: roomDifficulty
                })));
            }
        } catch (e) {
            console.error("Word fetch error:", e);
        } finally {
            setIsLoadingWords(false);
        }
    }, [room?.difficulty, room?.round_results]); // eslint-disable-line

    // Auto-fetch words when THIS player becomes the painter in selecting phase
    useEffect(() => {
        if (room?.status !== "selecting" || room.painter !== playerName || wordOptions.length > 0 || isLoadingWords) return;
        fetchWords(false); // Default to local word bank
    }, [room?.status, room?.painter, playerName, fetchWords]); // eslint-disable-line

    // Send draw event via broadcast
    const handleDrawEvent = useCallback((event: DrawingEvent) => {
        if (!channelRef.current) return;
        channelRef.current.send({ type: "broadcast", event: "draw", payload: event });
        // Persist strokes to DB on stroke_end for late joiners
        if (event.type === "stroke_end" && room) {
            // We don't persist every stroke to DB — it's sent the whole strokes array only when needed
        }
        if (event.type === "clear" && room) {
            supabase.from("draw_rooms").update({ strokes: [] }).eq("id", roomId);
        }
    }, [room, roomId]);

    // Guess submission
    const handleGuess = useCallback(async () => {
        if (!guessInput.trim() || !room || room.status !== "drawing" || hasGuessedRef.current) return;
        if (playerName === room.painter) return; // painter can't guess
        const content = guessInput.trim();
        setGuessInput("");

        const isCorrect = content.toLowerCase().trim() === (room.word || "").toLowerCase().trim();

        await supabase.from("draw_messages").insert({
            room_id: roomId, player_name: playerName, content, is_correct_guess: isCorrect,
        });

        if (isCorrect) {
            hasGuessedRef.current = true;
            // Calculate scores
            const newScores = { ...(room.scores || {}) };
            const timeBonus = Math.max(10, Math.round((timeLeft / room.round_duration_seconds) * 100));
            newScores[playerName] = (newScores[playerName] || 0) + timeBonus;
            // Award painter too
            if (room.painter) newScores[room.painter] = (newScores[room.painter] || 0) + 50;

            // Update room to round_end
            await supabase.from("draw_rooms").update({
                status: "round_end",
                scores: newScores,
            }).eq("id", roomId);
        }
    }, [guessInput, room, playerName, roomId, timeLeft]);

    // Pick word (painter selects from 3 options)
    const handlePickWord = useCallback(async (picked: { word: string; hint: string; category: string }) => {
        if (!room) return;
        const startAt = new Date().toISOString();
        await supabase.from("draw_rooms").update({
            status: "drawing",
            word: picked.word,
            word_hint: picked.hint,
            word_category: picked.category,
            round_start_at: startAt,
            strokes: [],
        }).eq("id", roomId);
        setWordOptions([]);
    }, [room, roomId]);

    // Host: start round (rotate painter, generate words)
    const handleStartRound = useCallback(async () => {
        if (!room || isStarting) return;
        setIsStarting(true);
        try {
            const players = room.players || [];
            const nextRound = (room.round || 0) + 1;
            if (nextRound > room.max_rounds) {
                await supabase.from("draw_rooms").update({ status: "game_end" }).eq("id", roomId);
                return;
            }
            // Rotate painter
            const currentIdx = players.indexOf(room.painter || "");
            const nextPainter = players[(currentIdx + 1) % players.length];

            await supabase.from("draw_rooms").update({
                status: "selecting",
                painter: nextPainter,
                round: nextRound,
                word: null,
                word_hint: null,
                word_category: null,
                strokes: [],
            }).eq("id", roomId);
            // Word fetching is handled by the painter's own useEffect (watching status==='selecting')
            // Reset wordOptions so the painter's useEffect triggers a fresh fetch
            setWordOptions([]);
            setHasRefreshedAI(false);
        } catch (e) {
            console.error(e);
        } finally {
            setIsStarting(false);
        }
    }, [room, roomId, playerName, isStarting]);

    // Host: end round manually (time up)
    const handleEndRound = useCallback(async () => {
        if (!room) return;
        const newResults = [...(room.round_results || []), { word: room.word || "", guessedBy: null, timeLeft: 0, scores: {} }];
        await supabase.from("draw_rooms").update({ status: "round_end", round_results: newResults }).eq("id", roomId);
    }, [room, roomId]);

    // Auto end round when timer hits 0
    useEffect(() => {
        if (timeLeft === 0 && room?.status === "drawing" && room.painter === playerName) {
            handleEndRound();
        }
    }, [timeLeft]); // eslint-disable-line

    if (!playerName) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-void)" }}>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "20px", padding: "40px", maxWidth: 360, width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
                    <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: 22 }}>🎨 加入房间</h2>
                    <input
                        placeholder="输入你的昵称" maxLength={12} autoFocus
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "12px 14px", color: "var(--text-primary)", fontSize: 15, outline: "none" }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val) { localStorage.setItem("dag_player_name", val); setPlayerName(val); }
                            }
                        }}
                    />
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>按 Enter 确认</p>
                </div>
            </div>
        );
    }

    const isPainter = room?.painter === playerName;
    const isHost = room?.players?.[0] === playerName;
    const timerPct = room ? (timeLeft / room.round_duration_seconds) * 100 : 0;
    const timerColor = timerPct > 50 ? "#27ae60" : timerPct > 25 ? "#f39c12" : "#e74c3c";

    // ── GAME END ──
    if (room?.status === "game_end") {
        const sortedScores = Object.entries(room.scores || {}).sort((a, b) => b[1] - a[1]);
        return (
            <div style={{ minHeight: "100vh", background: "var(--bg-void)", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 24, padding: "48px 40px", maxWidth: 480, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 24 }}>
                    <div style={{ fontSize: 56 }}>🏆</div>
                    <h2 style={{ color: "var(--text-primary)", fontSize: 28, margin: 0 }}>游戏结束</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {sortedScores.map(([name, score], i) => (
                            <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: i === 0 ? "var(--accent-primary)18" : "var(--bg-surface)", border: `1px solid ${i === 0 ? "var(--accent-primary)" : "var(--border-subtle)"}`, borderRadius: 12, padding: "12px 20px" }}>
                                <span style={{ fontSize: 18 }}>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</span>
                                <span style={{ color: "var(--text-primary)", fontWeight: 600, flex: 1, textAlign: "left", marginLeft: 12 }}>{name}</span>
                                <span style={{ color: "var(--accent-primary)", fontWeight: 700, fontSize: 20 }}>{score}分</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => router.push("/")} style={{ padding: "14px", background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                        返回大厅
                    </button>
                </div>
            </div>
        );
    }

    // ── WAITING ──
    if (room?.status === "waiting") {
        return (
            <div style={{ minHeight: "100vh", background: "var(--bg-void)", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 24, padding: "48px 40px", maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
                    <h2 style={{ color: "var(--text-primary)", fontSize: 22, margin: 0 }}>🎨 房间 <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-primary)" }}>#{roomId}</span></h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>等待玩家加入（最少 2 人）</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(room.players || []).map((p, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-surface)", borderRadius: 10, padding: "10px 16px" }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: onlinePlayers.includes(p) ? "#27ae60" : "#95a5a6" }} />
                                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{p}</span>
                                {i === 0 && <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>房主</span>}
                            </div>
                        ))}
                    </div>
                    <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "10px 16px" }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>AI 难度：</span>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600, marginLeft: 8 }}>{room.difficulty}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 16 }}>共 </span>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{room.max_rounds}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}> 轮</span>
                    </div>
                    {/* Share link */}
                    <div style={{ display: "flex", gap: 8 }}>
                        <input readOnly value={`房间号：${roomId}`} style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px", color: "var(--accent-primary)", fontFamily: "var(--font-mono)", fontSize: 16, letterSpacing: 2, outline: "none" }} />
                        <button onClick={() => navigator.clipboard.writeText(roomId)} style={{ padding: "10px 16px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, color: "var(--text-secondary)", cursor: "pointer", fontSize: 14 }}>复制</button>
                    </div>
                    {isHost && (room.players || []).length >= 2 && (
                        <button onClick={handleStartRound} disabled={isStarting}
                            style={{ padding: "14px", background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: isStarting ? "wait" : "pointer", opacity: isStarting ? 0.7 : 1 }}>
                            {isStarting ? "准备中..." : "🚀 开始游戏"}
                        </button>
                    )}
                    {isHost && (room.players || []).length < 2 && (
                        <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", margin: 0 }}>至少需要 2 名玩家才能开始</p>
                    )}
                    {!isHost && <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", margin: 0 }}>等待房主开始游戏...</p>}
                </div>
            </div>
        );
    }

    // ── SELECTING (painter picks word) ──
    if (room?.status === "selecting") {
        return (
            <div style={{ minHeight: "100vh", background: "var(--bg-void)", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 24, padding: "48px 40px", maxWidth: 520, width: "100%", display: "flex", flexDirection: "column", gap: 20, textAlign: "center" }}>
                    <div style={{ fontSize: 48 }}>✏️</div>
                    {isPainter ? (
                        <>
                            <h2 style={{ color: "var(--text-primary)", fontSize: 22, margin: 0 }}>你是本轮画师！</h2>
                            <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>请从以下词语中选择一个来画</p>
                            {isLoadingWords ? (
                                <p style={{ color: "var(--text-muted)" }}>正在准备词语...</p>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {wordOptions.map((w, i) => {
                                        const diff = (w as any).forceDifficulty || "中等";
                                        const diffConfig = {
                                            "简单": { icon: "🟢", color: "var(--accent-primary)" },
                                            "中等": { icon: "🟡", color: "#f39c12" },
                                            "困难": { icon: "🔴", color: "#e74c3c" }
                                        }[diff as Difficulty] || { icon: "🟡", color: "#f39c12" };

                                        return (
                                            <button key={i} onClick={() => handlePickWord(w)}
                                                style={{ padding: "18px 24px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", transition: "all 0.2s" }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = diffConfig.color; (e.currentTarget as HTMLElement).style.background = `${diffConfig.color}15`; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)"; }}
                                            >
                                                <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{w.word}</span>
                                                <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 4 }}>
                                                    <span>{diffConfig.icon}</span> <span>{diff} · {w.category}</span>
                                                </span>
                                            </button>
                                        );
                                    })}

                                    <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
                                        <button
                                            onClick={() => fetchWords(true)}
                                            disabled={hasRefreshedAI}
                                            style={{
                                                padding: "10px 20px",
                                                background: hasRefreshedAI ? "rgba(0,0,0,0.05)" : "rgba(108, 92, 231, 0.1)",
                                                color: hasRefreshedAI ? "var(--text-muted)" : "var(--accent-primary)",
                                                border: hasRefreshedAI ? "1px dashed var(--border-subtle)" : "1px dashed var(--accent-primary)",
                                                borderRadius: 20,
                                                cursor: hasRefreshedAI ? "not-allowed" : "pointer",
                                                fontSize: 13,
                                                fontWeight: 600,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                                transition: "all 0.2s"
                                            }}
                                            onMouseEnter={e => {
                                                if (hasRefreshedAI) return;
                                                (e.currentTarget as HTMLElement).style.background = "var(--accent-primary)";
                                                (e.currentTarget as HTMLElement).style.color = "#fff";
                                            }}
                                            onMouseLeave={e => {
                                                if (hasRefreshedAI) return;
                                                (e.currentTarget as HTMLElement).style.background = "rgba(108, 92, 231, 0.1)";
                                                (e.currentTarget as HTMLElement).style.color = "var(--accent-primary)";
                                            }}
                                        >
                                            {hasRefreshedAI ? "🛑 脑洞已耗尽 (每轮限换1次)" : "✨ 觉得不够好？让 AI 生成新词！"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <h2 style={{ color: "var(--text-primary)", fontSize: 22, margin: 0 }}>等待画师选词</h2>
                            <p style={{ color: "var(--text-muted)", fontSize: 16, margin: 0 }}>
                                <span style={{ color: "var(--accent-primary)", fontWeight: 700 }}>{room.painter}</span> 正在选择词语...
                            </p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── DRAWING / ROUND_END ──
    return (
        <div style={{ minHeight: "100vh", maxHeight: "100vh", background: "var(--bg-void)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header */}
            <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", background: "var(--bg-card)", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                <span style={{ fontSize: 22 }}>🎨</span>
                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 16, fontFamily: "var(--font-serif)" }}>你画我猜</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", background: "var(--bg-surface)", padding: "2px 8px", borderRadius: 6 }}>#{roomId}</span>

                {/* Round indicator */}
                <span style={{ color: "var(--text-secondary)", fontSize: 13, marginLeft: 4 }}>第 {room?.round}/{room?.max_rounds} 轮</span>

                {/* Painter */}
                <span style={{ background: "var(--accent-primary)18", color: "var(--accent-primary)", fontSize: 13, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>
                    ✏️ {room?.painter}
                </span>

                {/* Timer */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 120, height: 6, background: "var(--border-subtle)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${timerPct}%`, background: timerColor, transition: "width 0.5s linear, background 0.5s" }} />
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: timerColor, minWidth: 36 }}>{timeLeft}</span>
                </div>

                {/* Scores */}
                <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
                    {Object.entries(room?.scores || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, score]) => (
                        <div key={name} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "3px 10px", fontSize: 12 }}>
                            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{name.charAt(0).toUpperCase()}</span>
                            <span style={{ color: "var(--accent-primary)", marginLeft: 4, fontFamily: "var(--font-mono)" }}>{score}</span>
                        </div>
                    ))}
                </div>

                <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, fontFamily: "var(--font-mono)", marginLeft: 8 }}>离开</button>
            </header>

            {/* Main area */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden", gap: 0 }}>
                {/* Canvas area */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px", gap: 8, overflow: "hidden", minWidth: 0 }}>
                    {/* Word display */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        {isPainter ? (
                            <div style={{ background: "var(--accent-primary)", color: "#fff", padding: "8px 20px", borderRadius: 10, fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>
                                画这个：{room?.word}
                            </div>
                        ) : (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {Array.from({ length: room?.word?.length || 0 }).map((_, i) => (
                                    <div key={i} style={{ width: 28, height: 36, borderBottom: "3px solid var(--accent-primary)", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 2 }}>
                                        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>_</span>
                                    </div>
                                ))}
                                <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 8 }}>{room?.word?.length} 个字</span>
                            </div>
                        )}
                        {!isPainter && hintRevealed && room?.word_hint && (
                            <span style={{ fontSize: 13, color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", padding: "4px 12px", borderRadius: 20 }}>
                                💡 提示：{room.word_hint}
                            </span>
                        )}
                        {!isPainter && room?.word_category && (
                            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>分类：{room.word_category}</span>
                        )}
                    </div>

                    {/* Canvas */}
                    <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                        <DrawingCanvas
                            isPainter={isPainter && room?.status === "drawing"}
                            strokes={(room?.strokes || []) as DrawingStroke[]}
                            onDrawEvent={handleDrawEvent}
                            externalEvent={externalDrawEvent}
                        />
                    </div>
                </div>

                {/* Right panel: Chat + Players */}
                <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-card)", overflow: "hidden" }}>
                    {/* Players list */}
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", margin: "0 0 8px", letterSpacing: 2 }}>PLAYERS</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(room?.players || []).map((p) => (
                                <div key={p} style={{ display: "flex", alignItems: "center", gap: 4, background: p === playerName ? "var(--accent-primary)18" : "var(--bg-surface)", border: `1px solid ${p === playerName ? "var(--accent-primary)" : "var(--border-subtle)"}`, borderRadius: 20, padding: "3px 10px", fontSize: 12 }}>
                                    {p === room?.painter && <span>✏️</span>}
                                    <span style={{ color: "var(--text-primary)", fontWeight: p === playerName ? 700 : 400 }}>{p}</span>
                                    <span style={{ color: "var(--accent-primary)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{room?.scores?.[p] || 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Chat messages */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                        {messages.map((msg, i) => (
                            <div key={msg.id || i} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                {msg.is_correct_guess ? (
                                    <div style={{ background: "#27ae6018", border: "1px solid #27ae60", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                                        <span style={{ fontSize: 13, color: "#27ae60", fontWeight: 700 }}>🎉 {msg.player_name} 猜对了！</span>
                                    </div>
                                ) : (
                                    <>
                                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{msg.player_name}</span>
                                        <div style={{ background: msg.player_name === playerName ? "var(--accent-primary)18" : "var(--bg-surface)", border: `1px solid ${msg.player_name === playerName ? "var(--accent-primary)40" : "var(--border-subtle)"}`, borderRadius: 10, padding: "6px 12px", fontSize: 13, color: "var(--text-primary)", wordBreak: "break-word" }}>
                                            {msg.content}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Guess input */}
                    <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                        {isPainter ? (
                            <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>你是画师，无法猜测</p>
                        ) : hasGuessedRef.current ? (
                            <p style={{ fontSize: 12, color: "#27ae60", textAlign: "center", margin: 0, fontWeight: 600 }}>✓ 你已猜对！</p>
                        ) : room?.status === "drawing" ? (
                            <div style={{ display: "flex", gap: 6 }}>
                                <input
                                    value={guessInput}
                                    onChange={e => setGuessInput(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleGuess()}
                                    placeholder="输入你的猜测..."
                                    style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                                />
                                <button onClick={handleGuess} style={{ padding: "8px 12px", background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16 }}>↗</button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Round End Overlay */}
            {showWordReveal && room?.status === "round_end" && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 24, padding: "48px 40px", maxWidth: 440, width: "90%", textAlign: "center", display: "flex", flexDirection: "column", gap: 20 }}>
                        <div style={{ fontSize: 48 }}>🖼️</div>
                        <h2 style={{ color: "var(--text-primary)", fontSize: 24, margin: 0 }}>本轮结束</h2>
                        <div style={{ background: "var(--bg-surface)", borderRadius: 14, padding: "16px 24px" }}>
                            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 8px" }}>答案是</p>
                            <p style={{ fontSize: 32, fontWeight: 700, color: "var(--accent-primary)", margin: 0, letterSpacing: 3 }}>{room.word}</p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {Object.entries(room.scores || {}).sort((a, b) => b[1] - a[1]).map(([name, score], i) => (
                                <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", background: name === playerName ? "var(--accent-primary)12" : "transparent", borderRadius: 8 }}>
                                    <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`} {name}</span>
                                    <span style={{ color: "var(--accent-primary)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{score}分</span>
                                </div>
                            ))}
                        </div>
                        {isHost && (
                            <button onClick={() => { setShowWordReveal(false); handleStartRound(); }}
                                style={{ padding: "14px", background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                                {(room.round || 0) >= (room.max_rounds || 5) ? "查看最终结果 →" : "下一轮 →"}
                            </button>
                        )}
                        {!isHost && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>等待房主进入下一局...</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

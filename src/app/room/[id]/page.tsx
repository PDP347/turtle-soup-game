"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Puzzle } from "@/lib/puzzles";

interface Message {
    id: number;
    player_name: string;
    content: string;
    is_ai: boolean;
    created_at: string;
}

interface RoomData {
    id: string;
    puzzle_data: Puzzle;
    status: "waiting" | "playing" | "revealed";
}

interface Player {
    name: string;
    online_at: string;
}

// ── Constants ─────────────────────────────────────────
const MAX_PLAYERS = 4;

export default function RoomPage() {
    const params = useParams();
    const router = useRouter();
    const roomId = params.id as string;

    const [playerName, setPlayerName] = useState("");
    const [hasJoined, setHasJoined] = useState(false);
    const [room, setRoom] = useState<RoomData | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showVictory, setShowVictory] = useState(false);
    const [isGeneratingNext, setIsGeneratingNext] = useState(false);
    const [displayedSurface, setDisplayedSurface] = useState("");
    const [channelStatus, setChannelStatus] = useState<{ state: "connecting" | "connected" | "error", msg: string }>({ state: "connecting", msg: "" });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const aiRespondingRef = useRef(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Typewriter for surface text
    useEffect(() => {
        if (!room?.puzzle_data.surface) return;
        setDisplayedSurface("");
        const text = room.puzzle_data.surface;
        let idx = 0;
        const iv = setInterval(() => {
            if (idx < text.length) setDisplayedSurface(text.slice(0, ++idx));
            else clearInterval(iv);
        }, 28);
        return () => clearInterval(iv);
    }, [room?.puzzle_data.surface]);

    // Apply theme
    useEffect(() => {
        if (room?.puzzle_data.theme) {
            document.body.className = `theme-${room.puzzle_data.theme}`;
        }
        return () => { document.body.className = "theme-bizarre"; };
    }, [room?.puzzle_data.theme]);

    const loadRoom = useCallback(async () => {
        const { data, error } = await supabase
            .from("rooms")
            .select("*")
            .eq("id", roomId)
            .single();

        if (error || !data) {
            setError("房间不存在或已过期，请返回重新创建。");
            return;
        }
        setRoom(data as RoomData);
        if (data.status === "revealed") setShowVictory(true);
    }, [roomId]);

    // Fetch room on mount so theme applies immediately
    useEffect(() => {
        loadRoom();
    }, [loadRoom]);


    const loadMessages = useCallback(async () => {
        const { data } = await supabase
            .from("messages")
            .select("*")
            .eq("room_id", roomId)
            .order("created_at", { ascending: true });
        if (data) setMessages(data as Message[]);
    }, [roomId]);

    const subscribeRealtime = useCallback((name: string) => {
        // Unsubscribe previous channel
        if (channelRef.current) supabase.removeChannel(channelRef.current);

        const channel = supabase.channel(`room:${roomId}`, {
            config: { presence: { key: name } },
        });

        // Presence: track online players
        channel.on("presence", { event: "sync" }, () => {
            const state = channel.presenceState<Player>();
            const playerList: Player[] = Object.values(state)
                .flat()
                .map((p) => ({ name: p.name as string, online_at: p.online_at as string }));
            setPlayers(playerList);
        });

        // Realtime: new messages
        channel.on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
            (payload) => {
                setMessages((prev) => [...prev, payload.new as Message]);
            }
        );

        // Realtime: room status changes (e.g., revealed)
        channel.on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
            (payload) => {
                const updated = payload.new as RoomData;
                setRoom(updated);
                if (updated.status === "revealed") {
                    setShowVictory(true);
                } else if (updated.status === "playing") {
                    setShowVictory(false);
                    setIsGeneratingNext(false); // Make sure to reset generation state
                    setMessages([]); // Clear chat for new round
                }
            }
        );

        // Realtime Broadcasts for temporary states
        channel.on(
            "broadcast",
            { event: "generating_next" },
            () => setIsGeneratingNext(true)
        );
        channel.on(
            "broadcast",
            { event: "cancel_generating" },
            () => setIsGeneratingNext(false)
        );

        channel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
                setChannelStatus({ state: "connected", msg: "SUBSCRIBED" });
                // Stop polling if Realtime works
                if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                await channel.track({ name, online_at: new Date().toISOString() });
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                setChannelStatus({ state: "error", msg: status });
            } else {
                setChannelStatus((prev) => ({ ...prev, msg: status }));
            }
        });

        channelRef.current = channel;

        // Polling fallback — in case Realtime WebSocket fails
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            const [msgRes, roomRes] = await Promise.all([
                supabase.from("messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
                supabase.from("rooms").select("*").eq("id", roomId).single()
            ]);

            if (msgRes.data) setMessages(msgRes.data as Message[]);
            if (roomRes.data) {
                const updated = roomRes.data as RoomData;
                setRoom((prev) => {
                    if (prev?.status === "revealed" && updated.status === "playing") {
                        setShowVictory(false);
                        setIsGeneratingNext(false);
                    } else if (prev?.status !== "revealed" && updated.status === "revealed") {
                        setShowVictory(true);
                    }
                    return updated;
                });
            }
        }, 4000);
    }, [roomId]);

    const handleJoin = useCallback(async () => {
        if (!playerName.trim()) return;
        setIsLoading(true);
        // Room is already loaded on mount; just load messages
        await loadMessages();
        subscribeRealtime(playerName.trim());
        setHasJoined(true);
        setIsLoading(false);
    }, [playerName, loadMessages, subscribeRealtime]);

    // AI answering: only the first player who asks triggers the API
    const triggerAI = useCallback(async (question: string) => {
        if (aiRespondingRef.current || !room) return;
        aiRespondingRef.current = true;

        try {
            const historyMessages = messages.map((m) => ({
                role: m.is_ai ? "assistant" : "user",
                content: m.is_ai ? m.content : `${m.player_name}: ${m.content}`,
            }));
            historyMessages.push({ role: "user", content: `${playerName}: ${question}` });

            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: historyMessages, puzzle: room.puzzle_data }),
            });

            if (!res.ok || !res.body) throw new Error("API error");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let aiContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                aiContent += decoder.decode(value, { stream: true });
            }

            // Write AI response to DB so all players see it
            await supabase.from("messages").insert({
                room_id: roomId,
                player_name: "🐢 主持人",
                content: aiContent,
                is_ai: true,
            });

            // If victory, update room status
            if (aiContent.includes("【真相大白】")) {
                await supabase.from("rooms").update({ status: "revealed" }).eq("id", roomId);
            }
        } catch (e) {
            console.error("AI error", e);
            await supabase.from("messages").insert({
                room_id: roomId,
                player_name: "🐢 主持人",
                content: "……（信号断了，请重试）",
                is_ai: true,
            });
        } finally {
            aiRespondingRef.current = false;
        }
    }, [room, messages, playerName, roomId]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || !room || isLoading) return;
        const content = input.trim();
        setInput("");

        // Optimistic UI: only show message immediately if Realtime is NOT connected
        // If connected, we wait for the Realtime broadcast to avoid duplication
        if (channelStatus.state !== "connected") {
            const optimistic: Message = {
                id: Date.now(),
                player_name: playerName,
                content,
                is_ai: false,
                created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, optimistic]);
        }

        // Write player message to DB
        await supabase.from("messages").insert({
            room_id: roomId,
            player_name: playerName,
            content,
            is_ai: false,
        });

        // Trigger AI (only if nobody else is responding)
        await triggerAI(content);
    }, [input, room, isLoading, roomId, playerName, triggerAI]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const handleGiveUp = useCallback(async () => {
        if (!room) return;
        await supabase.from("messages").insert({
            room_id: roomId,
            player_name: "🐢 主持人",
            content: `【真相大白】${room.puzzle_data.truth}`,
            is_ai: true,
        });
        await supabase.from("rooms").update({ status: "revealed" }).eq("id", roomId);
    }, [room, roomId]);

    const handlePlayAgain = useCallback(async () => {
        if (!room || isGeneratingNext) return;
        setIsGeneratingNext(true);

        // Broadcast generation state to other clients immediately
        if (channelRef.current) {
            channelRef.current.send({
                type: "broadcast",
                event: "generating_next",
                payload: {}
            });
        }

        try {
            // ----- 1. 积分与成就结算 (Score Settlement) -----
            const playerQuestions: Record<string, number> = {};
            messages.forEach((msg) => {
                if (!msg.is_ai) {
                    playerQuestions[msg.player_name] = (playerQuestions[msg.player_name] || 0) + 1;
                }
            });

            const currentTheme = room.puzzle_data.theme || "bizarre";

            for (const [name, count] of Object.entries(playerQuestions)) {
                const { data, error: fetchError } = await supabase
                    .from("player_stats")
                    .select("id, matches_won, total_questions")
                    .eq("user_id", name)
                    .eq("theme", currentTheme)
                    .maybeSingle(); // maybeSingle handles 0 rows better than .single()

                if (data && !fetchError) {
                    await supabase.from("player_stats").update({
                        matches_won: data.matches_won + 1,
                        total_questions: data.total_questions + count,
                        last_played: new Date().toISOString()
                    }).eq("id", data.id);
                } else {
                    await supabase.from("player_stats").insert({
                        user_id: name,
                        theme: currentTheme,
                        matches_won: 1,
                        total_questions: count
                    });
                }
            }

            // ----- 2. 生成同主题新谜题 -----
            const res = await fetch("/api/puzzle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ theme: currentTheme, difficulty: room.puzzle_data.difficulty || "中等" }),
            });
            if (!res.ok) throw new Error("API error");
            const data = await res.json();
            const newPuzzle = data.puzzle;

            if (!newPuzzle) throw new Error("No puzzle data in response");

            // Delete specific room messages
            await supabase.from("messages").delete().eq("room_id", roomId);

            // Update room
            await supabase.from("rooms").update({
                puzzle_data: newPuzzle,
                status: "playing"
            }).eq("id", roomId);

            // Local wipe immediately (to avoid flickers)
            setMessages([]);
            setShowVictory(false);

        } catch (e) {
            console.error("Play again failed", e);
            alert("再来一局生成失败，请稍后重试。");
            if (channelRef.current) {
                channelRef.current.send({
                    type: "broadcast",
                    event: "cancel_generating",
                    payload: {}
                });
            }
        } finally {
            setIsGeneratingNext(false);
        }
    }, [room, roomId, isGeneratingNext]);

    // Cleanup on unmount
    useEffect(() => () => {
        if (channelRef.current) supabase.removeChannel(channelRef.current);
        if (pollRef.current) clearInterval(pollRef.current);
    }, []);

    const theme = room?.puzzle_data?.theme ?? "bizarre";
    const victoryText = messages.findLast((m) => m.content.includes("【真相大白】"))?.content
        .replace("【真相大白】", "").trim() ?? room?.puzzle_data.truth ?? "";

    // ── Join Screen ──────────────────────────────────────
    if (!hasJoined) {
        return (
            <div className="app-layout" style={{ justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: 24 }}>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-accent)", borderRadius: "var(--radius-lg)", padding: "48px 40px", maxWidth: 400, width: "100%", boxShadow: "var(--shadow-deep)", display: "flex", flexDirection: "column", gap: 24 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", textAlign: "center", lineHeight: 1.4 }}>
                        🐢 加入房间
                        <br />
                        <span style={{ fontSize: 18, color: "var(--accent-primary)" }}>
                            {room ? `《${room.puzzle_data.title}》` : "加载中..."}
                        </span>
                    </h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", fontFamily: "var(--font-mono)" }}>
                        请输入你的玩家昵称，最多 {MAX_PLAYERS} 人
                    </p>
                    {error && <p style={{ color: "#e74c3c", fontSize: 14, textAlign: "center" }}>{error}</p>}
                    <input
                        type="text"
                        placeholder="输入昵称（如：侦探A）"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
                        maxLength={10}
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "14px 16px", color: "var(--text-primary)", fontSize: 16, fontFamily: "var(--font-serif)", outline: "none", width: "100%" }}
                    />
                    <button
                        className="victory-btn"
                        onClick={handleJoin}
                        disabled={!playerName.trim() || isLoading}
                        style={{ width: "100%" }}
                    >
                        {isLoading ? "进入中..." : "进入推理室 →"}
                    </button>
                    <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font-mono)" }}>
                        ← 返回首页
                    </button>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="app-layout" style={{ justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
                <div style={{ textAlign: "center", color: "var(--text-primary)", padding: 32 }}>
                    <p style={{ fontSize: 20, marginBottom: 24 }}>{error}</p>
                    <button className="victory-btn" onClick={() => router.push("/")}>← 返回首页</button>
                </div>
            </div>
        );
    }

    // ── Main Game UI ─────────────────────────────────────
    return (
        <>
            {showVictory && (
                <div className="victory-overlay" onClick={() => setShowVictory(false)}>
                    <div className="victory-modal" onClick={(e) => e.stopPropagation()}>
                        {theme === "healing" && <div className="victory-icon">☀️</div>}
                        <h2 className="victory-title">真相大白</h2>
                        <p className="victory-text">{victoryText}</p>
                        <div style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "center" }}>
                            <button className="victory-btn" style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }} onClick={() => router.push("/")}>结束本局</button>
                            <button className="victory-btn" style={{ flex: 1, padding: "12px" }} onClick={handlePlayAgain} disabled={isGeneratingNext}>
                                {isGeneratingNext ? "生成中..." : "再来一局 🔄"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="app-layout">
                <header className="header">
                    <span className="header-icon">🐢</span>
                    <h1 className="header-title">{room?.puzzle_data.title ?? "加载中..."}</h1>
                    {/* Online Players + Connection Status */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", marginRight: 16 }}>
                        {/* Connection dot */}
                        <div
                            title={channelStatus.state === "connected" ? "实时连接正常" : `连接状态: ${channelStatus.msg || "正在连接..."}`}
                            style={{
                                width: 8, height: 8, borderRadius: "50%",
                                background: channelStatus.state === "connected" ? "#2ecc71" : channelStatus.state === "error" ? "#e74c3c" : "#f39c12",
                                boxShadow: channelStatus.state === "connected" ? "0 0 6px #2ecc71" : "none",
                                flexShrink: 0,
                                cursor: "help"
                            }}
                        />
                        {players.map((p, i) => (
                            <div key={i} style={{
                                background: "var(--accent-primary)",
                                color: "#fff",
                                borderRadius: "50%",
                                width: 36, height: 36,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 13, fontWeight: 700,
                                boxShadow: "0 0 10px var(--accent-primary-glow)",
                            }} title={p.name}>
                                {p.name.charAt(0).toUpperCase()}
                            </div>
                        ))}
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                            {players.length}/{MAX_PLAYERS}人
                        </span>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                        房间 #{roomId}
                    </span>
                </header>

                <main className="game-area">
                    {/* Surface */}
                    {room && (
                        <div className="surface-panel">
                            <div className="surface-meta">
                                <span className="surface-label">■ 汤面</span>
                                <div className="surface-divider" />
                                <span className={`card-badge badge-${room.puzzle_data.difficulty}`}>
                                    {room.puzzle_data.difficulty}
                                </span>
                                <button className="back-btn" onClick={handleGiveUp} style={{ marginRight: 8 }}>
                                    💡 放弃揭晓
                                </button>
                                <button className="back-btn" onClick={() => router.push("/")}>← 离开</button>
                            </div>
                            <p className="surface-text">
                                {displayedSurface}
                                {displayedSurface.length < (room.puzzle_data.surface?.length ?? 0) && (
                                    <span className="typing-cursor" />
                                )}
                            </p>
                        </div>
                    )}

                    {/* Chat */}
                    <div className="chat-container">
                        <div className="messages-list">
                            {messages.length === 0 && (
                                <p className="empty-hint">🕯️ 等待玩家提问... 他只回答：是 / 否 / 无关</p>
                            )}
                            {messages.map((msg, index) => {
                                const isVictory = msg.is_ai && msg.content.includes("【真相大白】");
                                const isMe = msg.player_name === playerName;
                                // Simple parsing for the chat UI to look decent
                                let displayContent = msg.content;
                                if (isVictory) {
                                    displayContent = displayContent.replace("【真相大白】", "⚡ 真相大白\n");
                                }
                                return (
                                    <div key={msg.id || index} className={`message-row ${msg.is_ai ? "assistant" : isMe ? "user" : "assistant"}`}>
                                        {!msg.is_ai && !isMe && (
                                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, paddingLeft: 4, fontFamily: "var(--font-mono)" }}>
                                                {msg.player_name}
                                            </div>
                                        )}
                                        <div className={`bubble ${msg.is_ai ? "assistant" : isMe ? "user" : "assistant"}${isVictory ? " victory" : ""}`} style={{ whiteSpace: "pre-wrap" }}>
                                            {displayContent}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="input-area">
                            <div className="input-wrapper">
                                <textarea
                                    className="input-field"
                                    placeholder="向主持人提出你的猜测..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                    disabled={showVictory}
                                />
                            </div>
                            <button className="send-btn" onClick={handleSend} disabled={!input.trim() || showVictory}>
                                ↗
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}

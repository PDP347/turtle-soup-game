"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { UndercoverSession, UndercoverPlayer, GameMode } from "@/games/undercover/models/types";
import '../../undercover.css'; // Import the new minimalist UI styles;

interface Message {
    id?: number;
    room_id: string;
    player_name: string;
    content: string;
    is_ai: boolean;
    message_type: "chat" | "system" | "vote";
    created_at?: string;
}

export default function UndercoverRoomPage() {
    const params = useParams();
    const router = useRouter();
    const roomId = params.id as string;

    const [playerName, setPlayerName] = useState("");
    const [hasJoined, setHasJoined] = useState(false);
    const [sessionData, setSessionData] = useState<UndercoverSession | null>(null);
    const [roomStatus, setRoomStatus] = useState<"waiting" | "playing" | "finished">("waiting");
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    const [isHoldingWord, setIsHoldingWord] = useState(false);
    const [myVote, setMyVote] = useState<string>("");
    const [hasSubmittedVote, setHasSubmittedVote] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Apply undercover minimalist theme to body
    useEffect(() => {
        document.body.className = "undercover-theme";
        return () => { document.body.className = "theme-hub"; };
    }, []);

    // Auto-scroll logic for chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const loadRoom = useCallback(async () => {
        const { data, error } = await supabase
            .from("undercover_rooms")
            .select("*")
            .eq("id", roomId)
            .single();

        if (error || !data) {
            setError("房间不存在或已解散，请返回大厅。");
            return;
        }
        setSessionData(data.session_data as UndercoverSession);
        setRoomStatus(data.status);
    }, [roomId]);

    useEffect(() => {
        loadRoom();
    }, [loadRoom]);

    const subscribeRealtime = useCallback((name: string) => {
        if (channelRef.current) supabase.removeChannel(channelRef.current);

        const channel = supabase.channel(`undercover:${roomId}`, {
            config: { presence: { key: name } },
        });

        // Sync messages
        channel.on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "undercover_messages", filter: `room_id=eq.${roomId}` },
            (payload) => {
                setMessages((prev) => [...prev, payload.new as Message]);
            }
        );

        // Sync room state
        channel.on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "undercover_rooms", filter: `id=eq.${roomId}` },
            (payload) => {
                const updatedSession = payload.new.session_data as UndercoverSession;
                setSessionData(updatedSession);
                setRoomStatus(payload.new.status);
                // Reset vote state if phase changed away from voting
                if (updatedSession.phase !== "voting") {
                    setHasSubmittedVote(false);
                    setMyVote("");
                }
            }
        );

        channel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
                await channel.track({ name, online_at: new Date().toISOString() });
            }
        });

        channelRef.current = channel;

        // Polling fallback
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            const [msgRes, roomRes] = await Promise.all([
                supabase.from("undercover_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
                supabase.from("undercover_rooms").select("*").eq("id", roomId).single()
            ]);
            if (msgRes.data) setMessages(msgRes.data as Message[]);
            if (roomRes.data) {
                const newSess = roomRes.data.session_data as UndercoverSession;
                setSessionData(newSess);
                setRoomStatus(roomRes.data.status);
                if (newSess.phase !== "voting") {
                    setHasSubmittedVote(false);
                }
            }
        }, 4000);
    }, [roomId]);

    const loadMessages = useCallback(async () => {
        const { data } = await supabase
            .from("undercover_messages")
            .select("*")
            .eq("room_id", roomId)
            .order("created_at", { ascending: true });
        if (data) setMessages(data as Message[]);
    }, [roomId]);

    const handleJoin = useCallback(async () => {
        if (!playerName.trim()) return;
        setIsLoading(true);

        // Fetch latest to prevent race condition
        const { data: dbRoom } = await supabase.from("undercover_rooms").select("session_data").eq("id", roomId).single();
        if (!dbRoom) {
            setError("房间不存在");
            setIsLoading(false);
            return;
        }

        let currentSession = dbRoom.session_data as UndercoverSession;
        const isExisting = currentSession.players.find(p => p.username === playerName.trim());

        if (!isExisting) {
            currentSession = {
                ...currentSession,
                players: [...currentSession.players, {
                    userId: String(Date.now()), // temp ID for local usage
                    username: playerName.trim(),
                    role: "civilian", // assigned later
                    isAlive: true,
                    hasSpoken: false,
                    voteCount: 0,
                    keyword: ""
                }]
            };

            await supabase
                .from("undercover_rooms")
                .update({ session_data: currentSession })
                .eq("id", roomId);

            // System message
            await supabase.from("undercover_messages").insert({
                room_id: roomId,
                player_name: "系统",
                content: `${playerName.trim()} 加入了房间`,
                is_ai: true,
                message_type: "system"
            });
        }

        setSessionData(currentSession); // Ensure local state is updated immediately!
        await loadMessages();
        subscribeRealtime(playerName.trim());
        setHasJoined(true);
        setIsLoading(false);
    }, [playerName, roomId, loadMessages, subscribeRealtime]);

    // Timer Logic 
    useEffect(() => {
        if (sessionData?.phase === "discussion" && sessionData.discussionEndTime) {
            const interval = setInterval(() => {
                const remaining = Math.max(0, Math.floor((sessionData.discussionEndTime! - Date.now()) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) {
                    clearInterval(interval);
                    // Only the first player triggers timeout to prevent duplicate calls
                    if (sessionData.players[0]?.username === playerName) {
                        callJudge("end_discussion");
                    }
                }
            }, 1000);
            return () => clearInterval(interval);
        } else if (sessionData?.phase === "voting" && sessionData.votingEndTime) {
            const interval = setInterval(() => {
                const remaining = Math.max(0, Math.floor((sessionData.votingEndTime! - Date.now()) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) {
                    clearInterval(interval);
                    if (!hasSubmittedVote) {
                        handleCastVote(true); // auto-skip
                    }
                }
            }, 1000);
            return () => clearInterval(interval);
        } else if (sessionData?.phase.startsWith("speaking") && sessionData.speakingEndTime) {
            const interval = setInterval(() => {
                const remaining = Math.max(0, Math.floor((sessionData.speakingEndTime! - Date.now()) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) {
                    clearInterval(interval);
                    // Only the current speaker triggers timeout
                    if (sessionData.players[sessionData.currentSpeakerIndex]?.username === playerName) {
                        callJudge("player_speak", "发言超时");
                    }
                }
            }, 1000);
            return () => clearInterval(interval);
        }
        else {
            setTimeLeft(null);
        }
    }, [sessionData?.phase, sessionData?.discussionEndTime, sessionData?.votingEndTime, sessionData?.speakingEndTime, sessionData?.currentSpeakerIndex, playerName, hasSubmittedVote]);

    // AI/StateMachine Dispatcher
    const callJudge = useCallback(async (
        action: "start_game" | "player_speak" | "end_discussion" | "player_vote" | "submit_vote",
        latestMessage?: string,
        votes?: Record<string, string>,
        singleVote?: { voter: string, target: string }
    ) => {
        if (!sessionData) return;
        setIsLoading(true);

        try {
            const res = await fetch("/api/games/undercover/judge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roomId,
                    action,
                    sessionData,
                    latestMessage,
                    votes,
                    singleVote
                })
            });
            const data = await res.json();

            if (data.systemMessage) {
                await supabase.from("undercover_messages").insert({
                    room_id: roomId,
                    player_name: "👨‍⚖️ 系统裁判",
                    content: data.systemMessage,
                    is_ai: true,
                    message_type: "system"
                });
            }

            if (data.updatedSession) {
                let newStatus = roomStatus;
                if (data.updatedSession.phase === "result") {
                    newStatus = "finished";
                } else if (data.updatedSession.phase === "speaking" || data.updatedSession.phase === "speaking_pk" || data.updatedSession.phase === "voting") {
                    newStatus = "playing";
                }

                await supabase.from("undercover_rooms").update({
                    session_data: data.updatedSession,
                    status: newStatus
                }).eq("id", roomId);
            }
        } catch (e) {
            console.error("Judge failed", e);
        } finally {
            setIsLoading(false);
        }
    }, [roomId, sessionData, roomStatus]);

    const handleSendTextMode = async () => {
        if (!input.trim() || isLoading) return;
        const content = input.trim();
        setInput("");

        await supabase.from("undercover_messages").insert({
            room_id: roomId,
            player_name: playerName,
            content,
            is_ai: false,
            message_type: "chat"
        });

        const myTurn = (sessionData?.phase.startsWith("speaking")) && sessionData?.players[sessionData?.currentSpeakerIndex || 0]?.username === playerName;
        if (myTurn) {
            await callJudge("player_speak", content);
        }
    };

    const handlePartyModeEndTurn = async () => {
        await callJudge("player_speak", "发言完毕（线下）");
    };

    const startGame = async () => {
        if (!sessionData || sessionData.players.length < 3) {
            alert("最少需要 3 名玩家才能开始！");
            return;
        }
        await callJudge("start_game");
    };

    const handleCastVote = async (isAutoTimeout = false) => {
        const voteTarget = (isAutoTimeout && !myVote) ? "skip" : myVote;
        if (!voteTarget) return;

        setHasSubmittedVote(true);

        if (sessionData?.gameMode === "party" || true) {
            // Everyone submits their vote globally now
            await callJudge("submit_vote", undefined, undefined, { voter: playerName, target: voteTarget });
        }
    };

    // --- Render Join Screen ---
    if (!hasJoined) {
        return (
            <div className="undercover-theme" style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <div style={{ background: "var(--uc-card-bg)", border: "1px solid var(--uc-border)", borderRadius: "24px", padding: "48px 40px", maxWidth: 400, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 24 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--uc-text-main)", textAlign: "center", lineHeight: 1.4 }}>
                        🕵️ 加入谁是卧底
                        <br />
                        <span style={{ fontSize: 18, color: "var(--uc-primary)" }}>房间 #{roomId}</span>
                    </h2>
                    {error && <p style={{ color: "var(--uc-accent)", fontSize: 14, textAlign: "center" }}>{error}</p>}
                    <input
                        type="text"
                        placeholder="输入你的代号"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
                        maxLength={10}
                        style={{ background: "var(--uc-bg-color)", border: "1px solid var(--uc-border)", borderRadius: "99px", padding: "14px 20px", color: "var(--uc-text-main)", fontSize: 16, outline: "none", width: "100%", textAlign: "center", boxSizing: "border-box" }}
                    />
                    <button className="primary-action-btn" onClick={handleJoin} disabled={!playerName.trim() || isLoading} style={{ width: "100%", marginBottom: "16px" }}>
                        {isLoading ? "入座中..." : "入局 →"}
                    </button>
                    <button className="secondary-action-btn" onClick={() => router.push("/games/undercover")} style={{ width: "100%" }}>
                        ← 返回大厅
                    </button>
                </div>
            </div>
        );
    }

    if (error) return <div className="app-layout" style={{ justifyContent: "center", alignItems: "center" }}>{error}</div>;

    // View Data Layer
    const me = sessionData?.players.find(p => p.username === playerName);
    const myTurn = sessionData?.phase.startsWith("speaking") && sessionData?.players[sessionData?.currentSpeakerIndex || 0]?.username === playerName;
    const isParty = sessionData?.gameMode === "party";

    return (
        <div className="undercover-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>
            <main className="main-container">
                {/* Status Header */}
                <div className="status-header" style={{ padding: "20px", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 4, letterSpacing: "1px", textTransform: "uppercase" }}>房间号 {roomId} · {isParty ? "🎉 聚会版" : "💬 在线版"}</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>
                            {sessionData?.phase === "waiting" ? "等待中..." :
                                sessionData?.phase === "speaking" ? `第 ${sessionData?.roundCount} 轮发言` :
                                    sessionData?.phase === "speaking_pk" ? `决战：PK 发言` :
                                        sessionData?.phase === "discussion" ? `自由讨论` :
                                            sessionData?.phase === "voting" ? `投票阶段` : "游戏结束"}
                        </div>
                        {(sessionData?.phase === "speaking" || sessionData?.phase === "discussion" || sessionData?.phase === "voting") && timeLeft !== null && (
                            <div className="timer-badge" style={{ display: "inline-block", marginTop: "8px" }}>
                                倒计时: {timeLeft}s
                            </div>
                        )}
                    </div>
                    {sessionData?.phase === "waiting" && (
                        <button className="primary-action-btn" onClick={startGame} disabled={isLoading}>
                            主持开局 ({sessionData?.players.length} 人)
                        </button>
                    )}
                </div>

                {/* HOLD TO VIEW CARD (Only in Party Mode when playing) */}
                {isParty && sessionData?.phase !== "waiting" && sessionData?.phase !== "result" && (
                    <div style={{ padding: "20px", display: "flex", justifyContent: "center", borderBottom: "1px solid var(--uc-border)" }}>
                        <div
                            onPointerDown={() => setIsHoldingWord(true)}
                            onPointerUp={() => setIsHoldingWord(false)}
                            onPointerLeave={() => setIsHoldingWord(false)}
                            style={{
                                width: "100%", maxWidth: "400px",
                                userSelect: "none", cursor: "pointer",
                                background: isHoldingWord ? "var(--uc-secondary)" : "var(--uc-bg-color)",
                                color: isHoldingWord ? "#fff" : "var(--uc-text-main)",
                                padding: "24px 16px", borderRadius: "12px",
                                border: isHoldingWord ? "none" : "1px dashed var(--uc-border)",
                                textAlign: "center",
                                transition: "all 0.2s"
                            }}
                        >
                            {!me?.isAlive ? (
                                <span style={{ opacity: 0.7, fontSize: "16px" }}>你已出局。</span>
                            ) : isHoldingWord ? (
                                <div style={{ fontSize: "18px", fontWeight: "bold" }}>
                                    {me?.role === "mr_white" ? "你是【白板】！请根据别人的描述伪装自己。" : `你的词语是：【${me?.keyword}】`}
                                </div>
                            ) : (
                                <span style={{ opacity: 0.6, fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                    🔒 <span>按住查看你的身份与词语<br /><small style={{ fontSize: "12px", marginTop: "4px", display: "block" }}>(防偷看)</small></span>
                                </span>
                            )}
                        </div>
                    </div>
                )
                }

                {/* Voting Panel Overlay */}
                {
                    sessionData?.phase === "voting" && me?.isAlive && !hasSubmittedVote && (
                        <div style={{ padding: "30px 20px", background: "transparent" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", maxWidth: "400px", margin: "0 auto" }}>
                                <span style={{ color: "var(--uc-accent)", fontWeight: "bold", fontSize: "18px" }}>🩸 关键时刻：你要票出谁？</span>
                                <select
                                    value={myVote}
                                    onChange={(e) => setMyVote(e.target.value)}
                                    style={{ width: "100%", padding: "12px", background: "var(--uc-bg-color)", color: "var(--uc-text-main)", border: "1px solid var(--uc-border)", borderRadius: "8px", fontSize: "16px" }}
                                >
                                    <option value="">选择你的怀疑对象...</option>
                                    <option value="skip">🫥 【弃票 / 等等再杀】</option>
                                    {sessionData.players.filter(p => p.isAlive && p.username !== playerName).map(p => (
                                        <option key={p.username} value={p.username}>投给: {p.username}</option>
                                    ))}
                                </select>
                                <button
                                    className="primary-action-btn"
                                    onClick={() => handleCastVote(false)}
                                    disabled={!myVote || isLoading}
                                    style={{ width: "100%", marginTop: "12px" }}
                                >
                                    {isLoading ? "提交中..." : "确认投票 (不可更改)"}
                                </button>
                            </div>
                        </div>
                    )
                }

                {
                    sessionData?.phase === "voting" && hasSubmittedVote && (
                        <div style={{ padding: "20px", textAlign: "center", color: "var(--uc-text-muted)", fontStyle: "italic" }}>
                            ✅ 已投票完成，正在等待其他人...
                        </div>
                    )
                }


                {/* Player Avatars */}
                <div style={{ display: "flex", gap: 16, padding: "20px", overflowX: "auto", background: "transparent" }}>
                    {sessionData?.players.map((p, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <div
                                className="player-avatar"
                                style={{
                                    width: 60, height: 60, borderRadius: "50%", background: p.isAlive ? "var(--uc-bg-color)" : "#eee",
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: "bold",
                                    color: p.isAlive ? (i % 2 === 0 ? "var(--uc-primary)" : "var(--uc-secondary)") : "#bbb",
                                    border: p.isAlive ? `3px solid ${i % 2 === 0 ? "var(--uc-primary)" : "var(--uc-secondary)"}` : "3px solid #ddd",
                                    opacity: p.isAlive ? 1 : 0.6,
                                    position: "relative"
                                }}
                            >
                                {p.username.slice(0, 1).toUpperCase()}
                                {!p.isAlive && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>❌</div>}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--uc-text-muted)", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.username}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Party Mode Central UI for Speaking/Discussion */}
                {
                    isParty && sessionData?.phase !== "waiting" && sessionData?.phase !== "result" && (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                            {myTurn ? (
                                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 20 }}>
                                    <div style={{ fontSize: "60px", animation: "pulse 2s infinite" }}>🎤</div>
                                    <h2 style={{ fontSize: "24px", color: "var(--text-primary)" }}>轮到你发言啦！</h2>
                                    <p style={{ color: "var(--text-muted)" }}>请直接在线下大家面前描述。</p>
                                    <button onClick={handlePartyModeEndTurn} className="victory-btn" disabled={isLoading} style={{ padding: "16px 32px", fontSize: "16px" }}>
                                        ✅ 发言完毕，移交下一位
                                    </button>
                                </div>
                            ) : sessionData?.phase.startsWith("speaking") ? (
                                <div style={{ textAlign: "center", opacity: 0.6 }}>
                                    <div style={{ fontSize: "40px", marginBottom: 10 }}>👀</div>
                                    <p>请仔细聆听 【{sessionData.players[sessionData.currentSpeakerIndex]?.username}】 的发言...</p>
                                </div>
                            ) : sessionData?.phase === "voting" ? (
                                null // Handled by top panel
                            ) : sessionData?.phase === "discussion" ? (
                                <div style={{ textAlign: "center", opacity: 0.8 }}>
                                    <div style={{ fontSize: "40px", marginBottom: 10 }}>💬</div>
                                    <p>自由讨论阶段。<br />大家可以在线下畅说欲言，决定票死谁。</p>
                                    {me?.username === sessionData.players[0]?.username && (
                                        <button onClick={() => callJudge("end_discussion")} className="back-btn" disabled={isLoading} style={{ marginTop: 24, padding: "12px 24px" }}>
                                            强制结束讨论，立刻投票 👉
                                        </button>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    )
                }


                {/* Result UI for both modes */}
                {
                    sessionData?.phase === "result" && (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                            <div style={{ textAlign: "center", background: "var(--uc-card-bg)", padding: "30px", borderRadius: "24px", border: "1px solid var(--uc-border)", boxShadow: "0 10px 40px rgba(0,0,0,0.05)" }}>
                                <div style={{ fontSize: "60px", marginBottom: "16px" }}>
                                    {sessionData?.winners === "civilians" ? "🎉" : "😈"}
                                </div>
                                <h2 style={{ fontSize: "28px", color: sessionData?.winners === "civilians" ? "var(--uc-primary)" : "var(--uc-accent)", marginBottom: "20px" }}>
                                    {sessionData?.winners === "civilians" ? "平民阵营 胜利！" : "卧底/白板 胜利！"}
                                </h2>
                                <p style={{ color: "var(--uc-text-muted)", fontSize: "16px", marginBottom: "30px", lineHeight: "1.6" }}>
                                    平民词：【{sessionData?.civilianWord}】<br />
                                    卧底词：【{sessionData?.undercoverWord}】
                                </p>

                                {sessionData.players[0]?.username === playerName ? (
                                    <button className="victory-btn" onClick={startGame} disabled={isLoading} style={{ width: "100%", padding: "16px 32px", fontSize: "18px", borderRadius: "99px", background: "var(--uc-primary)", color: "white", border: "none" }}>
                                        {isLoading ? "重置中..." : "🔄 再来一局"}
                                    </button>
                                ) : (
                                    <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>等待房主开启下一局...</p>
                                )}
                            </div>
                        </div>
                    )
                }


                {/* Text Mode Chat Records (Hidden in Party Mode mostly, but show System Results so players know what happened) */}
                {
                    (!isParty || sessionData?.phase === "result" || sessionData?.phase === "waiting") && (
                        <div className="chat-container" style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                            {messages.filter(m => !isParty || m.message_type === "system").map((msg, index) => {
                                const isSystem = msg.message_type === "system";
                                const isMe = msg.player_name === playerName;

                                if (isSystem) {
                                    const isJudge = msg.player_name.includes("裁判") || msg.player_name.includes("法官");
                                    return (
                                        <div key={index} className="message-row system">
                                            <div className="chat-bubble">
                                                {isJudge ? "👨‍⚖️ " : ""}{msg.content}
                                            </div>
                                        </div>
                                    )
                                }

                                return (
                                    <div key={index} className={`message-row ${isMe ? 'me' : 'other'}`}>
                                        <div className="player-label">
                                            {msg.player_name}
                                        </div>
                                        <div className="chat-bubble">
                                            {msg.content}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    )
                }

                {/* Input Area (Text mode only) */}
                {
                    (!isParty) && (
                        <div className="input-container" style={{ position: "relative", display: "flex", gap: "12px", alignItems: "center" }}>
                            {myTurn && (
                                <div style={{ position: "absolute", top: -20, left: 24, color: "var(--uc-accent)", fontSize: 13, fontWeight: "bold", background: "var(--uc-bg-color)", padding: "0 8px", borderRadius: "10px" }}>
                                    🔥 轮到你发言了！
                                </div>
                            )}
                            <input
                                className="chat-input"
                                placeholder={sessionData?.phase === "waiting" ? "大家在大厅闲聊..." : myTurn ? "描述你的词（勿直接揭底）..." : "等待发言..."}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSendTextMode(); } }}
                                disabled={sessionData?.phase === "speaking" && !myTurn}
                                style={{ flex: 1 }}
                            />
                            <button
                                className="send-btn"
                                onClick={handleSendTextMode}
                                disabled={!input.trim() || (sessionData?.phase === "speaking" && !myTurn)}
                            >
                                ↑
                            </button>
                        </div>
                    )
                }
            </main >
        </div >
    );
}

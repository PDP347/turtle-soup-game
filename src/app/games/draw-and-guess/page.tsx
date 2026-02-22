"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Difficulty } from "@/games/draw-and-guess/models/game";

export default function DrawAndGuessLobby() {
    const router = useRouter();
    const [playerName, setPlayerName] = useState("");
    const [roomIdInput, setRoomIdInput] = useState("");
    const [difficulty, setDifficulty] = useState<Difficulty>("中等");
    const [maxRounds, setMaxRounds] = useState(5);
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        document.body.className = "theme-hub";
    }, []);

    const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

    const handleCreate = async () => {
        if (!playerName.trim()) { setError("请先输入你的昵称"); return; }
        setIsCreating(true);
        setError("");
        const roomId = generateRoomId();
        try {
            const { error: dbError } = await supabase.from("draw_rooms").insert({
                id: roomId,
                status: "waiting",
                players: [playerName.trim()],
                painter: null,
                word: null,
                word_hint: null,
                word_category: null,
                difficulty,
                round: 0,
                max_rounds: maxRounds,
                round_start_at: null,
                round_duration_seconds: 90,
                scores: {},
                strokes: [],
                round_results: [],
            });
            if (dbError) throw dbError;
            localStorage.setItem("dag_player_name", playerName.trim());
            router.push(`/games/draw-and-guess/room/${roomId}`);
        } catch (e) {
            console.error(e);
            setError("创建房间失败，请重试。");
            setIsCreating(false);
        }
    };

    const handleJoin = async () => {
        if (!playerName.trim()) { setError("请先输入你的昵称"); return; }
        if (!roomIdInput.trim()) { setError("请输入房间号"); return; }
        setIsJoining(true);
        setError("");
        const rid = roomIdInput.trim().toUpperCase();
        try {
            const { data, error: dbError } = await supabase
                .from("draw_rooms").select("id, status, players").eq("id", rid).single();
            if (dbError || !data) { setError("房间不存在，请检查房间号"); setIsJoining(false); return; }
            if (data.status === "game_end") { setError("该房间的游戏已结束"); setIsJoining(false); return; }
            const players: string[] = data.players || [];
            if (players.includes(playerName.trim())) {
                // re-join
            } else if (players.length >= 8) {
                setError("房间已满（最多8人）"); setIsJoining(false); return;
            } else {
                await supabase.from("draw_rooms").update({ players: [...players, playerName.trim()] }).eq("id", rid);
            }
            localStorage.setItem("dag_player_name", playerName.trim());
            router.push(`/games/draw-and-guess/room/${rid}`);
        } catch (e) {
            console.error(e);
            setError("加入房间失败，请重试。");
            setIsJoining(false);
        }
    };

    const difficultyMap: { value: Difficulty; label: string; desc: string; color: string }[] = [
        { value: "简单", label: "🟢 简单", desc: "常见物品，适合新手", color: "#27ae60" },
        { value: "中等", label: "🟡 中等", desc: "需要一点想象力", color: "#f39c12" },
        { value: "困难", label: "🔴 困难", desc: "抽象概念，挑战脑洞", color: "#e74c3c" },
    ];

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-void)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
                <div style={{ fontSize: "56px", marginBottom: "16px" }}>🎨</div>
                <h1 style={{ fontSize: "36px", fontWeight: 300, color: "var(--text-primary)", letterSpacing: "3px", fontFamily: "var(--font-serif)", marginBottom: "8px" }}>
                    你画我猜
                </h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", letterSpacing: "4px", fontFamily: "var(--font-mono)" }}>
                    DRAW & GUESS · AI WORD MASTER
                </p>
            </div>

            {/* Card */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "24px", padding: "40px", width: "100%", maxWidth: "480px", boxShadow: "0 20px 60px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Nickname */}
                <div>
                    <label style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "2px", display: "block", marginBottom: "8px" }}>
                        YOUR NAME
                    </label>
                    <input
                        id="dag-nickname"
                        type="text"
                        placeholder="输入你的昵称"
                        value={playerName}
                        onChange={e => setPlayerName(e.target.value)}
                        maxLength={12}
                        style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "14px 16px", color: "var(--text-primary)", fontSize: "16px", outline: "none", fontFamily: "var(--font-serif)", boxSizing: "border-box" }}
                    />
                </div>

                {/* Divider */}
                <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

                {/* Create Room Section */}
                <div>
                    <p style={{ fontSize: "13px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "2px", marginBottom: "16px" }}>CREATE ROOM</p>

                    {/* Difficulty */}
                    <div style={{ marginBottom: "16px" }}>
                        <label style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px", display: "block" }}>AI 出词难度</label>
                        <div style={{ display: "flex", gap: "8px" }}>
                            {difficultyMap.map(d => (
                                <button
                                    key={d.value}
                                    id={`dag-diff-${d.value}`}
                                    onClick={() => setDifficulty(d.value)}
                                    style={{
                                        flex: 1, padding: "10px 8px", borderRadius: "10px", border: difficulty === d.value ? `2px solid ${d.color}` : "2px solid var(--border-subtle)",
                                        background: difficulty === d.value ? `${d.color}18` : "var(--bg-surface)",
                                        color: difficulty === d.value ? d.color : "var(--text-secondary)",
                                        cursor: "pointer", fontSize: "13px", fontWeight: 600, transition: "all 0.2s"
                                    }}
                                    title={d.desc}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rounds */}
                    <div style={{ marginBottom: "16px" }}>
                        <label style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px", display: "block" }}>游戏轮数：{maxRounds} 轮</label>
                        <input
                            id="dag-rounds"
                            type="range" min={3} max={10} value={maxRounds}
                            onChange={e => setMaxRounds(Number(e.target.value))}
                            style={{ width: "100%", accentColor: "var(--accent-primary)" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            <span>3轮</span><span>10轮</span>
                        </div>
                    </div>

                    <button
                        id="dag-create"
                        onClick={handleCreate}
                        disabled={isCreating}
                        style={{ width: "100%", padding: "14px", background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: isCreating ? "wait" : "pointer", opacity: isCreating ? 0.7 : 1, transition: "opacity 0.2s" }}
                    >
                        {isCreating ? "创建中..." : "🎨 创建新房间"}
                    </button>
                </div>

                {/* Divider */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ flex: 1, borderTop: "1px solid var(--border-subtle)" }} />
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>OR</span>
                    <div style={{ flex: 1, borderTop: "1px solid var(--border-subtle)" }} />
                </div>

                {/* Join Room Section */}
                <div style={{ display: "flex", gap: "8px" }}>
                    <input
                        id="dag-room-id"
                        type="text"
                        placeholder="输入房间号"
                        value={roomIdInput}
                        onChange={e => setRoomIdInput(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === "Enter" && handleJoin()}
                        maxLength={6}
                        style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "14px 16px", color: "var(--text-primary)", fontSize: "16px", outline: "none", letterSpacing: "4px", fontFamily: "var(--font-mono)" }}
                    />
                    <button
                        id="dag-join"
                        onClick={handleJoin}
                        disabled={isJoining}
                        style={{ padding: "14px 20px", background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: isJoining ? "wait" : "pointer", whiteSpace: "nowrap" }}
                    >
                        {isJoining ? "加入中..." : "加入 →"}
                    </button>
                </div>

                {error && (
                    <p style={{ color: "#e74c3c", fontSize: "13px", textAlign: "center", margin: 0 }}>{error}</p>
                )}
            </div>

            <button onClick={() => router.push("/")} style={{ marginTop: "24px", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "13px", fontFamily: "var(--font-mono)" }}>
                ← 返回游戏大厅
            </button>
        </div>
    );
}

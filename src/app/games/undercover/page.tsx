"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { KEYWORD_PAIRS } from "@/games/undercover/constants/keywords";

export default function UndercoverLobby() {
    const router = useRouter();
    const [joinRoomCode, setJoinRoomCode] = useState("");
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);

    // UI State for Dual Mode
    const [gameMode, setGameMode] = useState<"text" | "party">("text");
    const [totalPlayers, setTotalPlayers] = useState(4);
    const [undercoverCount, setUndercoverCount] = useState(1);
    const [mrWhiteCount, setMrWhiteCount] = useState(0);

    // Use Suspense theme styling generally
    useEffect(() => {
        document.body.className = "theme-suspense";
        return () => {
            document.body.className = "theme-hub";
        };
    }, []);

    const handleCreateRoom = useCallback(async () => {
        setIsCreatingRoom(true);
        try {
            // Generate 4-digit room code
            const roomId = String(Math.floor(1000 + Math.random() * 9000));

            // Randomly select an initial keyword pair
            const randomPair = KEYWORD_PAIRS[Math.floor(Math.random() * KEYWORD_PAIRS.length)];

            // Initial session state
            const initialSession = {
                roomId,
                gameMode, // "text" or "party"
                phase: "waiting",
                roundCount: 1,
                players: [],
                currentSpeakerIndex: 0,
                civilianWord: randomPair.wordA,
                undercoverWord: randomPair.wordB,
                undercoverCount,
                mrWhiteCount
            };

            const { error } = await supabase.from("undercover_rooms").insert({
                id: roomId,
                session_data: initialSession,
                status: "waiting",
            });

            if (error) throw error;
            router.push(`/games/undercover/room/${roomId}`);
        } catch (err) {
            alert("创建房间失败，如果一直失败，请检查数据库表是否已配置。" + ((err as { message?: string })?.message ?? JSON.stringify(err)));
        } finally {
            setIsCreatingRoom(false);
        }
    }, [router, gameMode, undercoverCount, mrWhiteCount]);

    const handleJoinRoom = useCallback(() => {
        const code = joinRoomCode.trim();
        if (!code) return;
        router.push(`/games/undercover/room/${code}`);
    }, [joinRoomCode, router]);

    return (
        <>
            <div className="particles-container">
                {Array.from({ length: 15 }).map((_, i) => (
                    <div key={`p-${i}`} className="particle-dark" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 10}s` }} />
                ))}
            </div>

            <div className="app-layout">
                <header className="header" style={{ zIndex: 10 }}>
                    <span className="header-icon">🕵️</span>
                    <h1 className="header-title">谁是卧底</h1>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
                        <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: "13px", transition: "color 0.3s", whiteSpace: "nowrap" }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}>
                            ⬡ 游戏大厅
                        </Link>
                    </div>
                </header>

                <main className="main-content" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "60vh", padding: "20px", zIndex: 10 }}>
                    <h2 style={{ fontSize: "36px", marginBottom: "8px", fontWeight: "bold", textAlign: "center", background: "linear-gradient(90deg, #fff, #999)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        选择游玩模式
                    </h2>
                    <p style={{ fontSize: "15px", marginBottom: "40px", color: "var(--text-muted)", textAlign: "center" }}>
                        线上语音聊天，还是线下聚会开黑？
                    </p>

                    {/* Mode Selection Tabs */}
                    <div style={{ display: "flex", gap: "10px", marginBottom: "30px", background: "rgba(0,0,0,0.5)", padding: "6px", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
                        <button
                            onClick={() => setGameMode("text")}
                            style={{
                                padding: "12px 24px",
                                borderRadius: "8px",
                                background: gameMode === "text" ? "var(--bg-card)" : "transparent",
                                color: gameMode === "text" ? "var(--text-primary)" : "var(--text-muted)",
                                border: gameMode === "text" ? "1px solid var(--border-accent)" : "1px solid transparent",
                                fontSize: "16px", fontWeight: "bold", cursor: "pointer", transition: "all 0.3s"
                            }}>
                            🌐 在线文字版
                        </button>
                        <button
                            onClick={() => setGameMode("party")}
                            style={{
                                padding: "12px 24px",
                                borderRadius: "8px",
                                background: gameMode === "party" ? "var(--bg-card)" : "transparent",
                                color: gameMode === "party" ? "var(--text-primary)" : "var(--text-muted)",
                                border: gameMode === "party" ? "1px solid var(--border-accent)" : "1px solid transparent",
                                fontSize: "16px", fontWeight: "bold", cursor: "pointer", transition: "all 0.3s"
                            }}>
                            🍻 线下聚会版
                        </button>
                    </div>

                    <div style={{ width: "100%", maxWidth: "420px", background: "var(--bg-surface)", padding: "30px", borderRadius: "16px", border: "1px solid var(--border-subtle)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>

                        {/* Configuration specific to modes */}
                        {gameMode === "text" ? (
                            <div style={{ marginBottom: "24px", textAlign: "center" }}>
                                <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.6" }}>
                                    创建在线房间后，将房间号分享给好友。<br />
                                    AI 法官将为您分配词汇、主持大局并判定胜负！
                                </p>
                            </div>
                        ) : (
                            <div style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                                <p style={{ color: "var(--accent-primary)", fontSize: "13px", textAlign: "center", marginBottom: "10px" }}>
                                    *此模式下，手机仅用作发牌与投票闭眼工具！
                                </p>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "15px", color: "var(--text-primary)" }}>总人数预期</span>
                                    <input type="number" min={3} max={12} value={totalPlayers} onChange={(e) => setTotalPlayers(Number(e.target.value))} style={{ width: "60px", padding: "6px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "white", borderRadius: "4px", textAlign: "center" }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "15px", color: "var(--text-primary)" }}>卧底人数</span>
                                    <input type="number" min={1} max={Math.floor(totalPlayers / 2)} value={undercoverCount} onChange={(e) => setUndercoverCount(Number(e.target.value))} style={{ width: "60px", padding: "6px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "white", borderRadius: "4px", textAlign: "center" }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "15px", color: "var(--text-primary)" }}>白板人数</span>
                                    <input type="number" min={0} max={Math.floor(totalPlayers / 3)} value={mrWhiteCount} onChange={(e) => setMrWhiteCount(Number(e.target.value))} style={{ width: "60px", padding: "6px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "white", borderRadius: "4px", textAlign: "center" }} />
                                </div>
                            </div>
                        )}

                        <button
                            className="victory-btn"
                            onClick={handleCreateRoom}
                            disabled={isCreatingRoom}
                            style={{ width: "100%", padding: "16px", fontSize: "18px", marginTop: "10px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
                        >
                            {isCreatingRoom ? "房间创建中..." : "⚔️ 创建新房间"}
                        </button>

                        <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "20px 0" }}>
                            <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }}></div>
                            <span style={{ color: "var(--text-muted)", fontSize: "14px", fontFamily: "var(--font-mono)" }}>OR</span>
                            <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }}></div>
                        </div>

                        <div style={{ display: "flex", gap: "12px" }}>
                            <input
                                type="text"
                                placeholder="输入房间号即可加入"
                                value={joinRoomCode}
                                onChange={(e) => setJoinRoomCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                                maxLength={4}
                                style={{ flex: 1, background: "var(--bg-card)", border: "1px solid var(--border-accent)", borderRadius: "var(--radius-md)", padding: "14px 16px", color: "var(--text-primary)", fontSize: "16px", fontFamily: "var(--font-mono)", outline: "none", textAlign: "center", transition: "all 0.3s" }}
                            />
                            <button
                                className="back-btn"
                                onClick={handleJoinRoom}
                                disabled={joinRoomCode.length !== 4}
                                style={{ padding: "0 24px" }}
                            >
                                加入 →
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}

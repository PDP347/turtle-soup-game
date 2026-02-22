"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ArcadeLobby() {
    const router = useRouter();

    // Apply the newly updated light Zen Warm hub theme
    useEffect(() => {
        document.body.className = "theme-hub";
    }, []);

    return (
        <div className="app-layout" style={{ background: "var(--bg-void)", minHeight: "100vh" }}>
            <div className="hero-section" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px" }}>

                {/* Minimalist Header */}
                <div className="hero-content" style={{ textAlign: "center", marginBottom: "80px" }}>
                    <h1 style={{
                        fontSize: "48px",
                        fontWeight: 300,
                        letterSpacing: "4px",
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-serif)",
                        marginBottom: "12px"
                    }}>
                        P 的游戏厅
                    </h1>
                    <p style={{
                        fontSize: "14px",
                        letterSpacing: "6px",
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        fontFamily: "var(--font-mono)"
                    }}>
                        P's Arcade · Minimalist Entertainment
                    </p>
                </div>

                {/* Game Selection Cards - Zen Style */}
                <div className="hero-carousel" style={{ display: "flex", gap: "32px", flexWrap: "wrap", justifyContent: "center", maxWidth: "900px", width: "100%" }}>

                    {/* Game 1: Turtle Soup */}
                    <Link href="/games/turtle-soup" style={{ textDecoration: "none", flex: "1", minWidth: "280px" }}>
                        <div style={{
                            background: "var(--bg-card)",
                            borderRadius: "24px",
                            padding: "40px",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                            border: "1px solid var(--border-subtle)",
                            transition: "all 0.3s ease",
                            cursor: "pointer"
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-4px)";
                                e.currentTarget.style.boxShadow = "0 16px 50px rgba(0,0,0,0.06)";
                                e.currentTarget.style.borderColor = "var(--accent-primary)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 10px 40px rgba(0,0,0,0.03)";
                                e.currentTarget.style.borderColor = "var(--border-subtle)";
                            }}
                        >
                            <div>
                                <div style={{ fontSize: "32px", marginBottom: "20px" }}>🐢</div>
                                <h3 style={{ fontSize: "24px", color: "var(--text-primary)", marginBottom: "12px", fontWeight: 600 }}>海龟汤</h3>
                                <p style={{ color: "var(--text-secondary)", fontSize: "15px", lineHeight: 1.6, opacity: 0.8 }}>
                                    与全知全能的深海主宰对话，拼凑出残酷的真相。
                                </p>
                            </div>
                            <div style={{ color: "var(--accent-primary)", marginTop: "24px", fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span>ENTER ROOM</span> <span style={{ fontSize: "16px" }}>→</span>
                            </div>
                        </div>
                    </Link>

                    {/* Game 2: Undercover */}
                    <Link href="/games/undercover" style={{ textDecoration: "none", flex: "1", minWidth: "280px" }}>
                        <div style={{
                            background: "var(--bg-card)",
                            borderRadius: "24px",
                            padding: "40px",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                            border: "1px solid var(--border-subtle)",
                            transition: "all 0.3s ease",
                            cursor: "pointer"
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-4px)";
                                e.currentTarget.style.boxShadow = "0 16px 50px rgba(0,0,0,0.06)";
                                e.currentTarget.style.borderColor = "var(--accent-secondary)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 10px 40px rgba(0,0,0,0.03)";
                                e.currentTarget.style.borderColor = "var(--border-subtle)";
                            }}
                        >
                            <div>
                                <div style={{ fontSize: "32px", marginBottom: "20px", filter: "hue-rotate(-20deg)" }}>🕵️</div>
                                <h3 style={{ fontSize: "24px", color: "var(--text-primary)", marginBottom: "12px", fontWeight: 600 }}>谁是卧底</h3>
                                <p style={{ color: "var(--text-secondary)", fontSize: "15px", lineHeight: 1.6, opacity: 0.8 }}>
                                    AI 秘密法官已就位。互相猜忌的局，即将在迷雾中开启。
                                </p>
                            </div>
                            <div style={{ color: "var(--accent-secondary)", marginTop: "24px", fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span>ENTER LOBBY</span> <span style={{ fontSize: "16px" }}>→</span>
                            </div>
                        </div>
                    </Link>

                    {/* Game 3: Draw and Guess */}
                    <Link href="/games/draw-and-guess" style={{ textDecoration: "none", flex: "1", minWidth: "280px" }}>
                        <div style={{
                            background: "var(--bg-card)",
                            borderRadius: "24px",
                            padding: "40px",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                            border: "1px solid var(--border-subtle)",
                            transition: "all 0.3s ease",
                            cursor: "pointer"
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-4px)";
                                e.currentTarget.style.boxShadow = "0 16px 50px rgba(0,0,0,0.06)";
                                e.currentTarget.style.borderColor = "#9b59b6";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 10px 40px rgba(0,0,0,0.03)";
                                e.currentTarget.style.borderColor = "var(--border-subtle)";
                            }}
                        >
                            <div>
                                <div style={{ fontSize: "32px", marginBottom: "20px" }}>🎨</div>
                                <h3 style={{ fontSize: "24px", color: "var(--text-primary)", marginBottom: "12px", fontWeight: 600 }}>你画我猜</h3>
                                <p style={{ color: "var(--text-secondary)", fontSize: "15px", lineHeight: 1.6, opacity: 0.8 }}>
                                    AI 出题，你来画、我来猜。实时联机，笔触间的默契游戏。
                                </p>
                            </div>
                            <div style={{ color: "#9b59b6", marginTop: "24px", fontSize: "13px", fontFamily: "var(--font-mono)", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span>START DRAWING</span> <span style={{ fontSize: "16px" }}>→</span>
                            </div>
                        </div>
                    </Link>

                </div>

                {/* Footer Footer */}
                <div style={{
                    position: "absolute",
                    bottom: "40px",
                    color: "var(--text-muted)",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "2px"
                }}>
                    POWERED BY DEEPSEEK V3 & SUPABASE
                </div>

            </div>
        </div>
    );
}

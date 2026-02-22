"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MistArcadeLobby() {
    const router = useRouter();

    // Keep the theme as generic hub
    useEffect(() => {
        document.body.className = "theme-hub";
    }, []);

    return (
        <>
            <div className="particles-container">
                {Array.from({ length: 30 }).map((_, i) => (
                    <div
                        key={`hub-${i}`}
                        className="particle-dark"
                        style={{
                            left: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 20}s`,
                            opacity: 0.2,
                            filter: "blur(2px)"
                        }}
                    />
                ))}
            </div>

            <div className="app-layout">
                <div className="hero-section" style={{ minHeight: "100vh", padding: "40px" }}>
                    <div className="hero-overlay" />
                    <div className="hero-content" style={{ marginTop: "-10vh" }}>
                        <h1 className="hero-title" style={{ fontSize: "56px", letterSpacing: "8px", background: "linear-gradient(135deg, #fff 0%, #718096 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            迷雾游戏厅
                        </h1>
                        <p className="hero-subtitle" style={{ fontSize: "18px", letterSpacing: "4px", marginBottom: "60px", color: "var(--text-secondary)" }}>
                            MIST ARCADE · AI ENTERTAINMENT
                        </p>

                        <div className="hero-carousel" style={{ display: "flex", gap: "40px", flexWrap: "wrap", justifyContent: "center", maxWidth: "1000px" }}>

                            {/* Game 1: Turtle Soup */}
                            <Link href="/games/turtle-soup" style={{ textDecoration: "none" }}>
                                <div className="hero-card" style={{ width: "320px", height: "480px", border: "1px solid var(--border-subtle)", borderRadius: "16px", overflow: "hidden", position: "relative", cursor: "pointer", transition: "all var(--transition)", background: "rgba(10, 10, 15, 0.8)" }}>
                                    <div className="hero-card-bg" style={{ backgroundImage: "url('/images/themes/bizarre.png')", opacity: 0.4 }} />
                                    <div className="hero-card-overlay" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }} />
                                    <div className="hero-card-inner" style={{ position: "absolute", bottom: 0, padding: "30px", width: "100%" }}>
                                        <span className="hero-icon" style={{ fontSize: "40px", marginBottom: "16px", display: "block" }}>🐢</span>
                                        <h3 className="hero-name" style={{ fontSize: "28px", color: "#fff", marginBottom: "8px" }}>海龟汤</h3>
                                        <p className="hero-desc" style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6 }}>
                                            与全知全能的深海主宰对话，拼凑出残酷的真相。<br />
                                            <span style={{ color: "var(--accent-primary)", marginTop: "8px", display: "inline-block", fontSize: "12px", fontFamily: "var(--font-mono)" }}>▶ ENTER ROOM</span>
                                        </p>
                                    </div>
                                </div>
                            </Link>

                            {/* Game 2: Who is Undercover */}
                            <Link href="/games/undercover" style={{ textDecoration: "none" }}>
                                <div
                                    className="hero-card"
                                    style={{
                                        width: "320px", height: "480px", border: "1px solid var(--border-subtle)", borderRadius: "16px", overflow: "hidden", position: "relative", cursor: "pointer", transition: "all var(--transition)", background: "rgba(10, 10, 15, 0.8)"
                                    }}
                                >
                                    <div className="hero-card-bg" style={{ backgroundImage: "url('/images/themes/suspense.png')", opacity: 0.4 }} />
                                    <div className="hero-card-overlay" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }} />
                                    <div className="hero-card-inner" style={{ position: "absolute", bottom: 0, padding: "30px", width: "100%" }}>
                                        <span className="hero-icon" style={{ fontSize: "40px", marginBottom: "16px", display: "block" }}>🕵️</span>
                                        <h3 className="hero-name" style={{ fontSize: "28px", color: "#fff", marginBottom: "8px" }}>谁是卧底</h3>
                                        <p className="hero-desc" style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6 }}>
                                            AI 秘密法官已就位。互相猜忌的局，即将在迷雾中开启。<br />
                                            <span style={{ color: "var(--accent-primary)", marginTop: "8px", display: "inline-block", fontSize: "12px", fontFamily: "var(--font-mono)" }}>▶ ENTER LOBBY</span>
                                        </p>
                                    </div>
                                </div>
                            </Link>

                        </div>

                        <div style={{ marginTop: "60px", color: "var(--text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)", letterSpacing: "2px" }}>
                            POWERED BY DEEPSEEK V3 & SUPABASE
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

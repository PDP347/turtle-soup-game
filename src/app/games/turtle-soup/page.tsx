"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Puzzle, PuzzleTheme, PuzzleDifficulty } from "@/games/turtle-soup/models/puzzles";
import { THEME_META } from "@/games/turtle-soup/models/puzzles";
// Keep this hardcoded for fallback, but we mainly rely on local memory + API now
import { supabase } from "@/lib/supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function HomePage() {
  const router = useRouter();
  const [globalTheme, setGlobalTheme] = useState<PuzzleTheme | "hub">("hub");
  const [activeThemeFilter, setActiveThemeFilter] = useState<PuzzleTheme | "all">("all");
  const newPuzzleRef = useRef<HTMLDivElement | null>(null);
  const [allPuzzles, setAllPuzzles] = useState<Puzzle[]>([]); // Initialize as empty, will load from API/local storage
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const [selectedPuzzle, setSelectedPuzzle] = useState<Puzzle | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [displayedSurface, setDisplayedSurface] = useState("");
  const [showVictory, setShowVictory] = useState(false);
  const [victoryText, setVictoryText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Search API State
  const [isSearching, setIsSearching] = useState(false);
  const [searchTheme, setSearchTheme] = useState<PuzzleTheme>("bizarre");
  const [searchDiff, setSearchDiff] = useState<PuzzleDifficulty>("困难");

  // Leaderboard State
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<Array<{ name: string, wins: number, questions: number, themes: string[] }>>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Sync theme
  useEffect(() => {
    document.body.className = `theme-${globalTheme}`;
  }, [globalTheme]);

  // Load generated puzzles
  useEffect(() => {
    const loadPuzzles = async () => {
      try {
        const res = await fetch("/api/games/turtle-soup/puzzles");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load puzzles");
        setAllPuzzles(data.puzzles);
      } catch (err) {
        console.error("Failed to load puzzles:", err);
        // Fallback to an empty array or handle error gracefully
        setAllPuzzles([]);
      }
    };
    loadPuzzles();
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (!selectedPuzzle) return;
    setDisplayedSurface("");
    const text = selectedPuzzle.surface;
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < text.length) {
        setDisplayedSurface(text.slice(0, idx + 1));
        idx++;
      } else {
        clearInterval(interval);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [selectedPuzzle]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSelect = useCallback((puzzle: Puzzle) => {
    setSelectedPuzzle(puzzle);
    setGlobalTheme(puzzle.theme);
    setMessages([]);
    setShowVictory(false);
    setVictoryText("");
    setInput("");
  }, []);

  const handleBack = useCallback(() => {
    setSelectedPuzzle(null);
    setGlobalTheme(activeThemeFilter === "all" ? "hub" : activeThemeFilter);
    setMessages([]);
    setShowVictory(false);
    setVictoryText("");
  }, [activeThemeFilter]);

  const handleCreateRoom = useCallback(async (puzzle: Puzzle) => {
    setIsCreatingRoom(true);
    try {
      // Generate 4-digit room code
      const roomId = String(Math.floor(1000 + Math.random() * 9000));
      const { error } = await supabase.from("rooms").insert({
        id: roomId,
        puzzle_data: puzzle,
        status: "waiting",
      });
      if (error) throw error;
      router.push(`/room/${roomId}`);
    } catch (err) {
      alert("创建房间失败：" + ((err as { message?: string })?.message ?? JSON.stringify(err)));
    } finally {
      setIsCreatingRoom(false);
    }
  }, [router]);

  const handleJoinRoom = useCallback(() => {
    const code = joinRoomCode.trim();
    if (!code) return;
    router.push(`/room/${code}`);
  }, [joinRoomCode, router]);

  const handleSearchOnline = async () => {
    if (isSearching) return;
    setIsSearching(true);
    setGlobalTheme(searchTheme);
    try {
      const res = await fetch("/api/games/turtle-soup/puzzle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: searchTheme, difficulty: searchDiff }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      // Add the new puzzle to the list and update state
      setAllPuzzles(prevPuzzles => {
        const updatedPuzzles = [...prevPuzzles, data.puzzle];
        // Store in local storage or a more persistent client-side store if needed
        return updatedPuzzles;
      });
      // Show the new puzzle in list; reset filter so it's visible
      setActiveThemeFilter(data.puzzle.theme);
      setGlobalTheme(data.puzzle.theme);
      // Scroll to new card after render
      setTimeout(() => newPuzzleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    } catch (err) {
      alert("联网搜索失败：" + String(err));
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenLeaderboard = async () => {
    setShowLeaderboard(true);
    setIsLoadingStats(true);
    try {
      const { data } = await supabase.from("player_stats").select("*");
      if (data) {
        const agg: Record<string, { wins: number, questions: number, themes: Set<string> }> = {};
        for (const row of data) {
          if (!agg[row.user_id]) agg[row.user_id] = { wins: 0, questions: 0, themes: new Set() };
          agg[row.user_id].wins += row.matches_won;
          agg[row.user_id].questions += row.total_questions;
          agg[row.user_id].themes.add(row.theme);
        }

        const sorted = Object.entries(agg)
          .map(([name, stats]) => ({ name, ...stats, themes: Array.from(stats.themes) }))
          .sort((a, b) => b.wins - a.wins || a.questions - b.questions)
          .slice(0, 50);

        setLeaderboardData(sorted);
      }
    } catch (e) {
      console.error("Leaderboard fetch failed", e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Bug fix: send full puzzle object so AI-generated puzzles (not in server memory) also work
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !selectedPuzzle) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/games/turtle-soup/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          puzzle: selectedPuzzle, // Send full puzzle object, not just ID
        }),
      });

      if (!response.ok || !response.body) throw new Error("API error");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";

      // Add placeholder assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      setIsLoading(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        aiContent += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: aiContent };
          return updated;
        });
      }

      // Check for victory
      if (aiContent.includes("【真相大白】")) {
        setVictoryText(aiContent.replace("【真相大白】", "").trim());
        setTimeout(() => setShowVictory(true), 800);
      }
    } catch {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "……（通灵失败，请稍后再试）" },
      ]);
    }
  }, [input, isLoading, messages, selectedPuzzle]);

  // New: allow the player to give up and directly reveal the truth
  const handleGiveUp = useCallback(() => {
    setVictoryText(selectedPuzzle?.truth || "");
    setShowVictory(true);
  }, [selectedPuzzle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const filteredPuzzles = allPuzzles.filter((p) => activeThemeFilter === "all" || p.theme === activeThemeFilter);

  return (
    <>
      <div className="particles-container">
        {globalTheme === "bizarre" && (
          Array.from({ length: 15 }).map((_, i) => (
            <div key={`d-${i}`} className="particle-dark" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 10}s` }} />
          ))
        )}
        {globalTheme === "healing" && (
          Array.from({ length: 20 }).map((_, i) => (
            <div key={`g-${i}`} className="particle-gold" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 12}s`, width: `${Math.random() * 8 + 4}px`, height: `${Math.random() * 8 + 4}px` }} />
          ))
        )}
      </div>

      {showLeaderboard && (
        <div className="victory-overlay" onClick={() => setShowLeaderboard(false)}>
          <div className="victory-modal" style={{ maxWidth: 500, width: "90%", padding: "40px 30px" }} onClick={(e) => e.stopPropagation()}>
            <h2 className="victory-title" style={{ color: "var(--accent-primary)", marginBottom: 24, fontSize: 26, letterSpacing: 2 }}>🏆 顶尖侦探档案</h2>
            {isLoadingStats ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>查阅绝密档案中...</div>
            ) : leaderboardData.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>虚位以待。去揭开真相吧！</div>
            ) : (
              <div className="custom-scroll" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, maxHeight: "50vh", overflowY: "auto", paddingRight: 8 }}>
                {leaderboardData.map((player, idx) => (
                  <div key={player.name} style={{ display: "flex", alignItems: "center", background: "var(--bg-card)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: 24, fontWeight: "bold", width: 44, color: idx === 0 ? "#f1c40f" : idx === 1 ? "#bdc3c7" : idx === 2 ? "#d35400" : "var(--text-muted)" }}>#{idx + 1}</div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        专精: {player.themes.map(t => THEME_META[t as PuzzleTheme]?.label || t).join(" / ")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{player.wins} <span style={{ fontSize: 12, fontWeight: "normal" }}>次破案</span></div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>共计 {player.questions} 问</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="back-btn" style={{ width: "100%", justifyContent: "center", background: "rgba(255,255,255,0.05)", padding: "12px" }} onClick={() => setShowLeaderboard(false)}>
              合上档案册
            </button>
          </div>
        </div>
      )}

      <div className="app-layout">
        {!selectedPuzzle ? (
          <>
            {globalTheme === "hub" ? (
              <div className="hero-section">
                <div className="hero-overlay" />
                <div className="hero-content">
                  <div style={{ position: "absolute", top: 40, left: 40, zIndex: 100 }}>
                    <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: "14px", transition: "color 0.3s" }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}>
                      ← 返回游戏大厅
                    </Link>
                  </div>
                  <h1 className="hero-title">海龟汤档案馆</h1>
                  <p className="hero-subtitle">尘封的真相，等待着被翻阅...</p>

                  <button
                    onClick={handleOpenLeaderboard}
                    style={{ background: "rgba(0,0,0,0.5)", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)", padding: "10px 28px", borderRadius: 30, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, marginTop: "16px", marginBottom: "40px", transition: "all 0.3s", textTransform: "uppercase", letterSpacing: 2 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-primary)"; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = "0 0 20px var(--accent-primary-glow)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.5)"; e.currentTarget.style.color = "var(--accent-primary)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    🏆 顶尖侦探档案
                  </button>

                  <div className="hero-carousel">
                    {(Object.entries(THEME_META) as [PuzzleTheme, typeof THEME_META[PuzzleTheme]][]).map(([key, meta]) => {
                      const imgName = { bizarre: 'bizarre', healing: 'healing', suspense: 'suspense', urbanLegend: 'urban', darkHumor: 'dark_humor' }[key];
                      return (
                        <div
                          key={key}
                          className={`hero-card js-theme-${key}`}
                          onClick={() => { setActiveThemeFilter(key); setGlobalTheme(key); }}
                        >
                          <div className="hero-card-bg" style={{ backgroundImage: `url('/images/themes/${imgName}.png')` }} />
                          <div className="hero-card-overlay" />
                          <div className="hero-card-inner">
                            <span className="hero-icon">{meta.icon}</span>
                            <h3 className="hero-name">{meta.label}</h3>
                            <p className="hero-desc">{meta.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* New: Join Room Entry on Landing Page */}
                  <div style={{ marginTop: "60px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                    <div style={{ color: "var(--text-muted)", fontSize: "14px", letterSpacing: "2px", textTransform: "uppercase" }}>— 或者加入已有房间 —</div>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <input
                        type="text"
                        placeholder="4位房间号"
                        value={joinRoomCode}
                        onChange={(e) => setJoinRoomCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                        maxLength={4}
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "12px 20px", color: "var(--text-primary)", fontSize: "16px", width: "140px", textAlign: "center", outline: "none", transition: "border-color 0.3s" }}
                        onFocus={(e) => e.target.style.borderColor = "var(--accent-primary)"}
                        onBlur={(e) => e.target.style.borderColor = "var(--border-subtle)"}
                      />
                      <button
                        onClick={handleJoinRoom}
                        disabled={joinRoomCode.length !== 4}
                        style={{ background: joinRoomCode.length === 4 ? "var(--accent-primary)" : "rgba(255,255,255,0.1)", color: joinRoomCode.length === 4 ? "#000" : "var(--text-muted)", border: "none", borderRadius: "8px", padding: "0 30px", fontSize: "14px", fontWeight: "bold", cursor: joinRoomCode.length === 4 ? "pointer" : "not-allowed", transition: "all 0.3s" }}
                      >
                        加入房间
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <header className="header">
                <span className="header-icon">{globalTheme === "healing" ? "🕊️" : "🐢"}</span>
                <h1 className="header-title">海龟汤：真相推理</h1>
                {/* Join room section */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
                  <input
                    type="text"
                    placeholder="输入房间号"
                    value={joinRoomCode}
                    onChange={(e) => setJoinRoomCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                    maxLength={4}
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "8px 14px", color: "var(--text-primary)", fontSize: 14, width: 110, fontFamily: "var(--font-mono)", outline: "none", textAlign: "center" }}
                  />
                  <button
                    className="back-btn"
                    onClick={handleJoinRoom}
                    disabled={joinRoomCode.length !== 4}
                  >
                    加入房间 →
                  </button>
                  <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: "13px", transition: "color 0.3s", whiteSpace: "nowrap" }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}>
                    ⬡ 游戏大厅
                  </Link>
                </div>
                <span className="header-subtitle">SITUATION PUZZLE · AI HOSTED</span>
              </header>
            )}

            <main className="main-content puzzle-selection">
              {globalTheme !== "hub" && (
                <>
                  <h2 className={`selection-title ${globalTheme !== "healing" ? "glitch-text" : ""}`}>
                    {THEME_META[globalTheme as PuzzleTheme]?.label} 卷宗
                  </h2>
                  <p className="selection-subtitle">每一道题背后的真相，由你亲自揭开。</p>
                </>
              )}

              <div className="search-bar-container">
                <select className="search-select" value={searchTheme} onChange={(e) => setSearchTheme(e.target.value as PuzzleTheme)}>
                  {(Object.entries(THEME_META) as [PuzzleTheme, typeof THEME_META[PuzzleTheme]][]).map(([key, meta]) => (
                    <option key={key} value={key}>风格：{meta.label}</option>
                  ))}
                </select>
                <select className="search-select" value={searchDiff} onChange={(e) => setSearchDiff(e.target.value as PuzzleDifficulty)}>
                  <option value="简单">难度：简单</option>
                  <option value="中等">难度：中等</option>
                  <option value="困难">难度：困难</option>
                </select>
                <button
                  className="search-btn"
                  onClick={handleSearchOnline}
                  disabled={isSearching}
                >
                  {isSearching ? "通灵中..." : "🔎 联网搜索全原创题"}
                </button>
              </div>

              <div className="theme-switch-container">
                <button
                  className={`theme-btn ${activeThemeFilter === "all" ? "active" : ""}`}
                  onClick={() => { setActiveThemeFilter("all"); setGlobalTheme("hub"); }}
                >
                  🗂️ 全部
                </button>
                {(Object.entries(THEME_META) as [PuzzleTheme, typeof THEME_META[PuzzleTheme]][]).map(([key, meta]) => (
                  <button
                    key={key}
                    className={`theme-btn ${activeThemeFilter === key ? "active" : ""}`}
                    onClick={() => {
                      setActiveThemeFilter(key);
                      setGlobalTheme(key);
                    }}
                  >
                    {meta.icon} {meta.label}
                  </button>
                ))}
              </div>

              <div className="puzzle-grid">
                {filteredPuzzles.map((puzzle, i) => (
                  <div
                    key={puzzle.id}
                    ref={puzzle.isGenerated ? newPuzzleRef : null}
                    className={`puzzle-card${puzzle.isGenerated ? " puzzle-card--new" : ""}`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                    onClick={() => handleSelect(puzzle)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="card-header">
                      <h3 className={`card-title ${puzzle.theme !== "healing" ? "glitch-text" : ""}`}>
                        {puzzle.title}
                        {puzzle.isGenerated && <span style={{ fontSize: 12, marginLeft: 8, opacity: 0.8 }}>🔎 AI网搜</span>}
                      </h3>
                      <span className={`card-badge badge-${puzzle.difficulty}`}>
                        {puzzle.difficulty}
                      </span>
                    </div>
                    <p className="card-genre">#{puzzle.genre} | {THEME_META[puzzle.theme]?.icon} {THEME_META[puzzle.theme]?.label}</p>
                    <p className="card-surface">{puzzle.surface}</p>
                    <div style={{ flex: 1 }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button
                        style={{ flex: 1, background: "none", border: "1px solid var(--border-subtle)", color: "var(--text-muted)", padding: "10px 0", borderRadius: "var(--radius-md)", fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer", transition: "all var(--transition)" }}
                        onClick={(e) => { e.stopPropagation(); handleSelect(puzzle); }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      >
                        ▶ 单人模式
                      </button>
                      <button
                        style={{ flex: 1, background: "var(--accent-primary)", border: "none", color: "#fff", padding: "10px 0", borderRadius: "var(--radius-md)", fontFamily: "var(--font-mono)", fontSize: 12, cursor: isCreatingRoom ? "wait" : "pointer", boxShadow: "0 4px 12px var(--accent-primary-glow)", transition: "all var(--transition)" }}
                        onClick={(e) => { e.stopPropagation(); handleCreateRoom(puzzle); }}
                        disabled={isCreatingRoom}
                      >
                        {isCreatingRoom ? "创建中..." : "👥 联机房间"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </main>
          </>
        ) : (
          <>
            {showVictory && (
              <div className="victory-overlay" onClick={() => setShowVictory(false)}>
                <div className="victory-modal" onClick={(e) => e.stopPropagation()}>
                  {globalTheme === "healing" ? (
                    <div className="victory-icon">☀️</div>
                  ) : null}
                  <h2 className="victory-title">真相大白</h2>
                  <p className="victory-text">{victoryText || selectedPuzzle.truth}</p>
                  <button className="victory-btn" onClick={handleBack}>结束本局</button>
                </div>
              </div>
            )}

            <header className="header">
              <span className="header-icon">{globalTheme === "healing" ? "🕊️" : "🐢"}</span>
              <h1 className="header-title">{selectedPuzzle.title}</h1>
              <span className="header-subtitle">HOST: DEEPSEEK</span>
            </header>

            <main className="game-area">
              <div className="surface-panel">
                <div className="surface-meta">
                  <span className="surface-label">■ 汤面</span>
                  <div className="surface-divider" />
                  <span className={`card-badge badge-${selectedPuzzle.difficulty}`}>
                    {selectedPuzzle.difficulty}
                  </span>
                  <button className="back-btn" onClick={handleGiveUp} style={{ marginRight: 8 }}>💡 我放弃，揭晓答案</button>
                  <button className="back-btn" onClick={handleBack}>← 换题</button>
                </div>
                <p className="surface-text">
                  {displayedSurface}
                  {displayedSurface.length < selectedPuzzle.surface.length && (
                    <span className="typing-cursor" />
                  )}
                </p>
              </div>

              <div className="chat-container">
                <div className="messages-list">
                  {messages.length === 0 && (
                    <p className="empty-hint">
                      {globalTheme === "healing" ? "✨ 深呼吸，向主持人提出你的疑问..." : "🕯️ 向未知提问吧... 他只会回答：是 / 否 / 无关"}
                    </p>
                  )}
                  {messages.map((msg, i) => {
                    const isVictory = msg.role === "assistant" && msg.content.includes("【真相大白】");
                    return (
                      <div key={i} className={`message-row ${msg.role}`}>
                        <div className={`bubble ${msg.role}${isVictory ? " victory" : ""}`}>
                          {msg.content || (msg.role === "assistant" && i === messages.length - 1 ? (
                            <><span className="dot" /><span className="dot" /><span className="dot" /></>
                          ) : null)}
                        </div>
                      </div>
                    );
                  })}
                  {isLoading && (
                    <div className="message-row assistant">
                      <div className="bubble loading">
                        <span className="dot" /><span className="dot" /><span className="dot" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="input-area">
                  <div className="input-wrapper">
                    <textarea
                      ref={textareaRef}
                      className="input-field"
                      placeholder={globalTheme === "bizarre" ? "输入你的猜测（按 Enter 质问）" : "输入你想知道的线索（按 Enter 提问）..."}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      disabled={isLoading || showVictory}
                    />
                  </div>
                  <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={isLoading || !input.trim() || showVictory}
                  >
                    ↗
                  </button>
                </div>
              </div>
            </main>
          </>
        )}
      </div>
    </>
  );
}

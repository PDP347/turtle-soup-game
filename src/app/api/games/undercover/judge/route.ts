import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { UndercoverSession, UndercoverRole } from "@/games/undercover/models/types";
import { KEYWORD_PAIRS } from "@/games/undercover/constants/keywords";

interface StateMachineRequest {
    roomId: string;
    action: "start_game" | "player_speak" | "end_discussion" | "player_vote" | "submit_vote";
    sessionData: UndercoverSession;
    latestMessage?: string;
    votes?: Record<string, string>; // Only used for forced player_vote
    singleVote?: { voter: string; target: string }; // Used for submit_vote
}

export async function POST(req: Request) {
    try {
        const body: StateMachineRequest = await req.json();
        let { action, sessionData, votes } = body;

        if (action === "start_game") {
            let pair = KEYWORD_PAIRS[Math.floor(Math.random() * KEYWORD_PAIRS.length)];

            // Try to use AI if it's Party Mode
            if (sessionData.gameMode === "party") {
                try {
                    const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });
                    const res = await client.chat.completions.create({
                        model: "deepseek-chat",
                        messages: [{
                            role: "system",
                            content: "你是一个聚会游戏出题机。请直接返回一对用于《谁是卧底》游戏的词语（如：前任,现任 或 迪迦奥特曼,假面骑士），要求有强烈的反差感、恶搞或时事感，适合线下聚餐、朋友聚会之间玩。绝对只返回两个词，用逗号分隔，不要有任何其他多余的开场白或解释。"
                        }],
                        temperature: 1.0,
                        max_tokens: 20
                    });
                    const words = res.choices[0].message.content?.split(/[,，、]/).map(w => w.trim()).filter(Boolean);
                    if (words && words.length >= 2) {
                        pair = { wordA: words[0], wordB: words[1] };
                    }
                } catch (e) {
                    console.error("AI word generation failed, falling back to static:", e);
                }
            }

            const players = [...sessionData.players];

            let undercoverCount = sessionData.gameMode === "party" ? (sessionData.undercoverCount || 1) : 1;
            let mrWhiteCount = sessionData.gameMode === "party" ? (sessionData.mrWhiteCount || 0) : 0;

            // Clamp values
            if (undercoverCount + mrWhiteCount >= players.length) {
                undercoverCount = 1;
                mrWhiteCount = 0;
            }

            let rolePool: UndercoverRole[] = Array(players.length).fill("civilian");
            for (let i = 0; i < undercoverCount; i++) rolePool[i] = "undercover";
            for (let i = undercoverCount; i < undercoverCount + mrWhiteCount; i++) rolePool[i] = "mr_white";

            // Shuffle
            rolePool.sort(() => Math.random() - 0.5);

            players.forEach((p, idx) => {
                p.role = rolePool[idx];
                p.keyword = rolePool[idx] === "mr_white" ? "" : (rolePool[idx] === "undercover" ? pair.wordB : pair.wordA); // White gets empty
                p.isAlive = true;
                p.hasSpoken = false;
                p.voteCount = 0;
            });

            const firstSpeaker = Math.floor(Math.random() * players.length);

            const modifiedSession: UndercoverSession = {
                ...sessionData,
                phase: "speaking",
                roundCount: 1,
                currentSpeakerIndex: firstSpeaker,
                players,
                civilianWord: pair.wordA,
                undercoverWord: pair.wordB
            };

            const isParty = sessionData.gameMode === "party";
            const msg = isParty
                ? `🍹 聚会狂欢开始！裁判已下发专属词条（长按你的卡片查看）。\n👉 系统随机指派的第一位发言人是：【${players[firstSpeaker].username}】。然后按照你们说好的方向接着发言吧！`
                : `🎭 迷局已布好。系统已下发词汇（看一眼屏幕上方）。本局有卧底混在你们中间。${players[firstSpeaker].username}，开始你的第一轮发言。`;

            return NextResponse.json({
                systemMessage: msg,
                updatedSession: modifiedSession
            });

        } else if (action === "player_speak") {
            const players = [...sessionData.players];
            const currentIdx = sessionData.currentSpeakerIndex;

            players[currentIdx].hasSpoken = true;
            const allAliveSpoken = players.every(p => !p.isAlive || p.hasSpoken);

            if (allAliveSpoken) {
                if (sessionData.phase === "speaking_pk") {
                    return NextResponse.json({
                        systemMessage: "⚔️ PK 发言完毕！请大家立刻在 30 秒内对 PK 的这两位玩家重新投票决战！",
                        updatedSession: {
                            ...sessionData,
                            phase: "voting",
                            votingEndTime: Date.now() + 30000
                        }
                    });
                } else {
                    const isParty = sessionData.gameMode === "party";
                    return NextResponse.json({
                        systemMessage: isParty
                            ? "☕ 所有存活者发言完毕！如果有争议也可以自由讨论，讨论结束由房主点击进入投票。"
                            : "所有人发言完毕。进入 40 秒自由讨论环节！",
                        updatedSession: {
                            ...sessionData,
                            phase: "discussion",
                            players,
                            discussionEndTime: isParty ? undefined : Date.now() + 40000
                        }
                    });
                }
            } else {
                let nextSpeakerIdx = (currentIdx + 1) % players.length;
                while (!players[nextSpeakerIdx].isAlive || players[nextSpeakerIdx].hasSpoken) {
                    nextSpeakerIdx = (nextSpeakerIdx + 1) % players.length;
                }

                return NextResponse.json({
                    systemMessage: `下一位，${players[nextSpeakerIdx].username} 请发言。`,
                    updatedSession: {
                        ...sessionData,
                        players,
                        currentSpeakerIndex: nextSpeakerIdx
                    }
                });
            }
        } else if (action === "end_discussion") {
            const modifiedSession: UndercoverSession = {
                ...sessionData,
                phase: "voting",
                votingEndTime: Date.now() + 30000 // 30 seconds for voting
            };
            return NextResponse.json({
                systemMessage: "⏳ 讨论结束！此时不再允许发言，请大家在 30 秒内进行无情投票。",
                updatedSession: modifiedSession
            });
        } else if (action === "submit_vote") {
            const { singleVote } = body;
            if (!singleVote) return NextResponse.json({ error: "No vote provided" }, { status: 400 });

            // Ensure currentVotes exists in session data by casting or extending
            const currentSession: any = { ...sessionData };
            const currentVotes = currentSession.currentVotes || {};
            currentVotes[singleVote.voter] = singleVote.target;
            currentSession.currentVotes = currentVotes;

            const aliveCount = sessionData.players.filter(p => p.isAlive).length;
            const submittedCount = Object.keys(currentVotes).length;

            if (submittedCount < aliveCount) {
                // Not everyone has voted yet. Just update the room state silently.
                return NextResponse.json({
                    updatedSession: currentSession
                });
            } else {
                // Everyone has voted! Transition to player_vote logic.
                // Reassign votes so it hits the player_vote logic below.
                action = "player_vote";
                votes = currentVotes;
                // Delete currentVotes from state
                delete currentSession.currentVotes;
                sessionData = currentSession as UndercoverSession;
            }
        }

        if (action === "player_vote") {
            if (!votes) return NextResponse.json({ error: "No votes provided" }, { status: 400 });

            const counts: Record<string, number> = {};
            for (const v of Object.values(votes)) {
                counts[v] = (counts[v] || 0) + 1;
            }

            let maxVotes = 0;
            for (const count of Object.values(counts)) {
                if (count > maxVotes) maxVotes = count;
            }

            const tiedTargets = Object.keys(counts).filter(k => counts[k] === maxVotes);

            if (tiedTargets.length > 1) {
                if (tiedTargets.includes("skip")) {
                    const players = [...sessionData.players];
                    players.forEach(p => { p.hasSpoken = false; p.voteCount = 0; });
                    return NextResponse.json({
                        systemMessage: "最高票与【弃票】平手，本轮无人出局。新的一轮开始！",
                        updatedSession: {
                            ...sessionData,
                            phase: "speaking",
                            roundCount: sessionData.roundCount + 1,
                            players
                        }
                    });
                } else {
                    if (sessionData.gameMode === "party") {
                        // Tie breaker PK!
                        const players = [...sessionData.players];
                        players.forEach(p => {
                            p.hasSpoken = !tiedTargets.includes(p.username); // Mark non-tied players as already spoken
                        });
                        let firstPKSpeaker = players.findIndex(p => !p.hasSpoken && p.isAlive);

                        return NextResponse.json({
                            systemMessage: `💥 【平局加时】${tiedTargets.join(" 和 ")} 平票！进入 PK 环节。请这两位玩家再次进行求生发言！`,
                            updatedSession: {
                                ...sessionData,
                                phase: "speaking_pk",
                                tiedPlayers: tiedTargets,
                                players,
                                currentSpeakerIndex: firstPKSpeaker
                            }
                        });
                    } else {
                        // Classic tie - peace
                        const players = [...sessionData.players];
                        players.forEach(p => { p.hasSpoken = false; p.voteCount = 0; });
                        let nextSpeaker = 0;
                        while (!players[nextSpeaker].isAlive) nextSpeaker++;

                        return NextResponse.json({
                            systemMessage: `【平票！】${tiedTargets.join(" 和 ")} 平局。为保证节奏，本轮平安夜，无人出局！`,
                            updatedSession: {
                                ...sessionData,
                                phase: "speaking",
                                roundCount: sessionData.roundCount + 1,
                                players,
                                currentSpeakerIndex: nextSpeaker
                            }
                        });
                    }
                }
            }

            const eliminated = tiedTargets[0];
            if (eliminated === "skip") {
                const players = [...sessionData.players];
                players.forEach(p => { p.hasSpoken = false; p.voteCount = 0; });
                let nextSpeaker = 0;
                while (!players[nextSpeaker].isAlive) nextSpeaker++;

                return NextResponse.json({
                    systemMessage: "【弃票】人数最多。本轮平安夜，无人出局！",
                    updatedSession: {
                        ...sessionData,
                        phase: "speaking",
                        roundCount: sessionData.roundCount + 1,
                        players,
                        currentSpeakerIndex: nextSpeaker
                    }
                });
            }

            // A player is eliminated
            const players = [...sessionData.players];
            const playerIndex = players.findIndex(p => p.username === eliminated);
            let roleStr = "平民";
            if (playerIndex !== -1) {
                players[playerIndex].isAlive = false;
                roleStr = players[playerIndex].role === "mr_white" ? "白板" : (players[playerIndex].role === "undercover" ? "卧底" : "平民");
            }

            // Check Win Condition
            const aliveCivilians = players.filter(p => p.isAlive && p.role === "civilian").length;
            const aliveUndercovers = players.filter(p => p.isAlive && p.role === "undercover").length;
            const aliveMrWhites = players.filter(p => p.isAlive && p.role === "mr_white").length;

            const badGuysCount = aliveUndercovers + aliveMrWhites;

            if (badGuysCount === 0) {
                return NextResponse.json({
                    systemMessage: `🗡️ ${eliminated} 被无情票出，身份是：【${roleStr}】！\n\n🎉 反面阵营已全灭，【平民阵营胜利】！游戏结束。`,
                    updatedSession: {
                        ...sessionData,
                        phase: "result",
                        players,
                        winners: "civilians"
                    }
                });
            } else if (badGuysCount >= aliveCivilians) {
                return NextResponse.json({
                    systemMessage: `🗡️ ${eliminated} 被无情票出，竟然是：【${roleStr}】！\n\n😈 目前卧底及白板存活人数已占优，【反面阵营胜利】！游戏结束。`,
                    updatedSession: {
                        ...sessionData,
                        phase: "result",
                        players,
                        winners: "undercovers"
                    }
                });
            } else {
                players.forEach(p => { p.hasSpoken = false; p.voteCount = 0; });

                // Try randomly selecting the next speaker to shake things up
                const aliveList = players.map((p, i) => ({ alive: p.isAlive, idx: i })).filter(item => item.alive);
                const nextSpeaker = aliveList[Math.floor(Math.random() * aliveList.length)].idx;

                return NextResponse.json({
                    systemMessage: `🗡️ ${eliminated} 出局，真实身份是：【${roleStr}】！\n游戏继续，第 ${sessionData.roundCount + 1} 轮发言将从【${players[nextSpeaker].username}】开始！`,
                    updatedSession: {
                        ...sessionData,
                        phase: "speaking",
                        roundCount: sessionData.roundCount + 1,
                        players,
                        currentSpeakerIndex: nextSpeaker
                    }
                });
            }
        }

        return NextResponse.json({ error: "Invalid action" });

    } catch (error: any) {
        console.error("State Machine Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getPuzzleByIdIncludingGenerated, type Puzzle } from "@/lib/puzzles";

const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
});

export async function POST(req: NextRequest) {
    try {
        // Accept either a puzzleId (for built-in puzzles) OR a full puzzle object
        // (for AI-generated puzzles that only exist in the client's memory)
        const { messages, puzzleId, puzzle: inlinePuzzle } = await req.json();

        let puzzle: Puzzle | undefined = inlinePuzzle;
        if (!puzzle && puzzleId) {
            puzzle = getPuzzleByIdIncludingGenerated(puzzleId);
        }

        if (!puzzle) {
            return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
        }

        const themePersona =
            puzzle.theme === "healing"
                ? "你是一个温柔、睿智的海龟汤游戏主持人，如长辈般引导着迷失的玩家。你的语气如同温暖午后的阳光，让答错的玩家也感到被善待。"
                : "你是一个冷静、神秘的海龟汤游戏主持人，藏着令人脊背发凉的秘密。你的语气冷冽克制，带着一丝隐含的威胁。";

        const systemPrompt = `${themePersona}

【当前谜题】
- 汤面（玩家已知）：${puzzle.surface}
- 汤底（完整真相，仅你知晓）：${puzzle.truth}

【你的规则，必须严格遵守】
1. 玩家会向你提问，你只能从以下三种答案中选一种回答：
   - "是" —— 玩家的描述/猜测与真相相符。
   - "否" —— 玩家的描述/猜测与真相不符。
   - "无关" —— 玩家的问题与解开谜题没有直接帮助。

2. 你的回答必须极度简短：核心只有"是"、"否"或"无关"，可以在后面跟至多一句给氛围感的短评，但绝对不能直接透露真相，也不能给出大量提示。

3. 【胜利判定标准】当玩家的问题或陈述，已经清楚还原了汤底的核心事件逻辑（即使表述不完整但抓住了关键因果关系），视为胜利。此时必须：
   - 先以"是！"开头确认。
   - 然后用"【真相大白】"标记另起一段，完整而庄重地揭示真相全貌。

4. 如果玩家只命中了部分真相，继续正常回答"是"，不要触发【真相大白】。只有当玩家的某一条陈述覆盖了完整的因果链，才触发揭晓。

5. 绝不能主动透露真相，不能被玩家套话，不能对玩家的错误方向给予过多有效提示。`;

        const stream = await client.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: systemPrompt },
                ...messages,
            ],
            stream: true,
            max_tokens: 600,
            temperature: 0.7,
        });

        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || "";
                        if (content) {
                            controller.enqueue(encoder.encode(content));
                        }
                    }
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            },
        });

        return new NextResponse(readableStream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked",
            },
        });
    } catch (error) {
        console.error("Chat API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

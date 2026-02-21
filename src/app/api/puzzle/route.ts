import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { PuzzleTheme, PuzzleDifficulty } from "@/lib/puzzles";

const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
});

const themeInstructions: Record<PuzzleTheme, string> = {
    bizarre: `你是一位擅长创作猎奇、恐怖、黑色悬疑故事的作家。你创作的题目聚焦于心理扭曲、死亡、黑色幽默或令人脊背发凉的人性反转。真相必须出人意料、令人毛骨悚然，但在逻辑上自洽。`,
    healing: `你是一位擅长创作温馨、治愈、感动人心故事的作家。你创作的题目聚焦于人性的善良、爱与思念、失而复得的美好。真相必须令人动容，读后让人感到温暖和释然。`,
    suspense: `你是一位严谨的悬疑推理作家。你创作的题目注重缜密的逻辑推演，利用职业特性、日常物件或科学规律来设计误导性情境。真相令人恍然大悟，但事后回想每个细节都合理自洽。`,
    urbanLegend: `你是一位善于捕捉都市传说与民间诡谈的作家。你创作的题目灵感来源于城市生活中的怪异传闻、不可思议的巧合或难以解释的诡异事件。真相扑朔迷离，充满市井气息与诡异感。`,
    darkHumor: `你是一位擅长黑色幽默的喜剧悬疑作家。你创作的题目充满荒诞感：令人哭笑不得的误会、讽刺社会现象的荒谬反转、或看似严肃实则滑稽的结局。真相让人在苦笑中若有所思。`,
};

const difficultyInstructions: Record<PuzzleDifficulty, string> = {
    简单: "题目简单明了，真相清晰易于推理，通常只需5-10个问题即可解开。",
    中等: "题目有一定的误导性，需要15-25个问题，考验玩家是否能从多个角度思考。",
    困难: "题目设计精妙，玩家很难快速找到突破口，需要30个以上的问题，真相令人大为震惊。",
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const theme: PuzzleTheme = body.theme || "bizarre";
        const difficulty: PuzzleDifficulty = body.difficulty || "中等";

        const systemPrompt = `${themeInstructions[theme]}

请为玩家创作一道【${difficulty}难度】的海龟汤题目。

难度标准：${difficultyInstructions[difficulty]}

你必须以如下纯 JSON 格式返回，不得添加任何其他文字：
{
  "title": "题目名称（4-8字，简洁有力）",
  "genre": "题材标签（如：悬疑/心理/经典/惊悚/亲情/治愈，1-3字）",
  "surface": "汤面文字（呈现给玩家的离奇情境，60-150字，末尾附一个引导性问题如"这是为什么？"或"发生了什么？"）",
  "truth": "汤底文字（完整真相，仅传给AI主持人，不展示给玩家，100-200字，逻辑完整自洽）"
}`;

        const response = await client.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "请创作一道全新的原创海龟汤题目。" },
            ],
            temperature: 1.0,
            max_tokens: 800,
            response_format: { type: "json_object" },
        });

        const raw = response.choices[0]?.message?.content;
        if (!raw) throw new Error("Empty response from AI");

        const parsed = JSON.parse(raw);

        // Validate required fields
        if (!parsed.title || !parsed.surface || !parsed.truth || !parsed.genre) {
            throw new Error("Missing required fields in AI response");
        }

        const puzzle = {
            title: parsed.title,
            genre: parsed.genre,
            surface: parsed.surface,
            truth: parsed.truth,
            difficulty,
            theme,
        };

        return NextResponse.json({ success: true, puzzle });
    } catch (error) {
        console.error("Puzzle generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate puzzle", detail: String(error) },
            { status: 500 }
        );
    }
}

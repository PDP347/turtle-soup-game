import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { PuzzleTheme, PuzzleDifficulty } from "@/games/turtle-soup/models/puzzles";
import { puzzles, getGeneratedPuzzles } from "@/games/turtle-soup/models/puzzles";

const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
});

const themeInstructions: Record<PuzzleTheme, string> = {
    bizarre: `【核心：异化、残缺、非人的执念】
创作专注于“常态下的极度扭曲”。
汤面：描绘一个看似日常但生理/心理逻辑极度不适的行为（如：一个女孩每天在镜子前修剪自己的影子，直到影子开始流血）。
汤底：揭露一个涉及肉体异化、超越伦理的科学/巫术实验，或极度扭曲的情感占有，重点在于细思恐极的“反胃后的寒意”，拒绝廉价的直接暴力。`,
    healing: `【关键词：跨越、补偿、灵魂的重逢】
创作专注于“悲剧外壳下的柔情”。
汤面：展示一个由于某种无法挽回的遗憾而产生的离奇现象（如：老爷爷每天对着空邮筒投递没有地址的信，直到邮筒开出了花）。
汤底：揭开一段跨越生死、物种或记忆的深沉爱意。汤底应是个“温暖的悲剧”，旨在通过真相揭露实现情感救赎。`,
    suspense: `【关键词：盲点、密室、纯粹逻辑、信息误差】
创作专注于“纯粹的脑力博弈”。
汤面：呈现一个物理上绝对不可能或在现实逻辑中完全矛盾的瞬间（不可能犯罪）。
汤底：严丝合缝的闭环逻辑，利用职业特征、自然常识、心理误差或复杂时间差设计诡计。坚决拒绝灵异，追求“光天化日之下最简单的谎言”被识破后的爽快感。`,
    urbanLegend: `【关键词：现代禁忌、规则入侵、城市怪谈】
创作专注于“现代文明的阴影”。
汤面：以电梯、深夜外卖、空荡地铁等现代都市标志为背景，设定某种“必须遵守的诡异逻辑”。
汤底：深挖现代文明背后源于古老诅咒的复苏或都会人群集体无意识的异化，充满宿命感。`,
    darkHumor: `【关键词：命运恶意、荒诞讽刺、极致的反差感】
创作专注于“严肃的滑稽”。
汤面：一个极其庄重、神圣或紧张的场合被一个极其滑稽的行为所打破。
汤底：由于一系列极致自私、低级失误或命运开的灾难级玩笑，导致原本严肃的行为引向了荒唐且不可挽回的结局。`,
};

const difficultyInstructions: Record<PuzzleDifficulty, string> = {
    简单: "【直点题意】汤面与汤底之间只有 1-2 个逻辑断层，玩家通过 5-10 个常识性问题即可拼凑出真相，适合热身。",
    中等: "【关键误导】汤面中必须包含一个强力误导项（Red Herring），刻意将玩家的思路引向错误的方向，考察发散性思维，需 15-25 问。",
    困难: "【多重嵌套/盲区】真相涉及多人复杂动机或极具迷惑性的物理/时间差。逻辑必须严丝合缝但极难触达，一定要有强烈的“出人意料”震撼感。",
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const theme: PuzzleTheme = body.theme || "bizarre";
        const difficulty: PuzzleDifficulty = body.difficulty || "中等";
        const mixExisting: boolean = body.mixExisting === true;
        const currentPuzzleId: string | undefined = body.currentPuzzleId;

        // Combine all known puzzles to analyze what already exists
        const allStore = [...puzzles, ...getGeneratedPuzzles()];
        const themePuzzles = allStore.filter(p => p.theme === theme);

        if (mixExisting) {
            // Filter candidates that match the exact difficulty and aren't the one we just played
            const candidatePuzzles = themePuzzles.filter(p => p.difficulty === difficulty && p.id !== currentPuzzleId);
            // Give a 60% chance to pick an existing high-quality puzzle from the pool to avoid AI repetition fatigue
            if (candidatePuzzles.length > 0 && Math.random() < 0.6) {
                const randIndex = Math.floor(Math.random() * candidatePuzzles.length);
                return NextResponse.json({ success: true, puzzle: candidatePuzzles[randIndex] });
            }
        }

        const existingTitles = themePuzzles.map(p => `《${p.title}》`).join("、");

        // Get the last 3 generated puzzles for this theme to strongly prevent consecutive repetition
        const generatedPuzzlesInfo = getGeneratedPuzzles().filter(p => p.theme === theme).slice(-3);
        const recentPlots = generatedPuzzlesInfo.length > 0
            ? `\n【最近生成的AI题目（极度警告：绝对不可与以下真相核心雷同）】：\n` + generatedPuzzlesInfo.map(p => `- 《${p.title}》: 核心真相是 ${p.truth.substring(0, 60)}...`).join("\n")
            : "";

        const systemPrompt = `${themeInstructions[theme]}

请为玩家创作一道全新的【${difficulty}难度】海龟汤题目。

【⚠️核心防重限制】：
为了避免题库同质化，请绝对**不要**与以下已有题目的核心诡计、人物设定、死法和故事背景发生雷同：
${existingTitles || "暂无已有题目，可自由发挥"}。${recentPlots}

【禁止套用烂梗】：请刻意避开最常见的套路（如：把人肉当动物肉吃、盲人误以为又瞎了、双胞胎身份顶替、重男轻女复仇、多重人格、为了参加葬礼见某人而杀人、绝症捐献器官等）。你需要设计一个**完全不同视角、有新意、逻辑精妙的原创剧本**。

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

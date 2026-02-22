import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { Difficulty } from "@/games/draw-and-guess/models/game";
import { DRAW_WORD_BANK } from "@/games/draw-and-guess/data/wordBank";

const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
});

function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Helper to pick words with unique categories
function pickUniqueCategoryWords(words: any[], count: number) {
    const shuffled = shuffle(words);
    const picked = [];
    const usedCategories = new Set<string>();

    for (const w of shuffled) {
        if (!usedCategories.has(w.category)) {
            picked.push(w);
            usedCategories.add(w.category);
            if (picked.length === count) break;
        }
    }

    // If we couldn't find enough unique categories (rare), fill with whatever is left
    if (picked.length < count) {
        for (const w of shuffled) {
            if (!picked.find(p => p.word === w.word)) {
                picked.push(w);
                if (picked.length === count) break;
            }
        }
    }

    return picked;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const difficulty: Difficulty = body.difficulty || "中等";
        const excludeWords: string[] = body.excludeWords || [];
        const useAI: boolean = body.useAI || false;

        // --- 1. 纯本地题库模式 (默认) ---
        if (!useAI) {
            const availableLocal = DRAW_WORD_BANK.filter(
                w => w.difficulty === difficulty && !excludeWords.includes(w.word)
            );

            // Pick 3 words, ensuring their categories are different
            let finalWords = pickUniqueCategoryWords(availableLocal, 3);

            // 如果连本地题库都枯竭了（极小概率），复用打乱
            if (finalWords.length < 3) {
                finalWords = pickUniqueCategoryWords(DRAW_WORD_BANK.filter(w => w.difficulty === difficulty), 3);
            }

            return NextResponse.json({
                success: true,
                words: finalWords,
                source: "local"
            });
        }

        // --- 2. 强力 AI 脑洞模式 (玩家手动触发) ---
        const ALL_THEMES = [
            "宇宙空间", "厨房用品", "古代神话", "现代科技", "哺乳动物", "昆虫爬虫", "自然灾害", "微观世界", "世界地理",
            "日常小动作", "极端情绪", "海洋生物", "网络流行语", "体育竞技", "医疗用品", "交通工具", "音乐艺术", "恐怖惊悚",
            "商业经济", "成语俗语", "甜品小吃", "校园生活", "职场黑话", "童年回忆", "武侠江湖", "玄幻修仙", "科幻兵器",
            "服饰美妆", "花草树木", "奇葩职业", "人体器官", "家用电器", "文具用具", "古代刑罚", "名胜古迹", "蔬菜水果"
        ];
        const randomThemes = shuffle(ALL_THEMES).slice(0, 3);

        const systemPrompt = `<Role_and_Task>
你是一个极其严苛的"你画我猜"游戏设计与出题专家。
你的任务是每次生成 3 个全新的、充满创意的【${difficulty}】难度词汇。
</Role_and_Task>

<Difficulty_Standards>
对于目标难度【${difficulty}】，必须严格遵守以下画面感标准：
- 简单：单一实体与直观外形。生活中随处可见的具体物品、动植物。无背景要求，必须能用简单的几何图形和少量线条在短时间内勾勒出极具辨识度的轮廓。绝对不可包含形容词修饰（如：不可用"红色的苹果"，只能用"苹果"）。
- 中等：组合元素与动态场景。由2个或以上具体元素组合的场景，或者带有明确肢体语言的动作。画手需要表现出实体之间的互动或特定状态。动作必须有对应的视觉特征，不能是纯内部心理活动（如可以用"发呆"，但不能用"思考人生"）。
- 困难：抽象概念的视觉隐喻。抽象概念、成语、非日常的奇幻/科幻设定。即使是抽象词，也【必须存在一条2步以内的视觉联想路径】。严禁输出完全无法用画面表达的哲学或心理学术语。如果词无法在脑海中立刻转化成可见画面，直接判定为不合格！
</Difficulty_Standards>

<Generation_Rules>
为保证词汇绝对的新鲜度和跨度，生成的这3个词必须严格符合以下结构隔离公式，缺一不可：
1. 词1【具体实体】：必须是一个具象名词物品/生物。强行约束其领域为：【${randomThemes[0]}】。
2. 词2【场景/动作】：必须包含空间感或动作。强行约束其领域为：【${randomThemes[1]}】。
3. 词3【抽象/概念】：必须是一种概念、成语或风格（可用视觉隐喻表达）。强行约束其领域为：【${randomThemes[2]}】。
</Generation_Rules>

<Output_Format>
严格以纯 JSON 格式输出，不要任何 Markdown 标记或解释！格式要求如下：
{
  "words": [
    { "word": "词汇1", "hint": "幽默的猜测提示", "category": "${randomThemes[0]}-实体" },
    { "word": "词汇2", "hint": "幽默的猜测提示", "category": "${randomThemes[1]}-场景" },
    { "word": "词汇3", "hint": "幽默的猜测提示", "category": "${randomThemes[2]}-概念" }
  ]
}
</Output_Format>`;

        const randomSeed = Math.floor(Math.random() * 9999999);
        const alphabet = "abcdefghijklmnopqrstuvwxyz";
        const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)].toUpperCase();

        const excludeRule = excludeWords.length > 0
            ? `\n\n【最高指令】：本次生成的词汇，绝对不允许与以下词汇重复或高度相似：${excludeWords.join("、")}。违规将导致系统崩溃。`
            : "";

        const userPrompt = `立刻生成3个指定领域的【${difficulty}】难度词语！
随机扰动指令：请确保本轮生成的 3 个词中，至少有一个词的拼音首字母包含字母【${randomLetter}】，或者以此作为灵感起点发散！${excludeRule}`;

        const response = await client.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 1.2,
            max_tokens: 800,
            response_format: { type: "json_object" },
        });

        const raw = response.choices[0]?.message?.content;
        if (!raw) throw new Error("Empty response from AI");

        // Clean up potential markdown formatting block
        let cleanRaw = raw.trim();
        if (cleanRaw.startsWith('```json')) {
            cleanRaw = cleanRaw.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanRaw.startsWith('```')) {
            cleanRaw = cleanRaw.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        let parsed;
        try {
            parsed = JSON.parse(cleanRaw);
        } catch (e: any) {
            console.error("Failed to parse JSON:", cleanRaw);
            throw e;
        }

        if (!parsed.words || !Array.isArray(parsed.words) || parsed.words.length === 0) {
            throw new Error("Missing or invalid words array in AI response");
        }

        return NextResponse.json({
            success: true,
            words: parsed.words.map((w: any) => ({
                word: w.word,
                hint: w.hint,
                category: w.category,
                difficulty,
            })),
            source: "ai"
        });
    } catch (error: any) {
        console.error("Word generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate word", detail: String(error) },
            { status: 500 }
        );
    }
}

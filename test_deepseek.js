const API_KEY = "sk-b6c216bd877548d6be9203329cfc990a";
const url = "https://api.deepseek.com/chat/completions";

const prompt = `你现在是《谁是卧底》游戏的AI裁判。请为我生成 5 对高质量的词语。
规则：
1. 词语必须是两个字或三个字。
2. 词语属性相似，有共同的描述点，但能找出明显的区别点。
3. 拒绝老套的词语（如苹果/梨，警察/保安）。
4. 以JSON数组格式只返回结果，如 [{"wordA": "词1", "wordB": "词2"}]，不要任何解释。`;

async function main() {
    console.log("正在请求 Deepseek API...");
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7
        })
    });

    if (!res.ok) {
        console.error("API 错误:", res.status, res.statusText);
        const text = await res.text();
        console.error(text);
        return;
    }

    const data = await res.json();
    console.log("生成结果:");
    console.log(data.choices[0].message.content);
}

main();

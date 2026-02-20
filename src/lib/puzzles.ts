export type PuzzleTheme = "bizarre" | "healing";
export type PuzzleDifficulty = "简单" | "中等" | "困难";

export interface Puzzle {
    id: string;
    title: string;
    surface: string; // 汤面（呈现给玩家）
    truth: string;   // 汤底（仅传给 AI）
    difficulty: PuzzleDifficulty;
    genre: string;
    theme: PuzzleTheme;
    isGenerated?: boolean; // 标记为 AI 动态生成的题目
}

export const puzzles: Puzzle[] = [
    // ─── Bizarre / 猎奇恐怖 ───────────────────────────────────────────────────
    {
        id: "b1",
        title: "餐厅的汤",
        difficulty: "简单",
        genre: "经典",
        theme: "bizarre",
        surface:
            "一名男子走进餐厅，点了一碗海龟汤。他尝了一口之后，走出餐厅，回到家里，举枪自尽了。",
        truth:
            "这名男子曾经在一次海难中与妻子漂流在救生筏上。食物耗尽后，一名同行的船员给了他一碗'海龟汤'，他喝了活了下来，但妻子却因拒绝喝此汤而死去。多年后，他在餐厅喝到了真正的海龟汤，口味与当年那碗截然不同——他终于意识到，当年船员给他喝的是妻子的肉做成的汤，而不是真正的海龟汤。悲痛欲绝之下，他选择了自尽。",
    },
    {
        id: "b2",
        title: "葬礼上相遇",
        difficulty: "中等",
        genre: "心理",
        theme: "bizarre",
        surface:
            "一对姐妹在母亲的葬礼上相遇。妹妹当场爱上了一名陌生男子，但葬礼结束后男子消失了，怎么也联系不上。一个月后，妹妹杀死了自己的姐姐。",
        truth:
            "妹妹的想法是：如果家里再死一个人，就需要再开一次葬礼，那个她心仪的神秘男子就可能再次出现。她认为只要再制造一次死亡，就能见到他。",
    },
    {
        id: "b3",
        title: "跳火车",
        difficulty: "中等",
        genre: "心理",
        theme: "bizarre",
        surface:
            "一个盲人乘火车去邻镇治病，治好双眼后欣喜地踏上归途。火车进入隧道时，他突然跳车自杀了。",
        truth:
            "火车进入隧道后，车厢瞬间陷入一片漆黑。刚刚重见光明的他，以为自己又重新瞎了。无法接受再次失去视力的事实，他选择了在绝望中结束生命。",
    },
    {
        id: "b4",
        title: "女明星的女儿",
        difficulty: "困难",
        genre: "惊悚",
        theme: "bizarre",
        surface:
            "一位女明星从小就给自己收养的女儿时不时戴上一顶帽子。有一天，她带女儿去了医院。女儿在医院里知道了真相，随后自杀了。",
        truth:
            "这位女明星曾遭遇严重毁容，她收养女儿是为了等待时机，将女儿的皮肤移植到自己脸上。她不时给女儿戴帽子，是为了测量女儿头部的尺寸，等待头围合适时便实施手术。在医院，女儿看到了档案里病历上写明的真相，随即崩溃，选择了自尽。",
    },
    {
        id: "b5",
        title: "十三楼的秘密",
        difficulty: "困难",
        genre: "悬疑",
        theme: "bizarre",
        surface:
            "王先生住在一栋高楼的13楼，某天他从13楼的窗户跌落，却毫发无伤。这栋楼不存在任何缓冲设施。",
        truth:
            "王先生当时在13楼的室内，他不小心从一扇朝向楼道内侧的'窗户'（即内部装饰用的假窗，嵌入了玻璃）跌落进了楼道，高度仅一两层楼梯的落差，所以安然无恙。这栋楼的13楼因为设计原因，内侧走廊有一面造型像窗户的采光玻璃墙，从房间内看来就像真的窗户一样，实际上是掉入走廊，并非室外高空。",
    },

    // ─── Healing / 温馨治愈 ───────────────────────────────────────────────────
    {
        id: "h1",
        title: "打嗝的救星",
        difficulty: "简单",
        genre: "温馨",
        theme: "healing",
        surface:
            "一个男人走进酒吧，请酒保帮他倒一杯水。酒保看了他一眼，突然从柜台后掏出一把枪指了指他。男人愣了一下，说了声'谢谢'，喝了水便离开了。",
        truth:
            "男人当时在剧烈打嗝，一直无法停止。酒保看出来了，便用突然举枪的惊吓来帮他止嗝——果然奏效。男人道谢，正是感谢酒保用这个方式治好了他恼人的打嗝。",
    },
    {
        id: "h2",
        title: "空旷秋千",
        difficulty: "中等",
        genre: "治愈",
        theme: "healing",
        surface:
            "每个下午，一位老人都会坐在公园长椅上，望着那架空荡荡的秋千出神，嘴角微微上扬。某天，秋千轻轻晃动了起来，老人的眼中涌出了泪水。",
        truth:
            "老人的小孙女在七岁时因病去世，她最爱在这架秋千上玩耍。老人每天来此，像是陪着过往的时光。那天下午，风恰好吹过，空旷的秋千在无人推动的情况下轻轻晃起来——仿佛孙女还在其中。那一刻，他不知是悲是喜，只是泪流满面。",
    },
    {
        id: "h3",
        title: "妈妈的眼泪",
        difficulty: "简单",
        genre: "亲情",
        theme: "healing",
        surface:
            "我哭了，妈妈笑了。我笑了，妈妈笑了。后来我哭了，妈妈也哭了。再后来我哭了，妈妈笑了——可这次，妈妈的笑只剩一张照片。",
        truth:
            "这是一个人一生中与妈妈的四个时刻：第一次是自己呱呱坠地，妈妈因为新生儿的到来喜极而笑；第二次是童年玩耍欢笑，妈妈看着孩子开心地笑；第三次是婚礼现场，两人相拥而泣；最后一次是妈妈的葬礼，孩子失声痛哭，而妈妈的遗像上，永远是那个慈爱的笑容。",
    },
    {
        id: "h4",
        title: "点不完的灯",
        difficulty: "困难",
        genre: "温馨",
        theme: "healing",
        surface:
            "小镇上有一栋废弃的旧房子，每到深夜，窗户里就会亮起一盏灯。周围的居民都说里面住着鬼，没有人敢靠近。直到有一天，一个孩子独自敲开了那扇门。",
        truth:
            "那盏灯是一位失去孩子的老奶奶每夜点亮的。她的儿子小时候每天都会在夜里出去玩，她怕他找不到路回家，便养成了每晚在窗口点灯的习惯。儿子在一次意外中离世后，她依然每晚点灯，'以防他还在外面迷路，看见光就能找到回家的路'。敲门的孩子是她儿子的遗孤，第一次知道了父亲成长的故事。",
    },
];

export function getPuzzleById(id: string): Puzzle | undefined {
    return puzzles.find((p) => p.id === id);
}

// For dynamically generated puzzles at runtime (stored in memory)
const generatedPuzzles: Puzzle[] = [];
let generatedCounter = 0;

export function addGeneratedPuzzle(puzzle: Omit<Puzzle, "id" | "isGenerated">): Puzzle {
    const id = `gen-${++generatedCounter}-${Date.now()}`;
    const full: Puzzle = { ...puzzle, id, isGenerated: true };
    generatedPuzzles.push(full);
    return full;
}

export function getGeneratedPuzzles(): Puzzle[] {
    return generatedPuzzles;
}

export function getPuzzleByIdIncludingGenerated(id: string): Puzzle | undefined {
    return puzzles.find((p) => p.id === id) ?? generatedPuzzles.find((p) => p.id === id);
}

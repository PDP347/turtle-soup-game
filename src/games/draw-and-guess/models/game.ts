// Types for the Draw and Guess game

export type Difficulty = "简单" | "中等" | "困难";

export interface DrawingPoint {
    x: number;
    y: number;
    pressure?: number;
}

export interface DrawingStroke {
    id: string;
    points: DrawingPoint[];
    color: string;
    width: number;
    type: "draw" | "erase";
}

export interface DrawingEvent {
    type: "stroke_start" | "stroke_move" | "stroke_end" | "clear" | "fill";
    stroke?: Partial<DrawingStroke>;
    color?: string;
    width?: number;
    point?: DrawingPoint;
    strokeId?: string;
}

export interface WordEntry {
    word: string;
    hint?: string;
    category?: string;
}

export interface AIWordResponse {
    word: string;
    hint: string;
    category: string;
    difficulty: Difficulty;
}

export type GamePhase =
    | "waiting"      // Waiting for players to join
    | "selecting"    // Painter is selecting a word
    | "drawing"      // Active drawing round
    | "round_end"    // Round finished (someone guessed or time up)
    | "game_end";    // All rounds done

export interface RoundResult {
    word: string;
    guessedBy: string | null; // player name who guessed, or null if time up
    timeLeft: number;
    scores: Record<string, number>; // playerName -> points earned this round
}

export interface DrawAndGuessRoom {
    id: string;
    status: GamePhase;
    players: string[];  // list of player names
    painter: string | null; // current painter's name
    word: string | null;
    word_hint: string | null;
    word_category: string | null;
    difficulty: Difficulty;
    round: number;
    max_rounds: number;
    round_start_at: string | null;
    round_duration_seconds: number;
    scores: Record<string, number>; // playerName -> total score
    strokes: DrawingStroke[]; // persisted strokes for late joiners
    round_results: RoundResult[];
    created_at: string;
}

export interface ChatMessage {
    id: string;
    room_id: string;
    player_name: string;
    content: string;
    is_correct_guess: boolean;
    created_at: string;
}

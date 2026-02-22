export type UndercoverRole = "civilian" | "undercover" | "mr_white";

export interface UndercoverPlayer {
    userId: string;
    username: string;
    role: UndercoverRole;
    isAlive: boolean;
    hasSpoken: boolean;
    voteCount: number;
    keyword: string; // The word they received (blank for Mr. White)
}

export type UndercoverPhase = "waiting" | "assigning" | "speaking" | "speaking_pk" | "discussion" | "voting" | "result";

export type GameMode = "text" | "party";

export interface UndercoverSession {
    roomId: string;
    gameMode: GameMode;
    phase: UndercoverPhase;
    players: UndercoverPlayer[];
    currentSpeakerIndex: number;
    roundCount: number;
    civilianWord: string;
    undercoverWord: string;
    winners?: "civilians" | "undercovers";
    isRecordingEnabled?: boolean;
    speakingEndTime?: number; // timestamp for individual speaking timer
    discussionEndTime?: number; // timestamp for 40s timer
    votingEndTime?: number; // timestamp for 30s voting timer
    tiedPlayers?: string[]; // user IDs of players in PK tiebreaker
    undercoverCount?: number; // configuration for party mode
    mrWhiteCount?: number; // configuration for party mode
}

export interface KeywordPair {
    wordA: string;
    wordB: string;
}

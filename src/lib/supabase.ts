import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
    public: {
        Tables: {
            rooms: {
                Row: {
                    id: string;
                    puzzle_data: Record<string, unknown>;
                    status: "waiting" | "playing" | "revealed";
                    created_at: string;
                };
                Insert: {
                    id: string;
                    puzzle_data: Record<string, unknown>;
                    status?: "waiting" | "playing" | "revealed";
                };
                Update: {
                    status?: "waiting" | "playing" | "revealed";
                };
            };
            messages: {
                Row: {
                    id: number;
                    room_id: string;
                    player_name: string;
                    content: string;
                    is_ai: boolean;
                    created_at: string;
                };
                Insert: {
                    room_id: string;
                    player_name: string;
                    content: string;
                    is_ai?: boolean;
                };
            };
        };
    };
};

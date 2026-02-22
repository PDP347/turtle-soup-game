import { NextResponse } from "next/server";
import { puzzles, getGeneratedPuzzles } from "@/games/turtle-soup/models/puzzles";

/**
 * GET /api/games/turtle-soup/puzzles
 * Returns all available puzzles (built-in + in-memory AI-generated ones).
 */
export async function GET() {
    try {
        const allPuzzles = [...puzzles, ...getGeneratedPuzzles()];
        return NextResponse.json({ success: true, puzzles: allPuzzles });
    } catch (error) {
        console.error("Failed to load puzzles:", error);
        return NextResponse.json(
            { error: "Failed to load puzzles", detail: String(error) },
            { status: 500 }
        );
    }
}

import type { MatchVideo } from "@sage/contracts/explorer";
/** Original 1001 Tales demo calibrations; user-saved settings take precedence. */
const videos: Record<string, [string, number]> = {
  "Kotd4-Groups S06G3-Mbl vs Vinchester": ["2LfIZczL39Y", 4014.51],
  "Kotd4-Groups S06G3-Mr_Yo vs Daut": ["Yn0gfJtE0EQ", 3993.46],
  "Kotd4-Groups S17G2-Tatoh vs Nicov": ["wGtNCS-2tyE", 1120.21],
  "Kotd4-SF S02G3-TheViper vs Jordan": ["xcTGTlpj6sA", 4447.08],
};
export function studyVideo(name: string): MatchVideo | null {
  const match = videos[name.replace(/^cade-/, "")];
  return match
    ? {
        youtubeId: match[0],
        offsetSeconds: match[1],
        gameRate: 1.65,
        label: "Original study recording",
      }
    : null;
}

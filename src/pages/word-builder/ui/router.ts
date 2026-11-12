import { roundById } from "../content/derive.ts";
import type { Round } from "../content/types.ts";
import { canFreePlay, canPlay, type Progress } from "../game/progress.ts";

export type Route =
  | { readonly screen: "trail" }
  | { readonly screen: "play"; readonly round: Round }
  | { readonly screen: "free"; readonly round: Round }
  | { readonly screen: "stickers" }
  | { readonly screen: "grown-ups" };

const HOME: { readonly redirect: "#/" } = { redirect: "#/" };

/**
 * Applies the guards of plan 3.3. An empty hash is the trail, so the page
 * opens without a redirect; everything unknown or refused goes to "#/".
 */
export function resolveRoute(
  hash: string,
  progress: Progress,
): Route | { readonly redirect: "#/" } {
  if (hash === "" || hash === "#" || hash === "#/") return { screen: "trail" };
  if (hash === "#/stickers") return { screen: "stickers" };
  if (hash === "#/grown-ups") return { screen: "grown-ups" };

  const match = /^#\/(play|free)\/([^/]+)$/.exec(hash);
  const kind = match?.[1];
  const id = match?.[2];
  if (kind === undefined || id === undefined) return HOME;
  const round = roundById(id);
  if (round === undefined) return HOME;
  if (kind === "play") {
    return canPlay(progress, round) ? { screen: "play", round } : HOME;
  }
  return canFreePlay(progress, round) ? { screen: "free", round } : HOME;
}

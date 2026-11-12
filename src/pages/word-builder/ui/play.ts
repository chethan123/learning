/**
 * The play screen: a guided round or free play (plan 3.3).
 *
 * The screen is always in exactly one phase. A placement switches `idle` to
 * `sounding` synchronously and calls `place` exactly once; the rest of the
 * sequence is one async function that owns the Scope it was started with and
 * stops as soon as that scope is cancelled (plan 5.2).
 */
import { playClip, preload, stopAll } from "../audio/engine.ts";
import { sfx } from "../audio/sfx.ts";
import { clipsOf, wordsOf } from "../content/derive.ts";
import { soundId, soundsOfRest, soundsOfTile } from "../content/letter-sets.ts";
import type { Round, Tile } from "../content/types.ts";
import {
  completeRound,
  recordFound,
  resumeWords,
  setSeenDragDemo,
} from "../game/progress.ts";
import {
  currentGroup,
  hintTile,
  nextGroup,
  place,
  startSession,
  tray,
  trayPositions,
  type Mode,
  type Outcome,
  type Session,
} from "../game/session.ts";
import { getProgress, updateProgress } from "../game/store.ts";
import { celebrate } from "./celebrate.ts";
import { createTileGestures } from "./drag.ts";
import { cycleIcon, handIcon } from "./icons.ts";
import { isWide } from "./layout.ts";
import {
  buildGhostTile,
  buildPlaced,
  type Piece,
  type SoundUnit,
} from "./letters.ts";
import {
  bounce,
  EASE_IN,
  EASE_IN_OUT,
  EASE_OUT,
  fadeIn,
  fadeOut,
  flip,
  flyFrom,
  popIn,
  reducedMotion,
  unitOf,
} from "./motion.ts";
import { iconButton } from "./parts.ts";
import {
  buildBigPicture,
  buildGoal,
  buildGroup,
  buildPlayView,
  type FixedCard,
  type GoalState,
  type GroupView,
  type TrayPosition,
} from "./play-view.ts";
import { createScope, isCancelled, type Scope } from "./scope.ts";
import type { Nav, Teardown } from "./stage.ts";

type Phase =
  "idle" | "sounding" | "reveal" | "miss" | "switching" | "celebrate";

type WordOutcome = Exclude<Outcome, { readonly kind: "miss" }>;

const FLIGHT_MS = 250;
const DROP_SETTLE_MS = 120;
/** Shortest time a tile half or card stays lit, so silent play keeps a rhythm. */
const PULSE_MS = 360;
const SOUND_GAP_MS = 120;
const AFTER_SOUNDS_MS = 250;
const HOLD_MS = 1000;
const TO_SLOT_MS = 500;
const FREE_FADE_MS = 300;
const WOBBLE_MS = 400;
const GLIDE_BACK_MS = 300;
/** Out and in together are the 400 ms slide of plan 3.3. */
const SLIDE_HALF_MS = 200;
const IDLE_WAVE_MS = 8000;

function centre(rect: DOMRect): { readonly x: number; readonly y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** One tile half or card lights up, swells and hops. */
async function pulse(scope: Scope, unit: SoundUnit): Promise<void> {
  if (reducedMotion()) {
    await scope.sleep(PULSE_MS);
    return;
  }
  const rise = unit.glyph.getBoundingClientRect().height * 0.1;
  const timing = { duration: PULSE_MS, easing: "ease-out" };
  await Promise.all([
    scope.animate(
      unit.glyph,
      [
        { transform: "scale(1)" },
        { transform: "scale(1.2)", offset: 0.35 },
        { transform: "scale(1)" },
      ],
      timing,
    ),
    unit.lift === undefined
      ? Promise.resolve()
      : scope.animate(
          unit.lift,
          [
            { translate: "0px 0px" },
            { translate: `0px ${String(-rise)}px`, offset: 0.35 },
            { translate: "0px 0px" },
          ],
          timing,
        ),
  ]);
}

/** Plays one sound while its tile half or card pulses. */
async function soundOut(
  scope: Scope,
  unit: SoundUnit,
  sound: string,
): Promise<void> {
  unit.box.classList.add("is-sounding");
  await Promise.all([
    playClip({ kind: "sound", id: sound }),
    pulse(scope, unit),
  ]);
  unit.box.classList.remove("is-sounding");
}

function openSession(round: Round, mode: Mode): Session | undefined {
  try {
    return mode === "guided"
      ? startSession(round, "guided", resumeWords(getProgress(), round))
      : startSession(round, "free");
  } catch {
    // Every word of the round is already found: there is nothing to play.
    return undefined;
  }
}

export function mountPlay(
  root: HTMLElement,
  nav: Nav,
  round: Round,
  mode: Mode,
): Teardown {
  const opened = openSession(round, mode);
  if (opened === undefined) {
    // Should not happen (a full round is completed at once); finish it rather
    // than strand the child on a screen with nothing to do.
    updateProgress((progress) => completeRound(progress, round));
    location.replace("#/");
    return () => undefined;
  }

  let session: Session = opened;
  let phase: Phase = "idle";
  let scope = createScope();
  /** Words whose goal slot shows the full picture. */
  const filled = new Set<string>(session.found);
  /** Extra tiles tried in the current group; drawn at 40% opacity. */
  let missed = new Set<Tile>();
  let idleTimer: ReturnType<typeof setInterval> | undefined;
  let goalSlots: readonly HTMLElement[] = [];

  const view = buildPlayView(() => {
    nav.go("#/");
  });
  let group: GroupView = drawGroup();
  /** The big picture of the word being revealed, while it is on the stage. */
  let bigPicture: HTMLButtonElement | undefined;

  // --- drawing -----------------------------------------------------------

  function setPhase(next: Phase): void {
    phase = next;
    view.screen.setAttribute("data-phase", next);
    if (next !== "idle") stopIdleHelp();
  }

  function renderGoals(): void {
    if (mode !== "guided") return;
    const here = currentGroup(session);
    const inGroup = new Set(here.winning.map((tile) => tile + here.rest));
    goalSlots = wordsOf(round).map((word) => {
      let state: GoalState = "empty";
      if (filled.has(word)) state = "found";
      else if (inGroup.has(word)) state = "faint";
      return buildGoal(word, state, sayGoal);
    });
    view.goals.replaceChildren(...goalSlots);
  }

  /** Shows each tray position as its tile or as a hole, with dim and halo. */
  function syncTray(): void {
    const available = tray(session);
    const hint = hintTile(session);
    for (const [tile, position] of group.positions) {
      const present = available.includes(tile);
      position.slot.classList.toggle("is-empty", !present);
      position.button.hidden = !present;
      position.button.classList.toggle("is-missed", missed.has(tile));
      position.button.classList.toggle("is-hint", tile === hint);
    }
  }

  /** Builds the frame and tray of the session's current group. */
  function drawGroup(): GroupView {
    const next = buildGroup(
      view,
      currentGroup(session),
      trayPositions(session),
    );
    for (const card of next.cards) {
      card.button.addEventListener("click", () => {
        sayCard(card);
      });
    }
    return next;
  }

  /** Replaces the group on screen with the session's current group. */
  function showGroup(): void {
    group = drawGroup();
    missed = new Set<Tile>();
    view.frame.classList.remove("is-reveal", "is-hidden");
    view.tray.classList.remove("is-hidden");
    syncTray();
    renderGoals();
  }

  function removeBigPicture(): void {
    bigPicture?.remove();
    bigPicture = undefined;
  }

  function clearBlank(): void {
    group.blank.replaceChildren();
    group.blank.classList.remove("is-filled", "holds-narrow", "is-near");
  }

  // --- idle: taps that only say something, and help without words ----------

  function sayCard(card: FixedCard): void {
    if (phase !== "idle") return;
    void soundOut(scope, card.unit, soundId(card.grapheme));
  }

  function sayGoal(word: string, slot: HTMLElement): void {
    if (phase !== "idle") return;
    void playClip({ kind: "word", id: word });
    void bounce(scope, slot);
  }

  /** The hand drags a ghost of the first winning tile to the blank. */
  function showDemo(): void {
    const here = currentGroup(session);
    const tile = tray(session).find((t) => here.winning.includes(t));
    const position = tile === undefined ? undefined : group.positions.get(tile);
    const u = unitOf(view.stage);
    if (tile === undefined || position === undefined || u === 0) return;
    const stage = view.stage.getBoundingClientRect();
    const from = position.slot.getBoundingClientRect();
    const to = centre(group.blank.getBoundingClientRect());
    const start = centre(from);
    view.demo.replaceChildren(buildGhostTile(tile), handIcon());
    view.demo.classList.toggle("is-wide", isWide(tile));
    const set = (name: string, px: number): void => {
      view.demo.style.setProperty(name, String(px / u));
    };
    set("--x0", from.left - stage.left);
    set("--y0", from.top - stage.top);
    set("--dx", to.x - start.x);
    set("--dy", to.y - start.y);
    view.demo.classList.add("is-on");
  }

  /** Shows the demo if it is still owed: idle, guided, no placement ever. */
  function offerDemo(): void {
    if (phase !== "idle" || mode !== "guided") return;
    if (!getProgress().seenDragDemo) showDemo();
  }

  function hideDemo(): void {
    view.demo.classList.remove("is-on");
    view.demo.replaceChildren();
  }

  /** The tray tiles bounce one after the other. */
  function wave(): void {
    if (phase !== "idle" || gestures.active || reducedMotion()) return;
    const hop = unitOf(view.stage) * 22;
    let index = 0;
    for (const position of group.positions.values()) {
      if (position.button.hidden) continue;
      void scope.animate(
        position.button,
        [
          { translate: "0px 0px" },
          { translate: `0px ${String(-hop)}px`, offset: 0.4 },
          { translate: "0px 0px" },
        ],
        { duration: 520, delay: index * 90, easing: "ease-out" },
      );
      index += 1;
    }
  }

  function stopIdleHelp(): void {
    clearInterval(idleTimer);
    idleTimer = undefined;
    hideDemo();
  }

  function enterIdle(): void {
    setPhase("idle");
    syncTray();
    stopIdleHelp();
    idleTimer = setInterval(wave, IDLE_WAVE_MS);
    offerDemo();
  }

  // --- the sequence after a placement -------------------------------------

  /** Runs a sequence; a failure must never leave the screen stuck. */
  function run(s: Scope, sequence: (s: Scope) => Promise<void>): void {
    sequence(s).catch((error: unknown) => {
      console.error(error);
      if (isCancelled(s)) return;
      removeBigPicture();
      showGroup();
      enterIdle();
    });
  }

  /**
   * An accepted click (`dropFrom` undefined) or a successful drop. Switches
   * the phase and calls `place` once, before anything is awaited.
   */
  function startPlacement(
    button: HTMLButtonElement,
    dropFrom: DOMRect | undefined,
  ): void {
    if (phase !== "idle") return;
    const tile = button.getAttribute("data-tile");
    if (tile === null || !tray(session).includes(tile)) return;
    const position = group.positions.get(tile);
    if (position === undefined) return;
    const rest = currentGroup(session).rest;

    const result = place(session, tile);
    session = result.session;
    setPhase("sounding");
    if (result.outcome.kind !== "miss") {
      // The hint halo lasts until any winning placement.
      for (const other of group.positions.values()) {
        other.button.classList.remove("is-hint");
      }
    }
    if (mode === "guided" && !getProgress().seenDragDemo) {
      updateProgress(setSeenDragDemo);
    }
    run(scope, (s) =>
      placementSequence(s, tile, rest, position, result.outcome, dropFrom),
    );
  }

  async function placementSequence(
    s: Scope,
    tile: Tile,
    rest: string,
    position: TrayPosition,
    outcome: Outcome,
    dropFrom: DOMRect | undefined,
  ): Promise<void> {
    // The tile leaves its tray position and becomes a card on the blank.
    const origin = position.button.getBoundingClientRect();
    const piece = buildPlaced(tile);
    position.button.hidden = true;
    position.slot.classList.add("is-empty");
    group.blank.classList.remove("is-near");
    group.blank.classList.add("is-filled");
    group.blank.classList.toggle("holds-narrow", !isWide(tile));
    group.blank.replaceChildren(piece.el);
    if (dropFrom === undefined) {
      await flyFrom(s, piece.el, origin, FLIGHT_MS);
      if (isCancelled(s)) return;
    } else {
      // After a drop the sound-out starts at once; the card settles meanwhile.
      void flyFrom(s, piece.el, dropFrom, DROP_SETTLE_MS);
    }

    // One sound per tile half and per card, in reading order.
    const units = [...piece.units, ...group.cards.map((card) => card.unit)];
    const sounds = [...soundsOfTile(tile), ...soundsOfRest(rest)];
    for (const [index, unit] of units.entries()) {
      const sound = sounds[index];
      if (sound === undefined) {
        throw new Error(`No sound for part ${String(index)} of ${tile}${rest}`);
      }
      if (index > 0) {
        await s.sleep(SOUND_GAP_MS);
        if (isCancelled(s)) return;
      }
      await soundOut(s, unit, sound);
      if (isCancelled(s)) return;
    }
    await s.sleep(AFTER_SOUNDS_MS);
    if (isCancelled(s)) return;

    if (outcome.kind === "miss") {
      await missSequence(s, tile, position, piece);
    } else {
      await revealSequence(s, piece, outcome);
    }
  }

  /** Not a word: a quiet boop, a wobble, and the tile glides home, dimmed. */
  async function missSequence(
    s: Scope,
    tile: Tile,
    position: TrayPosition,
    piece: Piece,
  ): Promise<void> {
    setPhase("miss");
    sfx("boop");
    if (reducedMotion()) {
      await s.sleep(WOBBLE_MS);
    } else {
      await s.animate(
        piece.el,
        [
          { transform: "rotate(0deg)" },
          { transform: "rotate(-7deg)", offset: 0.2 },
          { transform: "rotate(6deg)", offset: 0.45 },
          { transform: "rotate(-4deg)", offset: 0.7 },
          { transform: "rotate(2deg)", offset: 0.88 },
          { transform: "rotate(0deg)" },
        ],
        { duration: WOBBLE_MS, easing: "ease-in-out" },
      );
    }
    if (isCancelled(s)) return;

    const from = piece.el.getBoundingClientRect();
    clearBlank();
    missed.add(tile);
    syncTray();
    position.button.classList.add("is-flying");
    await Promise.all([
      flyFrom(s, position.button, from, GLIDE_BACK_MS, EASE_IN_OUT),
      reducedMotion()
        ? Promise.resolve()
        : s.animate(position.button, [{ opacity: 1 }, {}], {
            duration: GLIDE_BACK_MS,
            easing: "ease-in",
          }),
    ]);
    position.button.classList.remove("is-flying");
    if (isCancelled(s)) return;
    enterIdle();
  }

  /** A target word: the picture, the word, and what follows from it. */
  async function revealSequence(
    s: Scope,
    piece: Piece,
    outcome: WordOutcome,
  ): Promise<void> {
    const word = outcome.word;
    setPhase("reveal");
    view.live.textContent = word;
    const big = buildBigPicture(word);
    bigPicture = big;
    view.stage.append(big);
    view.tray.classList.add("is-hidden");
    sfx("pop");
    await Promise.all([
      playClip({ kind: "word", id: word }),
      fadeOut(s, view.tray, 200),
      flip(
        s,
        [piece.el, ...group.cards.map((card) => card.button)],
        () => {
          view.frame.classList.add("is-reveal");
        },
        420,
      ),
      popIn(s, big, 420),
    ]);
    if (isCancelled(s)) return;

    // The hold: one tap on the picture says the word again.
    let holding = true;
    let replayed = false;
    big.addEventListener("click", () => {
      if (!holding || replayed) return;
      replayed = true;
      void playClip({ kind: "word", id: word });
      void bounce(s, big);
    });
    await s.sleep(HOLD_MS);
    holding = false;
    if (isCancelled(s)) return;

    if (outcome.kind === "shown") {
      // Free play: nothing is collected and nothing is saved.
      big.classList.add("is-hidden");
      await fadeOut(s, big, FREE_FADE_MS);
      removeBigPicture();
      if (isCancelled(s)) return;
      await backToTray(s, piece);
      if (isCancelled(s)) return;
      enterIdle();
      return;
    }

    await flyToSlot(s, big, goalSlots[outcome.slot]);
    removeBigPicture();
    if (isCancelled(s)) return;
    filled.add(word);
    renderGoals();
    const slot = goalSlots[outcome.slot];
    if (slot !== undefined) void bounce(s, slot);

    updateProgress((progress) => recordFound(progress, round, word));
    if (outcome.roundDone) {
      updateProgress((progress) => completeRound(progress, round));
      startCelebration(s);
      return;
    }
    if (outcome.groupDone) {
      await switchGroup(s);
      return;
    }
    await backToTray(s, piece);
    if (isCancelled(s)) return;
    enterIdle();
  }

  async function flyToSlot(
    s: Scope,
    big: HTMLElement,
    slot: HTMLElement | undefined,
  ): Promise<void> {
    if (slot === undefined || reducedMotion()) {
      big.classList.add("is-hidden");
      await fadeOut(s, big, 150);
      return;
    }
    const from = centre(big.getBoundingClientRect());
    const target = slot.getBoundingClientRect();
    const to = centre(target);
    const scale = big.offsetWidth === 0 ? 1 : target.width / big.offsetWidth;
    await s.animate(
      big,
      [
        { transform: "translate(0px, 0px) scale(1)" },
        {
          transform: `translate(${String(to.x - from.x)}px, ${String(to.y - from.y)}px) scale(${String(scale)})`,
          rotate: "0deg",
        },
      ],
      { duration: TO_SLOT_MS, easing: EASE_IN_OUT },
    );
  }

  /** The blank empties, the frame grows back and the tray returns. */
  async function backToTray(s: Scope, piece: Piece): Promise<void> {
    await fadeOut(s, piece.el, 150);
    if (isCancelled(s)) return;
    clearBlank();
    syncTray();
    view.tray.classList.remove("is-hidden");
    await Promise.all([
      flip(
        s,
        [group.blank, ...group.cards.map((card) => card.button)],
        () => {
          view.frame.classList.remove("is-reveal");
        },
        380,
      ),
      fadeIn(s, view.tray, 250),
    ]);
  }

  async function slide(s: Scope, direction: "out" | "in"): Promise<void> {
    const moving = [view.frame, view.tray].filter(
      (element) => !element.classList.contains("is-hidden"),
    );
    if (reducedMotion()) {
      await Promise.all(
        moving.map((element) =>
          direction === "out"
            ? fadeOut(s, element, 150)
            : fadeIn(s, element, 150),
        ),
      );
      return;
    }
    const width = window.innerWidth;
    const away = `translateX(${String(direction === "out" ? -width : width)}px)`;
    const home = "translateX(0px)";
    await Promise.all(
      moving.map((element) =>
        s.animate(
          element,
          direction === "out"
            ? [{ transform: home }, { transform: away }]
            : [{ transform: away }, { transform: home }],
          {
            duration: SLIDE_HALF_MS,
            easing: direction === "out" ? EASE_IN : EASE_OUT,
          },
        ),
      ),
    );
  }

  /** The frame and tray leave to the left; the next group comes in. */
  async function switchGroup(s: Scope): Promise<void> {
    setPhase("switching");
    await slide(s, "out");
    if (isCancelled(s)) return;
    session = nextGroup(session);
    showGroup();
    await slide(s, "in");
    if (isCancelled(s)) return;
    enterIdle();
  }

  function startCelebration(s: Scope): void {
    setPhase("celebrate");
    for (const element of [view.goals, view.frame]) {
      element.classList.add("is-hidden");
      void fadeOut(s, element, 250);
    }
    celebrate(view.stage, view.confetti, session.found, s, () => {
      nav.go("#/", { justCompleted: round.id });
    });
  }

  // --- wiring --------------------------------------------------------------

  const gestures = createTileGestures(view.tray, "button.tile", {
    canPlace: () => phase === "idle",
    target: () => group.blank.getBoundingClientRect(),
    onPress: () => {
      sfx("tick");
      hideDemo();
    },
    onActivate: (button) => {
      startPlacement(button, undefined);
    },
    onDrop: startPlacement,
    // The press hid the demo; a gesture that placed nothing brings it back.
    onAbort: offerDemo,
    onNear: (near) => {
      group.blank.classList.toggle("is-near", near && phase === "idle");
    },
  });

  if (mode === "free" && round.groups.length > 1) {
    const cycle = iconButton(
      "round-button round-button--large raised",
      "More words",
      cycleIcon(),
    );
    cycle.addEventListener("click", () => {
      if (phase !== "idle" || gestures.active) return;
      // Whatever a card or goal tap started ends here (plan 5.2).
      scope.cancel();
      stopAll();
      scope = createScope();
      run(scope, switchGroup);
    });
    view.end.append(cycle);
  }

  view.screen.setAttribute("data-mode", mode);
  root.append(view.screen);
  renderGoals();
  enterIdle();
  preload(clipsOf(round));

  return () => {
    gestures.destroy();
    stopIdleHelp();
    scope.cancel();
    stopAll();
    view.screen.remove();
  };
}

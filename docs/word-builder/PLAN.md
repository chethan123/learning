# Word Builder: implementation plan (revision 3)

A touch game for one kindergartner on an iPad or touchscreen laptop. The screen
shows a word with its first sound missing (`_at`). The child puts a tile on the
blank. A real, pictured word (`mat`) is sounded out letter by letter, spoken,
and its picture appears. Modelled on UFLI Foundations word work.

Design canvas (five screens, 1024 x 768): <https://claude.ai/artifact/VoH9BpwHMSrkvr98dojSVS>.
Source of those screens for implementers: `<scratchpad>/design/project/*.dc.html`.
Where a mockup and this plan disagree, this plan wins.

`<scratchpad>` in this file means
`/tmp/claude-1001/-home-ubuntu--t3-worktrees-learning-t3-ef9b52f1/9ce183c5-8274-4dbe-8bfe-63f884f14b34/scratchpad`
(working files of the build session, not part of the repo). It also holds the
research: `words-research.md`, `pictures-research.md`, `audio-research.md`, the
voice test `kokoro-test/`, and a machine-readable copy of section 4.2 in
`content-draft/rounds.json`.

## 1. Settled decisions

| #   | Decision                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Child is a beginner. Content follows UFLI letter order strictly: a round only uses letters and patterns taught so far.                                                                     |
| D2  | The blank is always the whole first sound of the word (its onset). The fixed part is the rest of the word from the vowel on (`_at`, `_og`, `_ock`, `_unch`).                               |
| D3  | A tile is placed by drag or by tap. Tiles are at least 80 CSS px wide at the smallest supported viewport (768 x 432) and 114 px on an iPad in portrait.                                    |
| D4  | Any tile that makes a pictured word wins, in any order. Rounds 01-10 offer only winning tiles. Later groups add hand-picked extra tiles that form no real word.                            |
| D5  | A miss is quiet, never punished. Guided rounds are the main path. A finished round can be replayed as free play (no goal, no end).                                                         |
| D6  | Pictures are generated once at development time in one style, reviewed, and bundled as static files. Nothing is generated at runtime.                                                      |
| D7  | Audio is bundled clips: one per word and one per letter sound. No browser speech synthesis.                                                                                                |
| D8  | Voice is generated locally (Kokoro-82M, Apache 2.0). Any clip can be replaced by dropping in an MP3 with the same name.                                                                    |
| D9  | Game layer: a win per word, a bigger win per round, a trail with a mascot, a sticker book. No timers, scores, lives or streaks, and no text other than the letters and words being learnt. |
| D10 | Version 1 ships 157 words in 61 rounds: 87 three-letter, 54 four-letter, 16 five-letter.                                                                                                   |
| D11 | Tiles are one letter, a digraph (`sh`, `ch`) or a two-letter blend (`fr`, `cl`, `st` ...). A digraph is one sound; a blend tile is two sounds and is drawn as two joined halves.           |
| D12 | Lowercase only, in Andika (single-storey `a` and `g`), self-hosted.                                                                                                                        |
| D13 | The child plays alone. No written instructions anywhere outside the grown-ups page.                                                                                                        |
| D14 | A placed combination is sounded out one sound at a time (/m/ /a/ /t/); a target word is then spoken whole. The fixed part is never spoken as a chunk.                                      |
| D15 | In a guided round the goal slots of the group on screen show a faint picture of each word still to find. Tapping one says the word. Free play has no goal slots.                           |
| D16 | Leaving a guided round midway keeps what was found; reopening the round resumes it.                                                                                                        |

Decisions taken without asking the user (flag in the final report):

- A1. The "shelf of finished endings" and the "trail" are one thing: a finished
  stone on the trail is the card that reopens that round in free play.
- A2. Mascot is a blue owl.
- A3. Pictures are generated for the whole list in section 4 before the user
  strikes words. Striking a word later means removing every occurrence of it
  from `rounds.ts`, deleting its picture and word clip, updating the counts in
  D10 and the tests, and restructuring any round left with fewer than 2
  targets or any group left with fewer than 2 tiles.
- A4. `six` and `ten` pictures may contain a numeral. No other picture contains
  letters or digits.
- A5. No service worker, no offline install, no accounts, no analytics.
- A6. D2, D11, D14, D15 and D16 came out of plan review and differ from what
  was discussed with the user.
- A7. A reviewer proposed speaking one target word at a time and treating any
  other real word as a miss. Rejected: the user asked for a game where any
  letter that makes a word shows its picture (D4).

## 2. Scope

In scope: one new page `src/pages/word-builder/`, its content, pictures, audio,
tests, one Node script, two Python scripts, two dev dependencies.

Out of scope: last-letter and middle-vowel puzzles, a letter-sound pre-stage,
multiple child profiles, sync between devices, speech recognition, changing any
existing page, `vite.config.ts`, `build/`, Docker or Caddy files.

Supported browsers: Safari on iPadOS 16.4 or later (in a tab and from the Home
Screen), current Chrome and Edge on Windows and ChromeOS.

## 3. Experience

### 3.1 Stage and scaling

The game screens (trail, play, sticker book) are drawn on a fixed 1024 x 768
design stage scaled to fit the viewport and centred. Every size in their CSS is
`calc(var(--u) * N)` where N is the pixel value from the design and:

```css
:root {
  --u: min(100vw / 1024, 100vh / 768);
  --u: min(100vw / 1024, 100dvh / 768);
}
```

- Stage element: `width: calc(var(--u) * 1024); height: calc(var(--u) * 768)`.
  The area outside the stage shows the screen's background colour; on the trail the grass band continues across the full viewport width at the same height.
- Smallest supported viewport: 768 x 432 (`--u` = 0.5625, tile 85 px). iPad
  portrait gives 0.75 (tile 114 px). Smaller viewports render but are not a
  target.
- `html, body`: `overflow: hidden; overscroll-behavior: none; touch-action: none;
user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
-webkit-tap-highlight-color: transparent`.
- Scrolling exists in exactly three elements. The trail strip fills the stage:
  `overflow-x: auto; touch-action: pan-x`. The sticker grid fills the stage
  below its 116 px header row (`height: calc(var(--u) * 652)`):
  `overflow-y: auto; touch-action: pan-y`. The grown-ups root is not on the
  stage: `position: fixed; inset: 0; overflow-y: auto; touch-action: pan-y;
user-select: text; -webkit-user-select: text`, unscaled CSS px, system font,
  16 px.
- `index.html` viewport meta:
  `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`.
  Also `<meta name="mobile-web-app-capable" content="yes">` and
  `<meta name="apple-mobile-web-app-capable" content="yes">`.
- `gesturestart` and `dblclick` on `document` call `preventDefault()`.
- The page does not import `src/shared/base.css`. It sets `color-scheme: light`
  and ships one `style.css`.

### 3.2 Tokens

| Token          | Value     | Use                                             |
| -------------- | --------- | ----------------------------------------------- |
| `--ink`        | `#1B2A4E` | letters, outlines, hard shadows                 |
| `--sky`        | `#DFF2FF` | play and trail background                       |
| `--tray`       | `#BFE3FB` | tray panel                                      |
| `--tile`       | `#FFD447` | movable tiles                                   |
| `--card`       | `#FFFFFF` | fixed letters, picture stickers                 |
| `--blank`      | `#FFFBE8` | the blank                                       |
| `--go`         | `#2FC27E` | play and next buttons                           |
| `--glow`       | `#FFE58A` | halo round the current stone and a new picture  |
| `--grass`      | `#BDE8B4` | trail ground                                    |
| `--locked`     | `#CFE2F2` | locked stones (dashed `#8FA6C4`)                |
| `--slot`       | `#EEF8FF` | empty goal slot (dashed `#7C93B8`)              |
| `--hole`       | `#8FB4D6` | dashed outline of an emptied tray position      |
| `--book`       | `#FFF1D6` | sticker book background                         |
| `--book-empty` | `#FFF8E8` | empty sticker (dashed `#C9A56A`, bar `#EBD3A4`) |
| `--book-btn`   | `#FF8F6B` | sticker-book button                             |
| `--quiet`      | `#5B7196` | grown-ups button                                |
| `--focus`      | `#5B8DEF` | focus ring                                      |

Confetti colours: `#FF7A59`, `#1E9E62`, `#FFD447`, `#5B8DEF`.

Every raised element has a solid `--ink` border and a hard offset shadow, no
blur, no gradients. Shadow offset in design px: 6 for 88 px buttons and goal
slots; 8 for stones and stickers; 10 for cards and tiles; 12 for the current
stone, the big picture and the go button. Pressed state: translate down by the
offset and remove the shadow. Font: Andika 700 for letters, loaded from
`@fontsource/andika/latin-700.css` and `latin-400.css`.

Where a picture URL is undefined (file not generated yet) the UI draws the same
element with a plain `--card` fill.

### 3.3 Screens and routes

Hash routes. Unknown or malformed hashes, and routes the guards refuse,
redirect to `#/` with `location.replace`.

| Route              | Screen       | Guard                          |
| ------------------ | ------------ | ------------------------------ |
| `#/`               | Trail (home) | none                           |
| `#/play/<roundId>` | Guided round | `canPlay(progress, round)`     |
| `#/free/<roundId>` | Free play    | `canFreePlay(progress, round)` |
| `#/stickers`       | Sticker book | none                           |
| `#/grown-ups`      | Grown-ups    | none                           |

#### Trail (`Trail.dc.html`)

- A horizontally scrolling strip fills the stage. Stone `i` (0-based) has its
  centre at `x = 200 + 190 * i`, `y = [470, 330, 450, 320][i % 4]` design px.
  Strip width is 12112 design px (so the last stone can be centred). Straight dotted white segments join
  consecutive centres. The two top buttons sit above the strip and do not
  scroll.
- A stone is a `<button>`. Appearance comes from `stoneStates`; whether it is
  enabled comes from the guards:
  - `done`: 132 px white circle with the picture of `coverWord(round)`.
    Enabled. Opens `#/free/<id>`. Label "Round N, finished".
  - `current`: 184 px `--go` circle with a white play triangle and a 16 px
    `--glow` halo ring that pulses (scale 1 to 1.06, 1.2 s loop). Enabled.
    Opens `#/play/<id>`. Label "Play round N".
  - `locked`: 116 px dashed `--locked` circle. Enabled only when
    `canPlay(progress, round)` (unlock-all); it then shows a small white play
    triangle and opens `#/play/<id>`. Otherwise `disabled`. Label "Round N".
- Mascot (`mascot.webp`, 112 px round sticker): its bottom edge is 8 px above
  the top of the current stone's halo. When the trail is mounted with
  `justCompleted` equal to the id of the round just before the current one,
  the mascot starts above that stone and hops to the current one (600 ms arc,
  `hop` sound), then the halo starts. In every other case it appears in place.
- On mount `scrollLeft = (x - 512) * u` for the current stone's `x`, where
  `u` is stage width / 1024, clamped to the scroll range.
- When all rounds are complete there is no current stone: the last stone is
  centred and the mascot appears above it without a hop.
- Top right: sticker-book button, 104 px. Top left: grown-ups button, 60 px,
  `--quiet`. It opens only after an unbroken 2 s press, during which a ring
  fills round it; releasing early cancels. Keyboard: Enter on it opens at once.

#### Guided round (`Main.dc.html`, `Found.dc.html`, `RoundDone.dc.html`)

Layout top to bottom:

- Top bar: home button 88 px at the left; goal slots centred, one 128 px slot
  per target word of the round, in `wordsOf(round)` order, gap 20.
- Frame, gap 20: the blank, then one card per grapheme of the fixed part
  (`graphemesOf(rest)`: `ock` is `o` + `ck`). One-letter cards are 176 x 200,
  two-letter cards 240 x 200. The blank is 240 x 200 if any winning or extra
  tile of the group has two letters, otherwise 176 x 200; it does not change
  during the group. Letter size 136. If the frame is wider than 900 it is
  scaled down uniformly to fit (a guard; the widest authored frame is 828).
- Tray panel: stage width minus 40 each side, padding 28 32 38. It holds one
  position per tile of the current group (`trayPositions(session)`: winning and
  extras, alphabetical), fixed for the whole group. A position whose tile is in
  `tray(session)` shows that tile; any other position shows a dashed `--hole`
  outline of the same size. One-letter tile 152 x 168, two-letter tile
  220 x 168, letter size 112. Gap 40 for up to four positions, 20 for five. The
  tray only ever holds the current group's tiles.
- A digraph card or tile (`sh`, `ch`, `th`, `ck`, `ll`, `ss`, `ng`) has a 10 px
  `--ink` bar under both letters. A blend tile (`fr`, `st` ...) is drawn as two
  halves joined by a 3 px `--ink` divider; each half is one letter.

Goal slots, for a word not yet found: in the group on screen, its picture at
40% opacity on `--slot` with a dashed outline (a button: tap says the word); in
other groups, an empty dashed `--slot`. A found word shows the full picture on
`--card` with a solid outline.

Phases. The play screen is always in exactly one phase. The home button is
enabled in every phase.

| Phase       | Enabled controls                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`      | tiles in `tray(session)`; fixed cards (tap says that card's sound); faint goal slots (tap says that word); in free play the cycle button |
| `sounding`  | none                                                                                                                                     |
| `reveal`    | during the hold only: the big picture (one tap replays the word; it does not extend the hold)                                            |
| `miss`      | none                                                                                                                                     |
| `switching` | none                                                                                                                                     |
| `celebrate` | the go button                                                                                                                            |

Sequence after a placement (placement switches `idle` to `sounding`
synchronously):

1. `sounding`: for each sound of the placed tile and then of each fixed card, in
   reading order, that tile half or card pulses while its sound clip plays;
   120 ms gap between sounds. (`fr` + `og` plays f, r, o, g; `sh` + `ip` plays
   sh, i, p.) Then a 250 ms gap.
2. Target word, phase `reveal`:
   - The tray fades out. The placed tile and the fixed cards scale by 0.75
     (one-letter 132 x 150, two-letter 180 x 150, gap 16) and move below a
     336 px picture sticker with a `--glow` halo in the middle of the stage
     (`Found.dc.html`). The word clip plays together with `pop`.
   - Hold: 1000 ms, starting when the word clip has settled.
   - Guided: the picture flies to its goal slot (500 ms). Then `recordFound` is
     saved, and exactly one of:
     - round finished: `completeRound` is saved, phase `celebrate` (the tray
       does not return);
     - group finished, another remains: phase `switching`: frame and tray slide
       out left, `nextGroup`, the next group slides in (400 ms), then `idle`;
     - otherwise: the blank empties, the tray fades back with that tile's
       position as a hole, then `idle`.
   - Free play: the picture fades out (300 ms), the blank empties, the tile
     returns to its position, the tray fades back, then `idle`.
3. Not a target, phase `miss`: `boop`, the tile wobbles (400 ms) and glides back
   to its tray position (300 ms), then `idle`. The tile stays available and is
   drawn at 40% opacity for the rest of the group.
4. `celebrate` (`RoundDone.dc.html`): the round's stickers in found order in one
   row (232 px each for up to 3 words, 196 for 4, 160 for 5; gap 24), three
   stars, confetti for 2.5 s, `fanfare`, and a 264 x 152 `--go` button with an
   arrow. The button calls `nav.go("#/", { justCompleted: round.id })`. Nothing
   auto-advances.

Backgrounding: when the page is hidden a running sequence is not cancelled. It
runs to its end; clips are skipped while the audio context is not running.

Help, never text:

- Until `seenDragDemo` is set: in `idle`, a hand glyph repeatedly drags a ghost
  of the alphabetically first winning tile in the tray to the blank (2 s loop).
  `setSeenDragDemo` is saved on the first placement ever.
- 8 s in `idle` with no placement: tray tiles bounce in a wave once; repeats
  every 8 s.
- `hintTile(session)` (two misses in the group): that tile gets a `--glow` halo
  until any winning placement or a group change.

Placing a tile. One active pointer; others are ignored. All of this applies
only in `idle`.

- Activation: a tile is a `<button>`. A `click` on it (finger tap, mouse click,
  Enter, Space, assistive technology) calls `place` and switches to `sounding` at once; the tile's 250 ms flight to the blank is the first step of `sounding`, before the first sound. A `click` is ignored while a drag is active or when the phase is not `idle`.
- Drag: `pointerdown` records the start point, an active-drag record and calls
  `setPointerCapture`; `tick` plays. Once the pointer has moved more than
  24 CSS px from the start, the tile follows it (scale 1.08, above everything).
  On `pointerup` after such a move, a suppress flag is set on that tile so that a `click` that follows is ignored (every `pointerdown` on a tile clears the flag, so a browser that sends no click after a drag never swallows a later tap), and the tile is placed (`place`, phase `sounding`, at once) if the distance between its centre and
  the blank's centre, in viewport CSS px, is at most 1.25 times the blank's
  rendered width; otherwise it glides back (250 ms).
- A `pointerup` without such a move activates the tile itself, exactly as a `click` would, and sets the suppress flag so that the browser's `click` for the same tap is ignored. (Chrome sends no `click` for a tap made shortly after a flicked drag; activating on `pointerup` keeps such a tap from being lost.) A `click` with no preceding `pointerdown` on that tile (keyboard, assistive technology) still activates.
- One placement at a time: an accepted click or a successful drop switches the
  phase from `idle` to `sounding` and calls `place` exactly once, synchronously,
  before any `await`. Further placements are ignored until the sequence is
  back in `idle`. After a click the first step of `sounding` is the 250 ms
  flight; after a drop the sound-out starts at once.
- Click suppression belongs to the finished drag gesture, not to the next
  activation. A `click` that arrives while the suppress flag is set on that
  tile is consumed before the phase is checked. The flag is cleared at the
  start of every `pointerdown`, on `keydown` of Enter or Space, and by any
  `click` with `detail === 0` (keyboard or assistive technology), which then
  activates normally. Do not rely on `click` being a `PointerEvent`.
- As built (after code review): every `pointerdown` on a tile, accepted or
  not, marks that tile so that exactly one following `click` is ignored; only
  the one accepted gesture can activate at `pointerup`. A cancelled or ignored
  gesture therefore never places a tile. When an accepted gesture ends without
  a placement the play screen is told, so the hand demo can return.
- Ending a drag: the active-drag record is cleared before capture is released.
  `pointercancel`, `lostpointercapture`, window `blur` and `resize` do nothing
  unless a drag is active; if one is, the tile glides back. This cleanup is
  idempotent and never changes the phase. Teardown removes an active drag at
  once with no animation.

#### Free play

The play screen with these differences: no goal slots; `tray(session)` always
holds every winning and extra tile of the group, so no holes; a target word
runs `sounding` and `reveal` as above; there is no `celebrate` phase; the hand
demo and the hint do not run; the idle bounce does. If the round has more than
one group, a 104 px round button with a circular-arrows glyph at the right of
the top bar calls `nextGroup` (wrapping) with the same 400 ms slide. Free play
never changes progress.

#### Sticker book (`Stickers.dc.html`)

Header row: home button at the left. Below it a five-column vertically
scrolling grid of all 157 words in `ALL_WORDS` order. Found word (in
`foundWords`): 160 px sticker rotated by `(sum of the word's char codes % 7) - 3`
degrees, the word in 44 px lowercase under it; tap plays the word clip and
bounces the sticker. Not found: dashed empty square and a blank bar, not a
button.

#### Grown-ups page

For an adult; text allowed:

- Link "Back to the game" (`#/`) and link "All pages" (`../../`).
- Checkbox "Unlock every round" (`setUnlockAll`).
- Button "Erase progress": first press changes its label to "Press again to
  erase"; a second press within 5 s calls `resetProgress` and goes to `#/`.
- Content review table, one row per round: number, id, letter set, then per
  group the frame (`_at`), the extra tiles, and for each word a 96 px picture
  with a button that plays its word clip. Below the table, one button per sound
  clip. This is the user's contact sheet for approving words, pictures and
  audio.

### 3.4 Audio behaviour

- One `AudioContext`. `unlockAudio()` runs on every `pointerdown`, `pointerup`,
  `click` and `keydown` on `document` (capture phase): it creates the context
  if missing and, when the state is not `running` (Safari's `suspended` and
  `interrupted` included), calls `resume()` and keeps the returned promise as
  the pending resume (a rejection is swallowed and clears it). It also runs on
  `visibilitychange` to visible. If `navigator.audioSession` exists, its `type`
  is set to `"playback"` once (the iPad mute switch then does not silence the
  game); detect it with a type guard, no casts.
- One voice at a time. A new `playClip` call stops the clip that is playing or
  loading; that earlier call resolves `false` and can never start later.
  Effects (`sfx`) are independent of the voice.
- `playClip` always settles:
  - no URL for the clip: resolves `false` at once;
  - no context: resolves `false` at once;
  - context not `running`: if a resume is pending, waits for it for at most
    500 ms; if the context is still not `running`, resolves `false`;
  - loading that takes longer than 2000 ms, a fetch or decode failure:
    resolves `false`; the clip id is reported once with `console.warn`;
  - playback that has not ended `duration + 500 ms` after start: resolves
    `false`;
  - otherwise resolves `true` when the clip ends.
- A play URL opened without any gesture is silent until the first touch; no
  sound is queued.
- Clips are fetched and decoded on demand and cached for the session. When a
  round opens, `preload(clipsOf(round))` starts loading them.
- `stopAll()` stops the voice as above.
- Sequences are cancellable through a `Scope` (section 5.2).
- Effects are synthesised with oscillators, no files: `pop` (sine 500 to 900 Hz,
  90 ms), `boop` (sine 220 to 160 Hz, 160 ms), `hop` (triangle 400 to 700 Hz,
  120 ms), `fanfare` (C5 E5 G5 C6, 130 ms each), `tick` (1 kHz, 20 ms). Effect
  gain 0.25, voice gain 1.0. Effects are silent when the context is not
  running.

### 3.5 Accessibility and motion

- Every control is a `<button>` with an `aria-label` (tile: "Tile s"; goal slot
  and sticker: the word; stones as in 3.3).
- Visible focus ring: 4 px `--focus` outline, offset 4 px.
- `prefers-reduced-motion: reduce`: no confetti, no wobble, no fly, no hop;
  elements cross-fade in 150 ms; holds and gaps keep their length.
- A visually hidden `aria-live="polite"` region receives the word when one is
  found.

## 4. Content

### 4.1 Letter sets

A round declares `letterSet`, an integer 1 to 15. It may use only letters and
patterns from sets up to and including its own. `letterSet` never decreases
from one round to the next.

| Set | Adds             | UFLI lessons |
| --- | ---------------- | ------------ |
| 1   | a m s t p        | 1-6          |
| 2   | f i n            | 7-11         |
| 3   | o d c            | 12-14        |
| 4   | u g b            | 15-17        |
| 5   | e                | 18           |
| 6   | k h r            | 22-25        |
| 7   | l w j            | 26-29        |
| 8   | y x v z          | 30-34        |
| 9   | consonant blends | 35-41        |
| 10  | ll ss            | 42-43        |
| 11  | ck               | 44           |
| 12  | sh               | 45           |
| 13  | th               | 46-47        |
| 14  | ch               | 48           |
| 15  | ng nk            | 51-52        |

Graphemes. `graphemesOf(text)` scans left to right; at each position, if the
next two letters are one of `ll ss ck sh th ch ng` they form one grapheme,
otherwise the next single letter does. (`lunch` is l, u, n, ch; `king` is k, i,
ng; `pink` is p, i, n, k; a blend tile `sk` is s, k.) Vowels are `a e i o u`;
every other grapheme is a consonant. The letter `q` is not used anywhere.

`requiredSet(word)` is the maximum of: the set of every single-letter grapheme;
the set of every two-letter grapheme (table above); 9 if any two consecutive
graphemes are both consonants; and 15 if the word contains `nk`. It throws for
a letter that is in no set. It is applied to whole combinations (tile + rest),
target words and extra-tile combinations alike.

### 4.2 Rounds

Notation: `_rest`: winning tiles `+` extra tiles. A word is tile + rest.
**Bold** marks a word that appears for the first time in that round; the others
are review. `~x~` is an extra tile.

| #   | Set | Groups                                                                                                  |
| --- | --- | ------------------------------------------------------------------------------------------------------- |
| 01  | 1   | `_at`: **m** **s** **p**                                                                                |
| 02  | 1   | `_ap`: **m** **t**                                                                                      |
| 03  | 2   | `_in`: **p** **f**                                                                                      |
| 04  | 2   | `_ap`: **n** m t                                                                                        |
| 05  | 2   | `_an`: **m** **p** **f**                                                                                |
| 06  | 3   | `_ot`: **p** **d**                                                                                      |
| 07  | 3   | `_op`: **m** **t** **p**                                                                                |
| 08  | 3   | `_ad`: **d** **s** **m**                                                                                |
| 09  | 3   | `_at`: **c** m s · `_ap`: **c** m                                                                       |
| 10  | 3   | `_an`: **c** m p f                                                                                      |
| 11  | 4   | `_ug`: **b** **m** + ~g~                                                                                |
| 12  | 4   | `_un`: **s** **b**                                                                                      |
| 13  | 4   | `_ig`: **p** **d** **b**                                                                                |
| 14  | 4   | `_og`: **d** **f** + ~g~                                                                                |
| 15  | 4   | `_ag`: **b** **t** + ~p~                                                                                |
| 16  | 4   | `_ub`: **t** **s** **c** + ~m~                                                                          |
| 17  | 4   | `_at`: **b** c · `_in`: **b** p + ~n~                                                                   |
| 18  | 4   | `_ut`: **n** **c** + ~d~ · `_ud`: **m** **b** + ~t~                                                     |
| 19  | 4   | `_up`: **c** **p** + ~b~ · `_um`: **g** + ~p~ · `_us`: **b** + ~d~                                      |
| 20  | 5   | `_en`: **p** **t** + ~n~                                                                                |
| 21  | 5   | `_et`: **n** **p**                                                                                      |
| 22  | 6   | `_at`: **h** **r** b                                                                                    |
| 23  | 6   | `_ed`: **b** **r**                                                                                      |
| 24  | 6   | `_ug`: **h** **r** b m                                                                                  |
| 25  | 6   | `_ot`: **h** p d                                                                                        |
| 26  | 6   | `_op`: **h** m · `_it`: **h** **s**                                                                     |
| 27  | 6   | `_en`: **h** p + ~n~ · `_ut`: **h** n + ~d~                                                             |
| 28  | 6   | `_un`: **r** s b                                                                                        |
| 29  | 6   | `_ip`: **r** **s** + ~m~ · `_id`: **k** + ~p~                                                           |
| 30  | 7   | `_og`: **l** d f + ~g~                                                                                  |
| 31  | 7   | `_am`: **j** **h** · `_ug`: **j** r + ~w~                                                               |
| 32  | 7   | `_et`: **w** **j** n p                                                                                  |
| 33  | 7   | `_ig`: **w** p d b + ~h~                                                                                |
| 34  | 7   | `_id`: **l** k + ~j~ · `_in`: **w** b + ~n~                                                             |
| 35  | 7   | `_ip`: **l** r s + ~b~                                                                                  |
| 36  | 7   | `_eg`: **l** + ~h~ ~w~ · `_eb`: **w** + ~m~ ~t~ · `_ib`: **b** + ~t~ ~p~                                |
| 37  | 8   | `_an`: **v** c m                                                                                        |
| 38  | 8   | `_ox`: **b** **f** + ~z~ · `_ix`: **s** **m** + ~v~                                                     |
| 39  | 8   | `_ip`: **z** l s r                                                                                      |
| 40  | 8   | `_et`: **v** w j + ~z~ · `_um`: **y** g + ~p~                                                           |
| 41  | 9   | `_and`: **h** **s** + ~v~ · `_amp`: **l** **c** + ~n~                                                   |
| 42  | 9   | `_est`: **n** **v** · `_ump`: **j** **p** + ~z~ · `_ent`: **t** + ~n~ ~y~                               |
| 43  | 9   | `_ilk`: **m** + ~n~ ~t~ · `_ift`: **g** + ~d~ ~p~ · `_esk`: **d** + ~m~ ~b~ · `_ant`: **pl** + ~m~ ~fr~ |
| 44  | 9   | `_og`: **fr** d + ~g~ · `_um`: **dr** g + ~p~ · `_ab`: **cr** + ~p~ ~pl~                                |
| 45  | 9   | `_ag`: **fl** b + ~p~ · `_ap`: **cl** c                                                                 |
| 46  | 9   | `_op`: **st** m t + ~v~ · `_in`: **sp** p + ~n~                                                         |
| 47  | 9   | `_ed`: **sl** b r + ~y~ · `_im`: **sw** + ~f~ ~z~                                                       |
| 48  | 10  | `_ell`: **b** **w** **y** + ~r~ · `_iss`: **k** + ~n~ ~v~ · `_oll`: **d** + ~v~ ~z~                     |
| 49  | 11  | `_ock`: **s** **r** **l** + ~z~                                                                         |
| 50  | 11  | `_ick`: **k** **l** **s** + ~z~ · `_uck`: **d** **tr**                                                  |
| 51  | 11  | `_ock`: **cl** **bl** s + ~z~ · `_ack`: **p** **sn** + ~v~                                              |
| 52  | 11  | `_ick`: **br** **st** k + ~z~ · `_ess`: **m** **dr** + ~v~                                              |
| 53  | 12  | `_ip`: **sh** r z + ~m~ · `_op`: **sh** h + ~v~                                                         |
| 54  | 12  | `_ish`: **f** **d** **w** + ~m~ · `_ell`: **sh** b + ~r~                                                |
| 55  | 12  | `_ash`: **c** **tr** + ~v~ · `_ush`: **br** + ~v~ ~tr~                                                  |
| 56  | 13  | `_ath`: **b** **p** + ~f~                                                                               |
| 57  | 14  | `_ip`: **ch** sh s + ~b~ · `_op`: **ch** sh + ~z~                                                       |
| 58  | 14  | `_in`: **ch** p w + ~n~ · `_ick`: **ch** k + ~z~                                                        |
| 59  | 14  | `_est`: **ch** n v · `_unch`: **l** + ~t~ ~g~ · `_ench`: **b** + ~v~ ~z~                                |
| 60  | 15  | `_ing`: **k** **r** **w** **s**                                                                         |
| 61  | 15  | `_ink`: **p** **s** **w** + ~v~ · `_unk`: **sk** **b** + ~t~                                            |

Round id is the two-digit number, a dash, and the rests joined by dashes
(`09-at-ap`). The authored data in `rounds.ts` must equal this table;
`<scratchpad>/content-draft/rounds.json` holds the same data as JSON.

### 4.3 Extra tiles

Extras are authored by hand in the table above. They are not generated. The
content test checks every one of them:

- an extra is a single letter from `m s t p f n d g b h r l w j v z y`, or two consonant letters that `graphemesOf` splits into two graphemes; it is not a winning tile of its group; a two-letter extra
  is allowed only in a group that has a two-letter winning tile;
- extra + rest is not in `ALL_WORDS`, not in the English dictionary
  (`an-array-of-english-words`), and not in the blocklist;
- a group has at most one extra, or at most two if it has exactly one winning
  tile; rounds 01-10 have none.

### 4.4 Blocklist

`content/blocklist.ts` exports exactly this list. No target word, no extra-tile
combination and no `rest` may equal an entry.

```
ass tit cock dick fuck cunt prick shit slut twat piss jizz cum muff shag knob
wank boner hell damn fat bum butt rump tush gut hag nag brat hick runt jerk
dork nerd twit suck gun shot kill stab slap smack whack punch whip slash gash
bled mob rob gag choke hang rum gin keg pub bar nip cig drug drunk bong meth
weed pus rot zit pox scab puke poop fart turd snot fap fag nig hoe sex gay god
die dead crap poo pee wee bra ded hed jip hix dix fock fuk suk fiss jiss nad
nug dum dat fot mit gud nud det mest gell sig gack pess vock fush tus zix zand
zent ved pench wid bick liss mox gop
```

The entries from `ded` on are spellings that sound like a blocked or real word
when sounded out.

### 4.5 Content validation

`validateContent(rounds: readonly Round[], dictionary: ReadonlySet<string>): readonly string[]`
returns error strings; the test expects none for the real content. Rules:

1. Round numbers are 1..61 in order; ids follow the naming rule and are unique.
2. `letterSet` is an integer 1 to 15 and never decreases. `requiredSet` of
   every target word and of every extra + rest is at most the round's
   `letterSet`.
3. Every `rest` is one vowel letter followed by one or more consonant letters,
   all from the letter sets. A `rest` appears at most once per round.
4. Every group has at least one winning tile; winning tiles are unique within a
   group. A winning tile is a single consonant letter, `sh`, `ch`, or two
   consonant letters that `graphemesOf` splits into two graphemes.
5. Every target word is 3 to 5 letters and is in the dictionary. A round has 2
   to 5 target words, all distinct. A group's winning tiles plus its extras
   number 2 to 5.
6. `introduces` is non-empty and equals, in `wordsOf` order, the round's target
   words that appear in no earlier round.
7. No target word, extra + rest, or `rest` is in the blocklist.
8. Extras obey section 4.3.
9. Introduced-word counts: 87 of length 3, 54 of length 4, 16 of length 5.

## 5. Code

### 5.1 Files

All paths below are under `src/pages/word-builder/` unless they start with
`scripts/` or `docs/`.

```
index.html                 title "Word Builder", description, viewport metas, #app
main.ts                    boot: fonts, styles, router, global audio unlock
style.css                  all styles (tokens, stage, screens, motion)
content/
  types.ts                 Tile, FrameGroup, Round, ClipKind, Clip
  letter-sets.ts           graphemesOf, requiredSet, soundId, soundsOfTile, soundsOfRest
  rounds.ts                ROUNDS (section 4.2)
  blocklist.ts             BLOCKLIST (section 4.4)
  derive.ts                wordsOf, ALL_WORDS, ALL_SOUNDS, coverWord, roundById, clipsOf
  validate.ts              validateContent
  *.test.ts
game/
  session.ts               pure round state machine
  progress.ts              pure progress model and parsing
  storage.ts               localStorage adapter
  store.ts                 the one live Progress value
  *.test.ts
audio/
  engine.ts                AudioContext, loading, playback
  sfx.ts                   synthesised effects
  engine.test.ts
assets.ts                  ids -> bundled URLs
ui/
  router.ts                pure route resolution
  scope.ts                 cancellable sequence helper
  stage.ts                 nav, mounts a screen into #app, tears the old one down
  trail.ts play.ts stickers.ts grown-ups.ts
  drag.ts                  tile activation and drag
  confetti.ts              DOM confetti
  icons.ts                 inline SVG builders (home, play, arrow, book, gear, hand, star, cycle)
  router.test.ts scope.test.ts
assets/
  pictures/<word>.webp     157 files + mascot.webp, 640 x 640
  audio/words/<word>.mp3   157 files
  audio/sounds/<id>.mp3    28 files (section 6.2)
scripts/word-builder/
  audio-manifest.ts        prints JSON of every clip the content needs
  asset-diff.ts            pure comparison of expected and actual file names
  assets.test.ts           unit test of asset-diff; skipped check of the real folders
  optimize-pictures.py     raw images -> 640 px WebP (Pillow)
  generate-audio.py        Kokoro generation
docs/word-builder/PLAN.md  this file
```

Dev dependencies added: `@fontsource/andika`, `an-array-of-english-words`.
Nothing else. The Python scripts run in a virtual environment outside the repo
and are not part of `npm run check`.

Repo rules that apply to every TypeScript file (from `AGENTS.md`): strict
TypeScript, named exports only, no `any`, no `as`, no non-null `!`, `query()`
and `h()` from `src/shared/dom.ts` instead of `querySelector` casts, relative
URLs, `#/hash` routes, TS scripts run with `tsx`. `npm run check` must pass with
zero warnings.

Module rules:

- Files in `content/`, `game/session.ts`, `game/progress.ts` and `ui/router.ts`
  are pure: no DOM, no Vite APIs. They import each other with explicit `.ts`
  extensions, so `scripts/` (NodeNext) can import them too.
- The only JSON import is the dictionary, in `content/validate.test.ts`:
  `import dictionary from "an-array-of-english-words";` then
  `new Set(dictionary)`.
- Arrays are indexed under `noUncheckedIndexedAccess`; a missing element is
  handled with a thrown `Error`, never with `!`.
- Tests that touch `document`, `localStorage` or `window` start with
  `// @vitest-environment happy-dom`.

### 5.2 Contracts

`content/types.ts`

```ts
/** A movable tile: one letter, a digraph ("sh", "ch") or a two-letter blend ("fr"). */
export type Tile = string;

export interface FrameGroup {
  /** Fixed letters shown after the blank, from the vowel on: "at", "ock", "unch". */
  readonly rest: string;
  /** Tiles that complete a target word in this group. At least one. */
  readonly winning: readonly Tile[];
  /** Tiles that form nothing (plan 4.3). */
  readonly extras: readonly Tile[];
}

export interface Round {
  /** e.g. "09-at-ap". */
  readonly id: string;
  /** 1-based position on the trail. */
  readonly number: number;
  readonly letterSet: number;
  readonly groups: readonly FrameGroup[];
  /** Target words that appear for the first time in this round. At least one. */
  readonly introduces: readonly string[];
}

export type ClipKind = "word" | "sound";

export interface Clip {
  readonly kind: ClipKind;
  /** A word, or a sound id from soundId(). */
  readonly id: string;
}
```

`content/letter-sets.ts`

```ts
export function graphemesOf(text: string): readonly string[]; // plan 4.1
export function requiredSet(word: string): number; // plan 4.1
/** Clip id of a grapheme: c and ck -> "k", ll -> "l", ss -> "s", otherwise itself. */
export function soundId(grapheme: string): string;
/** One sound per grapheme of the tile: "sh" -> ["sh"]; "fr" -> ["f", "r"]; "c" -> ["k"]. */
export function soundsOfTile(tile: Tile): readonly string[];
/** One sound per grapheme of the fixed part: "ock" -> ["o", "k"]; "ink" -> ["i", "n", "k"]. */
export function soundsOfRest(rest: string): readonly string[];
```

`content/derive.ts`

```ts
export function wordsOf(round: Round): readonly string[]; // group order, then winning order
export const ALL_WORDS: readonly string[]; // introduction order, 157 entries
export const ALL_SOUNDS: readonly string[]; // distinct sound ids used anywhere, sorted, 28 entries
export function coverWord(round: Round): string; // introduces[0]; throws if empty
export function roundById(id: string): Round | undefined;
/** Distinct clips a round can play: its words and every sound of its winning tiles, extras and rests. */
export function clipsOf(round: Round): readonly Clip[];
```

`game/session.ts` (pure)

```ts
export type Mode = "guided" | "free";

export interface Session {
  readonly round: Round;
  readonly mode: Mode;
  readonly groupIndex: number;
  /** Guided: target words of this round found so far, in order found. Free: always empty. */
  readonly found: readonly string[];
  /** Guided: misses in the current group since the last found word. Free: always 0. */
  readonly misses: number;
}

export type Outcome =
  | {
      readonly kind: "found"; // guided only
      readonly word: string;
      /** Index of the word's goal slot, i.e. its index in wordsOf(round). */
      readonly slot: number;
      readonly groupDone: boolean;
      readonly roundDone: boolean;
    }
  | { readonly kind: "shown"; readonly word: string } // free play only
  | { readonly kind: "miss" };

/**
 * Guided: `alreadyFound` (default none) are words of this round found in an
 * earlier visit; words not in the round and duplicates are ignored;
 * groupIndex is the first group with a word still to find. Throws if every
 * word is already found.
 * Free: `alreadyFound` is ignored; groupIndex 0.
 */
export function startSession(
  round: Round,
  mode: Mode,
  alreadyFound?: readonly string[],
): Session;
export function currentGroup(session: Session): FrameGroup;
/** Every tile of the current group (winning and extras), alphabetical. Fixed for the group. */
export function trayPositions(session: Session): readonly Tile[];
/**
 * Tiles that can be placed now, alphabetical. Guided: winning tiles whose word
 * is not yet found, plus extras. Free: equal to trayPositions.
 */
export function tray(session: Session): readonly Tile[];
/** Throws if the tile is not in tray(session). */
export function place(
  session: Session,
  tile: Tile,
): { readonly session: Session; readonly outcome: Outcome };
/**
 * Guided: throws if the current group still has an unfound word; otherwise
 * moves to the next later group that has an unfound word (skipping groups
 * already fully found) and resets misses; throws if there is none.
 * Free: next group, wrapping.
 */
export function nextGroup(session: Session): Session;
/**
 * Guided, misses >= 2: the alphabetically first winning tile in tray(session).
 * Otherwise undefined.
 */
export function hintTile(session: Session): Tile | undefined;
```

`place` never changes `groupIndex`. Guided: a `found` outcome appends the word
and resets `misses` to 0; a `miss` adds 1; `roundDone` is true when every word
of every group is found. Free: winning tile gives `shown`, extra gives `miss`,
the session is returned unchanged.

`game/progress.ts` (pure)

```ts
export interface RoundInProgress {
  readonly roundId: string;
  readonly found: readonly string[];
}

export interface Progress {
  readonly version: 1;
  readonly completedRounds: readonly string[];
  readonly foundWords: readonly string[];
  /** Guided rounds left unfinished, at most one entry per round. */
  readonly inProgress: readonly RoundInProgress[];
  readonly unlockAll: boolean;
  readonly seenDragDemo: boolean;
}
export const EMPTY_PROGRESS: Progress;
export function parseProgress(raw: unknown): Progress;
/** Adds the word to foundWords and to this round's inProgress entry (created if missing; other rounds' entries are kept). Idempotent. */
export function recordFound(
  progress: Progress,
  round: Round,
  word: string,
): Progress;
/** Adds the round to completedRounds and its words to foundWords; removes this round's inProgress entry. Idempotent. */
export function completeRound(progress: Progress, round: Round): Progress;
/** Words to pass to startSession for a guided visit: this round's inProgress entry's found words, else none. */
export function resumeWords(
  progress: Progress,
  round: Round,
): readonly string[];
export function setUnlockAll(progress: Progress, on: boolean): Progress;
export function setSeenDragDemo(progress: Progress): Progress;
export type StoneState = "done" | "current" | "locked";
export function stoneStates(progress: Progress): readonly StoneState[]; // one per round
export function currentRound(progress: Progress): Round | undefined; // first not completed
export function canPlay(progress: Progress, round: Round): boolean;
export function canFreePlay(progress: Progress, round: Round): boolean;
```

`parseProgress`: if `raw` is not an object with `version === 1`, return
`EMPTY_PROGRESS`. Otherwise read each field on its own: a field of the wrong
type takes its `EMPTY_PROGRESS` value; array entries that are not strings, are
not known round ids or words, or are duplicates are dropped, keeping first
occurrences in order; `inProgress` that is not an array becomes `[]`; an entry is kept only if its round exists, is not completed, it is the first entry for that round, and its `found` (after dropping words that are not in the round, and duplicates) holds at least one and not all of that round's words.

`stoneStates`: completed rounds are `done`; the first round not completed is
`current`; the rest are `locked`. `unlockAll` does not change `stoneStates`.
`canPlay` is true for the current round, and for every round that is not
completed when `unlockAll` is on. `canFreePlay` is true for completed rounds.
A completed round is never guided again.

`game/storage.ts`

```ts
export function readStoredProgress(): Progress; // key "word-builder:v1"; any failure -> EMPTY_PROGRESS
export function writeStoredProgress(progress: Progress): void; // failures are swallowed
export function eraseStoredProgress(): void; // failures are swallowed
```

`game/store.ts` owns the live value. Screens never read storage directly.

```ts
export function getProgress(): Progress; // reads storage once, on first call
export function updateProgress(
  change: (current: Progress) => Progress,
): Progress; // sets, then writes best-effort
export function resetProgress(): void; // EMPTY_PROGRESS, erases storage
```

`assets.ts`

```ts
/** Throws if word is not in ALL_WORDS; undefined while its file does not exist. */
export function pictureUrl(word: string): string | undefined;
export const MASCOT_URL: string | undefined;
export function clipUrl(clip: Clip): string | undefined;
```

Built with
`import.meta.glob<string>("./assets/pictures/*.webp", { eager: true, query: "?url&no-inline", import: "default" })`
and the same for `./assets/audio/**/*.mp3`, so every file is emitted
content-hashed under `dist/assets/` (never inlined) and cached as immutable by
the existing Caddy config. Empty folders give empty maps.

`audio/engine.ts`

```ts
export function unlockAudio(): void;
export function preload(clips: readonly Clip[]): void;
/** Always resolves (plan 3.4): true if the clip played to its end, false otherwise. */
export function playClip(clip: Clip): Promise<boolean>;
export function stopAll(): void;
```

`audio/sfx.ts`: `export function sfx(name: "pop" | "boop" | "hop" | "fanfare" | "tick"): void;`

`ui/scope.ts`

```ts
export interface Scope {
  readonly cancelled: boolean;
  /** Resolves after ms, or at once if cancelled. */
  sleep(ms: number): Promise<void>;
  /** Runs element.animate(...); resolves when it finishes or the scope is cancelled (the animation is then cancelled). Never rejects. */
  animate(
    element: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ): Promise<void>;
  /** Pending sleeps and animations resolve; cancelled becomes true. */
  cancel(): void;
}
export function createScope(): Scope;
```

Rules for every `async` sequence in `ui/`:

- The sequence takes its `Scope` as a `const` at entry and uses only that
  instance. After each `await`, and before every save, it returns if that
  scope is cancelled.
- The play screen holds one current scope. Teardown cancels it and calls
  `stopAll()`. The free-play cycle button cancels it, calls `stopAll()` and
  makes a fresh one for later sequences. The guided group switch is the last
  step of the running sequence and cancels nothing.

`ui/router.ts` (pure)

```ts
export type Route =
  | { readonly screen: "trail" }
  | { readonly screen: "play"; readonly round: Round }
  | { readonly screen: "free"; readonly round: Round }
  | { readonly screen: "stickers" }
  | { readonly screen: "grown-ups" };
/** Applies the guards of 3.3. */
export function resolveRoute(
  hash: string,
  progress: Progress,
): Route | { readonly redirect: "#/" };
```

`ui/stage.ts`

```ts
export type Teardown = () => void;
export interface Nav {
  go(hash: string, options?: { readonly justCompleted: string }): void;
}
export function createNav(): Nav;
/** Listens for hashchange, resolves the route, tears down the old screen and mounts the new one. */
export function startRouter(root: HTMLElement, nav: Nav): void;
```

`go` keeps `justCompleted` in a module variable and sets `location.hash` (a
history push). The next screen mount of any kind takes the value and clears it;
only `mountTrail` receives it. A redirect, a reload and history navigation
therefore never replay the hop.

Each screen module exports one mount function returning a `Teardown` that
removes listeners and timers, cancels its scope and stops audio:
`mountTrail(root, nav, justCompleted: string | undefined)`,
`mountPlay(root, nav, round, mode)`, `mountStickers(root, nav)`,
`mountGrownUps(root, nav)`.

### 5.3 Tests

Vitest, colocated `*.test.ts`. Required:

- `content/validate.test.ts`: real content plus the dictionary yields no errors;
  one failing fixture per rule in 4.5, including a `rest` that starts with a
  consonant (`p` + `lant`) and the same word twice in a round (`cl` + `ock`
  and `c` + `lock`).
- `content/letter-sets.test.ts`: `graphemesOf`, `requiredSet`, `soundsOfTile`,
  `soundsOfRest` for `mat`, `frog`, `ship`, `sock`, `bell`, `lunch`, `skunk`,
  `king`, `pink`, `box`.
- `content/derive.test.ts`: 61 rounds, 157 words, 28 sounds, `coverWord`,
  `clipsOf` for round 44.
- `game/session.test.ts`: found (with `slot`), miss, group and round completion,
  `trayPositions` versus `tray` in both modes, hint after two misses and its
  reset by a found word, resume with `alreadyFound` (including round 43 resumed with only `gift` found: after `milk` the next group is `_esk`), free mode never yields
  `found` and never changes the session, `place` with a tile outside the tray
  throws, `nextGroup` errors.
- `game/progress.test.ts`: parse of garbage and of each malformed field,
  unknown ids dropped, idempotent changes, `recordFound` then `resumeWords`,
  `completeRound` removing only its own `inProgress` entry, two unlocked rounds left half-finished and both resumed, stone states at start, middle and end,
  guards with and without `unlockAll`.
- `game/storage.test.ts` and `game/store.test.ts`: round trip, corrupt JSON,
  storage that throws on read and on write (live value survives).
- `audio/engine.test.ts`: `playClip` resolves `false` at once when no context
  exists and when `clipUrl` is undefined.
- `ui/router.test.ts`: every route, malformed hashes, guard redirects.
- `ui/scope.test.ts`: sleep resolves on cancel; a continuation that kept its
  own scope sees `cancelled` after the screen replaced its current scope.
- `scripts/word-builder/assets.test.ts`: a unit test of
  `assetDiff(expected: readonly string[], actual: readonly string[])` returning
  `{ missing, unexpected }`; and a suite written as `describe.skip` that
  compares the real folders: `pictures/` holds exactly `<word>.webp` for
  `ALL_WORDS` plus `mascot.webp`; `audio/words/` exactly `<word>.mp3` for
  `ALL_WORDS`; `audio/sounds/` exactly `<id>.mp3` for `ALL_SOUNDS`; every file
  non-empty. The orchestrator changes `describe.skip` to `describe` after all
  pictures and audio have landed.

## 6. Assets

### 6.1 Pictures

- One file per word: `assets/pictures/<word>.webp`, 640 x 640, WebP quality 82,
  white background, plus `mascot.webp`.
- The picture illustrates the spoken word; the game always says the word, so
  the picture does not have to be nameable without it. It must still be a fair,
  unambiguous illustration and must not look like another word's picture.
- Prompt template, identical for every picture:
  "A simple, friendly children's picture-book illustration of {subject}, bold
  smooth dark navy outlines, flat bright colours, centred, plain white
  background, no text, no letters, no numbers, no shadows."
  Style references passed with every request:
  `<scratchpad>/imagegen-test/cat.png` and `sat.png`.
- Subjects. Rules: one main thing; nothing that carries writing (signs, labels,
  book titles, clock numerals, map names); the meaning a US five-year-old meets
  first. A word that is a countable everyday object or animal and is not in
  this table uses "a {word}" (`pig`, `sun`, `bus`, `sock`, `duck`, `truck`).
  Every other word has a row:

  | Word   | Subject                                                              |
  | ------ | -------------------------------------------------------------------- |
  | mat    | a plain striped floor mat in front of a door                         |
  | rug    | a round patterned rug with fringe                                    |
  | sat    | a child who has sat down on a wooden chair                           |
  | sit    | a child sitting cross-legged on the floor                            |
  | kid    | a happy child standing with arms up                                  |
  | man    | a man in a suit waving                                               |
  | dad    | a father carrying his child on his shoulders                         |
  | pat    | a hand gently patting a horse's neck                                 |
  | pet    | a hamster in its cage                                                |
  | cat    | a cat sitting                                                        |
  | dog    | a grown dog standing                                                 |
  | pup    | a tiny puppy in a basket                                             |
  | tap    | a finger tapping a tablet screen                                     |
  | sink   | a bathroom sink basin full of soapy bubbles                          |
  | nap    | a child napping under a blanket on a sofa                            |
  | bed    | an empty made bed with a pillow                                      |
  | sick   | a child with a thermometer in the mouth and an ice pack              |
  | sad    | a child with a sad face and one tear                                 |
  | mad    | a child frowning with crossed arms and red cheeks                    |
  | map    | a folded paper treasure map with islands and a dotted path, no words |
  | bat    | a flying bat (the animal)                                            |
  | can    | a plain tin can with no label                                        |
  | fan    | an electric desk fan                                                 |
  | fin    | a shark fin above the waves                                          |
  | cap    | a baseball cap seen from the side                                    |
  | hat    | a woolly winter hat with a pompom                                    |
  | pan    | an empty frying pan with a long handle                               |
  | pot    | a tall cooking pot with two handles and a lid                        |
  | lid    | a jar with its lid being lifted off                                  |
  | pin    | a closed safety pin                                                  |
  | bin    | an empty plastic storage bin with handles                            |
  | box    | a closed cardboard box                                               |
  | bag    | a brown paper grocery bag                                            |
  | pack   | a school backpack                                                    |
  | trash  | a metal trash can with rubbish poking out                            |
  | win    | a gold trophy cup with a first-place ribbon                          |
  | big    | a huge elephant next to a tiny mouse                                 |
  | dig    | a dog digging a hole in a garden                                     |
  | hit    | a baseball bat hitting a ball                                        |
  | kick   | a foot kicking a football                                            |
  | hot    | a steaming bowl of soup with wavy heat lines                         |
  | camp   | a campfire with marshmallows on sticks                               |
  | tent   | a triangular tent                                                    |
  | pop    | a balloon popping                                                    |
  | top    | a spinning top toy                                                   |
  | dot    | one big blue dot in the middle of a white card                       |
  | bug    | a green beetle                                                       |
  | run    | a child running fast                                                 |
  | hop    | a rabbit hopping                                                     |
  | jump   | a child jumping over a rope                                          |
  | hug    | two children hugging                                                 |
  | kiss   | a mother kissing a baby on the cheek                                 |
  | cup    | a plastic cup with a straw                                           |
  | mug    | an empty mug with a handle                                           |
  | sip    | a child sipping from a glass through a straw                         |
  | milk   | a glass of milk                                                      |
  | tub    | an empty bathtub                                                     |
  | bath   | a child in a bubble bath wearing a shower cap                        |
  | wet    | a soaked dog dripping water                                          |
  | bud    | a green flower bud on a stem                                         |
  | plant  | a leafy plant in a pot                                               |
  | nut    | an acorn and a walnut                                                |
  | bun    | a round bread bun                                                    |
  | ham    | a whole cooked ham on a plate                                        |
  | tag    | a blank paper gift tag on a string                                   |
  | jam    | a jar of strawberry jam with no label                                |
  | gum    | a child blowing a pink bubble-gum bubble                             |
  | yum    | a child licking their lips at a slice of cake                        |
  | mix    | a spoon stirring batter in a bowl                                    |
  | cut    | scissors cutting a paper strip in two                                |
  | rip    | a sheet of paper torn in two                                         |
  | zip    | a zipper half done up on a jacket                                    |
  | sub    | a yellow submarine underwater                                        |
  | cub    | a bear cub                                                           |
  | hut    | a small straw hut                                                    |
  | well   | a stone water well with a bucket                                     |
  | pen    | a blue ballpoint pen                                                 |
  | net    | a butterfly net                                                      |
  | jet    | a passenger jet plane                                                |
  | vet    | a vet with a stethoscope checking a rabbit                           |
  | six    | a large numeral 6 with six dots                                      |
  | ten    | a large numeral 10 above ten dots                                    |
  | red    | a splash of red paint                                                |
  | pink   | a pink flamingo                                                      |
  | lip    | a smiling mouth with red lips                                        |
  | chin   | a face in profile with an arrow pointing to the chin                 |
  | mud    | a muddy puddle with boot prints                                      |
  | fog    | a tree half hidden in grey fog                                       |
  | sand   | a small heap of beach sand with a spade                              |
  | pump   | a bicycle air pump                                                   |
  | desk   | a school desk with a chair                                           |
  | bench  | a park bench                                                         |
  | stop   | a red eight-sided road sign showing a white hand, no letters         |
  | spin   | a pinwheel toy spinning                                              |
  | clap   | two hands clapping with motion lines                                 |
  | swim   | a child swimming in a pool                                           |
  | sing   | a child singing with music notes                                     |
  | yell   | a child yelling with hands cupped round the mouth                    |
  | lick   | a child licking an ice-cream cone                                    |
  | wink   | a smiling face winking one eye                                       |
  | wish   | a child blowing out birthday candles                                 |
  | mess   | a floor covered in scattered toys and spilled paint                  |
  | lock   | a brass padlock                                                      |
  | rock   | a grey boulder                                                       |
  | stick  | a brown tree stick                                                   |
  | brick  | a red clay brick                                                     |
  | block  | wooden toy building blocks with no letters                           |
  | clock  | a twin-bell alarm clock with tick marks and no numerals              |
  | chip   | a pile of potato chips                                               |
  | chop   | a knife chopping a carrot on a board, hands only                     |
  | shop   | a small shop front with a striped awning and no sign                 |
  | cash   | a few green banknotes and gold coins with no numbers                 |
  | chest  | a wooden treasure chest full of gold coins                           |
  | chick  | a yellow baby chick                                                  |
  | shell  | a seashell                                                           |
  | dish   | an empty dinner plate with a rim                                     |
  | brush  | a hairbrush                                                          |
  | ring   | a gold finger ring                                                   |
  | wing   | a bird's feathered wing                                              |
  | bunk   | a bunk bed with a ladder                                             |
  | king   | a king with a gold crown and a red cape                              |
  | lunch  | an open lunchbox with a sandwich and an apple                        |
  | snack  | a small plate of crackers and apple slices                           |
  | path   | a winding garden path between flowers                                |
  | hand   | an open hand showing five fingers                                    |
  | leg    | a bare leg with a sock and shoe, arrow pointing to the leg           |
  | web    | a spider web                                                         |
  | vest   | a sleeveless padded vest                                             |
  | flag   | a plain red flag on a pole                                           |
  | mascot | a small friendly blue owl standing and waving                        |

- Generation is done by agents that have an image tool. Each agent, per word:
  generate, look at the result, and regenerate (at most three tries) if it
  shows any letter or digit not allowed by A4, a cropped subject, a second
  thing that competes with the subject, or anything frightening. A word that
  fails three times is reported, not shipped.
- Each agent writes raw output to its own folder
  `<scratchpad>/pictures-raw/<agent>/<word>.png|jpg`. The agent for words
  1-55 of `ALL_WORDS` also makes `mascot`.
- `python scripts/word-builder/optimize-pictures.py <rawDir> <outDir>` writes
  `<word>.webp` for every image in `rawDir` and skips words that already have a
  file unless `--force`. Only the orchestrator runs it, once per raw folder.
- Independent check after generation: a different agent looks at every WebP
  knowing the word, and reports any picture that contains text, is not a fair
  illustration of the word, or looks like another word's picture. Reported
  pictures are regenerated once with a sharper subject line, or the word is
  reported to the user.

### 6.2 Audio

The feasibility test in `<scratchpad>/kokoro-test/` (read its `generate.py` and
`setup.sh` first) proved the environment, the voice, MP3 output, whole words,
and the carrier-and-cut method for six sounds (`m s a t p k`). Extending that
method to all 28 sounds is part of WP6 and is not yet proven.

- Environment: Python 3.12 through `uv`, `kokoro 0.9.4`, `misaki 0.9.4`, CPU
  `torch` from `https://download.pytorch.org/whl/cpu`, `soundfile`. No ffmpeg.
  The existing environment at `<scratchpad>/kokoro-test/venv` may be reused.
- Voice `af_heart`, speed 1.0 (slower speeds add a spurious sound before every
  clip).
- Output: mono MP3, 64 kbps constant, 24 kHz, written with `soundfile`
  (`compression_level=0.62, bitrate_mode="CONSTANT"`), silence trimmed to 20 ms
  at both ends.
- `tsx scripts/word-builder/audio-manifest.ts` prints
  `{ "words": [...], "sounds": [...] }` from the content.
- `generate-audio.py --manifest <file> --out src/pages/word-builder/assets/audio`
  generates missing clips only.
- Words: `audio/words/<word>.mp3`, synthesised from the plain word,
  peak-normalised to -1 dBFS. Exception: `dog`, `fog`, `log`, `frog` are
  synthesised from phonemes with the same vowel as the `o` sound clip
  (`dˈɑɡ`, `fˈɑɡ`, `lˈɑɡ`, `fɹˈɑɡ`), so the word matches its sounding-out.
- Sounds: 28 clips, `audio/sounds/<id>.mp3`, ids
  `a b ch d e f g h i j k l m n ng o p r s sh t th u v w x y z`. A bare phoneme
  is not usable from this model. Each sound is synthesised inside a short
  carrier syllable and cut out. The script holds one explicit table entry per
  id: carrier phoneme string, kind, and cut method.

  | Kind          | Ids             | Method                                                                  | Peak     |
  | ------------- | --------------- | ----------------------------------------------------------------------- | -------- |
  | vowel         | a e i o u       | short vowel alone (`ˈæ ˈɛ ˈɪ ˈɑ ˈʌ`), voiced run, 220-280 ms            | -3 dBFS  |
  | stop          | p t k b d g     | carrier with `ɑ`; keep the burst, cut before voicing onset of the vowel | -10 dBFS |
  | fricative     | s f z v sh th h | carrier; keep the consonant, 130-300 ms (`th` is unvoiced `θ`)          | -8 dBFS  |
  | affricate     | ch j            | carrier; keep burst plus frication                                      | -8 dBFS  |
  | nasal, liquid | m n l r         | carrier; crossfaded pitch-period loop of the consonant to about 350 ms  | -3 dBFS  |
  | coda nasal    | ng              | carrier `ˈɪŋ`; keep the nasal after the vowel, looped to about 350 ms   | -3 dBFS  |
  | glide         | w y             | carrier with `ɑ`; keep the glide up to the vowel onset                  | -6 dBFS  |
  | cluster       | x (`ks`)        | carrier `ˈɑks`; keep from the start of the `k` closure to the end       | -8 dBFS  |

  Where the test's energy heuristics cannot find the boundary (voiced stops and
  fricatives, `h`, glides, `ng`), use the model's own predicted token durations
  to locate the segment (prototype in `<scratchpad>/kokoro-test/kk.py`).

- WP6 deliverables: the script compiles (`python -m py_compile`); a full run
  writes every clip in the manifest; a table with one line per sound giving
  duration, voiced fraction and the recogniser's reading where one is
  available; and an explicit list of sounds the agent judges unusable. Files
  for unusable sounds are still written (best attempt) so the game runs, and
  the list goes to the user.
- A human must listen. The user checks clips on the grown-ups page and replaces
  any bad one with their own MP3 recording under the same file name. The stop
  sounds are the likeliest to need this.

## 7. Work packages

The orchestrator does WP0, runs the picture optimiser, lifts the asset-test
skip, and runs the final automated acceptance. Each package owns the files
listed and edits no others.

All packages work in the same checkout, so a package cannot expect the whole of
`npm run check` to be green while others are mid-flight. A package verifies its
own paths: `npx prettier --check`, `npx eslint --max-warnings 0`,
`npx vitest run` on its folders, and `npx tsc -b` with no errors in files it
owns. It reports errors it sees in files it does not own instead of fixing
them. The orchestrator runs the full `npm run check` at each join: after WP0,
after WP1, after WP2 and WP3, after WP4, and at the end.

| WP  | Owner              | Files                                                                                                                      | Needs |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----- |
| 0   | orchestrator       | `npm ci`; two dev deps; `npm run new -- word-builder --title "Word Builder"`; `content/types.ts`; `assets/pictures/*.webp` | -     |
| 1   | coding agent       | `content/*` except `types.ts`; `scripts/word-builder/audio-manifest.ts`                                                    | WP0   |
| 2   | coding agent       | `game/*`                                                                                                                   | WP1   |
| 3   | coding agent       | `audio/*`; `assets.ts`; `scripts/word-builder/asset-diff.ts`, `assets.test.ts`, `optimize-pictures.py`                     | WP1   |
| 4   | UI agent           | replaces the scaffold's `index.html`, `main.ts`, `style.css`; `ui/*`                                                       | WP1-3 |
| 5   | three image agents | raw pictures for `ALL_WORDS` split 1-55, 56-110, 111-157 (+ mascot with the first)                                         | WP1   |
| 6   | coding agent       | `scripts/word-builder/generate-audio.py`; `assets/audio/*`                                                                 | WP1   |
| 7   | reviewers          | code review; picture check (6.1); browser run-through (section 8)                                                          | all   |

WP2, WP3, WP5 and WP6 run in parallel after WP1. WP4 starts when WP2 and WP3
have joined; it builds against whatever pictures exist (3.2).

## 8. Acceptance

Automated, run by the orchestrator at the end: `npm run check`; the real-folder
assets suite with its skip removed; `npm run build`, after which `dist/assets/`
holds 158 hashed `.webp` and 185 hashed `.mp3` files (fewer only if two source files are byte-identical) and no JS chunk contains
`data:image/webp` or `data:audio`.

Checked by WP7 in a desktop browser at 1024 x 768 with touch emulation, and at
768 x 432:

1. Fresh storage: the trail shows stone 1 as current and 60 locked; one tap on
   stone 1 starts round 01.
2. Round 01 can be finished with taps only and with drags only; each word is
   sounded out, spoken, shows its picture, and fills its goal slot.
3. Finishing a round shows the celebration; the go button returns to the trail;
   the mascot hops; the next stone is current; reloading keeps that state and
   does not replay the hop.
4. A finished stone opens free play; nothing in free play changes progress.
5. In round 11 the extra tile produces the quiet miss, returns to the tray and
   dims; a second miss puts the halo on a winning tile.
6. Leaving round 09 after two words and reopening it resumes with those two
   slots filled. The sticker book shows them.
7. The grown-ups page opens only after a 2 s hold, lists all 61 rounds with
   pictures and clip buttons, and can unlock all rounds and erase progress.
8. Round 33 (five tiles), round 51 (widest tray, 864), round 43 (widest frame,
   four groups) and round 50 (five targets) fit the stage at both sizes.
9. Leaving a round in the middle of a sound-out leaves no sound playing and no
   error in the console.
10. `dist/` works from a sub-folder: copy `dist/` to `<tmp>/sub/`, serve
    `<tmp>` with `python3 -m http.server`, open `/sub/pages/word-builder/`.

Checked by the user on a real iPad, reported as unverified until then: no page
scroll, zoom, text selection or callout on the play screen; sound starts on the
first touch, survives backgrounding and the mute switch; Home Screen mode;
portrait and landscape.

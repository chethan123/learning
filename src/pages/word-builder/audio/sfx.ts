import { audioContextIfRunning } from "./engine.ts";

function note(
  context: AudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  start: number,
  duration: number,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.linearRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.25, start);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + duration);
}

export function sfx(name: "pop" | "boop" | "hop" | "fanfare" | "tick"): void {
  const context = audioContextIfRunning();
  if (context === undefined) return;
  const start = context.currentTime;
  switch (name) {
    case "pop":
      note(context, "sine", 500, 900, start, 0.09);
      break;
    case "boop":
      note(context, "sine", 220, 160, start, 0.16);
      break;
    case "hop":
      note(context, "triangle", 400, 700, start, 0.12);
      break;
    case "fanfare":
      [523.251, 659.255, 783.991, 1046.502].forEach((frequency, index) => {
        note(context, "sine", frequency, frequency, start + index * 0.13, 0.13);
      });
      break;
    case "tick":
      note(context, "sine", 1000, 1000, start, 0.02);
      break;
  }
}

// src/achievements/confetti.js
import confetti from "canvas-confetti";

export function burst() {
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.2 } });
  setTimeout(() => confetti({ particleCount: 50, spread: 100, origin: { y: 0.2 } }), 200);
}

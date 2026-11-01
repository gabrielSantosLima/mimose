import { APP_CONFIG } from "../config.js";

export function createTimeline(reducedMotion) {
  return {
    hold: reducedMotion ? 0.1 : APP_CONFIG.holdSeconds,
    duration: reducedMotion
      ? APP_CONFIG.reducedMotionSeconds
      : APP_CONFIG.morphSeconds,
  };
}

export function progressAt(elapsed, timeline) {
  if (elapsed <= timeline.hold) return 0;
  return Math.min(1, (elapsed - timeline.hold) / timeline.duration);
}

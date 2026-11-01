export const APP_CONFIG = Object.freeze({
  sourceMaxSize: 2048,
  analysisMaxSize: 512,
  maxFileSize: 25 * 1024 * 1024,
  maxDevicePixelRatio: 2,
  pairRandomness: 0.175,
  targetCoverage: 1.12,
  contrastTargetSpread: 0.28,
  contrastBoost: 2.2,
  contrastTargetInfluence: 0.8,
  holdSeconds: 0.6,
  morphSeconds: 7.2,
  reducedMotionSeconds: 1.4,
});

export function chooseParticleBudget() {
  const mobile =
    window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720;
  const memory = navigator.deviceMemory ?? 8;

  if (mobile) return memory <= 4 ? 18000 : 32000;
  return memory <= 4 ? 45000 : 80000;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

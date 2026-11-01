import {
  APP_CONFIG,
  chooseParticleBudget,
  prefersReducedMotion,
} from "./config.js";
import { containRect } from "./gl/layout.js";
import { createRenderer } from "./gl/renderer.js";
import { decodeImageFile } from "./image/decode.js";
import { buildSourceTiles } from "./image/source-tiles.js";
import { pairTiles } from "./particles/pair.js";
import { createTimeline, progressAt } from "./particles/timeline.js";
import { analyzeReference, sampleTargets } from "./reference/analyze.js";
import {
  applyTranslations,
  getLanguage,
  initI18n,
  setLanguage,
  t,
} from "./i18n.js";
import {
  loadManifest,
  loadReferenceBitmap,
  pickReference,
  referenceUrl,
} from "./reference/manifest.js";

const pageMain = document.querySelector("main");
const input = document.querySelector("#image-input");
const dropzone = document.querySelector("#dropzone");
const preview = document.querySelector("#preview");
const previewImage = document.querySelector("#preview-image");
const previewName = document.querySelector("#preview-name");
const previewSize = document.querySelector("#preview-size");
const clearButton = document.querySelector("#clear-button");
const status = document.querySelector("#status");
const referenceStatus = document.querySelector("#reference-status");
const stage = document.querySelector("#stage");
const stageCanvas = document.querySelector("#stage-canvas");
const stageFallback = document.querySelector("#stage-fallback");
const stageClose = document.querySelector("#stage-close");
const replayButton = document.querySelector("#replay-button");
const stageStatus = document.querySelector("#stage-status");
const stageReference = document.querySelector("#stage-reference");
const settings = document.querySelector("#settings");
const settingsToggle = document.querySelector("#settings-toggle");
const settingsPanel = document.querySelector("#settings-panel");
const languageSelect = document.querySelector("#language-select");

let previewUrl = null;
let manifest = [];
let lastReference = null;
let activeRun = null;
let requestId = 0;
let resizeFrame = 0;
let fallbackTimer = 0;
let statusState = { key: "upload.waiting", tone: "idle", params: {} };
let referenceState = { key: "footer.referencesLoading", params: {} };
let stageStatusKey = "stage.breaking";
const referenceCache = new Map();

init();

async function init() {
  initI18n();
  setupSettings();
  setupUpload();
  setupGlow();
  languageSelect.value = getLanguage();
  applyTranslations();
  refreshDynamicCopy();

  stageClose.addEventListener("click", closeStage);
  replayButton.addEventListener("click", replay);
  window.addEventListener("resize", handleResize);
  stageCanvas.addEventListener("webglcontextlost", handleContextLost);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !stage.hidden) closeStage();
  });

  try {
    manifest = await loadManifest();
    setReferenceStatus("footer.referencesReady", { count: manifest.length });
  } catch (error) {
    console.error(error);
    setReferenceStatus("footer.referencesUnavailable");
  }
}

function setupSettings() {
  settingsToggle.addEventListener("click", () => {
    setSettingsOpen(settingsPanel.hidden);
  });

  languageSelect.addEventListener("change", () => {
    setLanguage(languageSelect.value);
    applyTranslations();
    refreshDynamicCopy();
    setSettingsOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (settingsPanel.hidden || settings.contains(event.target)) return;
    setSettingsOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || settingsPanel.hidden) return;
    setSettingsOpen(false);
    settingsToggle.focus();
  });
}

function setSettingsOpen(open) {
  settingsPanel.hidden = !open;
  settingsToggle.setAttribute("aria-expanded", String(open));
}

function setupGlow() {
  const root = document.documentElement;
  const smoothing = prefersReducedMotion() ? 1 : 0.16;
  let targetX = 12;
  let targetY = 8;
  let currentX = targetX;
  let currentY = targetY;
  let frame = 0;

  const tick = () => {
    frame = 0;
    currentX += (targetX - currentX) * smoothing;
    currentY += (targetY - currentY) * smoothing;

    root.style.setProperty("--glow-x", `${currentX.toFixed(3)}%`);
    root.style.setProperty("--glow-y", `${currentY.toFixed(3)}%`);

    if (
      Math.abs(targetX - currentX) > 0.01 ||
      Math.abs(targetY - currentY) > 0.01
    ) {
      frame = requestAnimationFrame(tick);
    }
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      targetX = (event.clientX / Math.max(1, window.innerWidth)) * 100;
      targetY = (event.clientY / Math.max(1, window.innerHeight)) * 100;

      if (!frame) frame = requestAnimationFrame(tick);
    },
    { passive: true }
  );
}

function refreshDynamicCopy() {
  status.textContent = t(statusState.key, statusState.params);
  status.dataset.tone = statusState.tone;
  referenceStatus.textContent = t(referenceState.key, referenceState.params);

  if (!stage.hidden) {
    stageStatus.textContent = t(stageStatusKey);
    if (stageReference.dataset.revealed !== "true") {
      stageReference.textContent = t("stage.suspense");
    }
  }
}

function setupUpload() {
  input.addEventListener("change", () => {
    handleFile(input.files[0]);
  });

  for (const eventName of ["dragenter", "dragover"]) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  }

  dropzone.addEventListener("drop", (event) => {
    handleFile(event.dataTransfer.files[0]);
  });

  clearButton.addEventListener("click", () => {
    input.value = "";
    input.click();
  });
}

async function handleFile(file) {
  if (!file) return;

  if (file.type && !file.type.startsWith("image/")) {
    setStatus("status.fileType", "error");
    return;
  }

  if (file.size > APP_CONFIG.maxFileSize) {
    setStatus("status.tooLarge", "error");
    return;
  }

  const token = ++requestId;
  showPreview(file);
  setStatus("upload.preparing", "ready");

  try {
    if (manifest.length === 0) {
      manifest = await loadManifest();
      setReferenceStatus("footer.referencesReady", { count: manifest.length });
    }

    const referenceName = pickReference(manifest, lastReference);
    const source = await decodeImageFile(file);
    if (token !== requestId) return;

    const sourceData = buildSourceTiles(source, chooseParticleBudget());
    if (token !== requestId) return;

    const reference = await loadReferenceBitmap(referenceName);
    if (token !== requestId) return;

    let analysis = referenceCache.get(referenceName);
    if (!analysis) {
      analysis = analyzeReference(reference);
      referenceCache.set(referenceName, analysis);
    }

    const targets = sampleTargets(analysis, sourceData.tiles.length);
    const particles = pairTiles(
      sourceData.tiles,
      targets,
      APP_CONFIG.pairRandomness
    );

    if (token !== requestId) return;

    lastReference = referenceName;
    openStage({
      ...sourceData,
      reference,
      referenceName,
      referenceWidth: analysis.width,
      referenceHeight: analysis.height,
      particles,
    });
  } catch (error) {
    if (token !== requestId) return;
    console.error(error);
    setStatus("status.error", "error");
  }
}

function showPreview(file) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);

  previewUrl = URL.createObjectURL(file);
  previewImage.src = previewUrl;
  previewImage.alt = `Preview of ${file.name}`;
  previewName.textContent = file.name;
  previewSize.textContent = `${formatBytes(file.size)} · ${formatType(file.type)}`;
  preview.hidden = false;
  dropzone.classList.add("is-filled");
}

function openStage(data) {
  disposeRun();
  clearTimeout(fallbackTimer);
  setSettingsOpen(false);

  stage.hidden = false;
  stageCanvas.hidden = false;
  stageFallback.hidden = true;
  stageFallback.replaceChildren();
  document.body.classList.add("is-morphing");
  pageMain.inert = true;
  setStageSuspense();
  setStageStatus("stage.breaking");
  replayButton.hidden = true;
  stageClose.focus({ preventScroll: true });

  let renderer = null;
  try {
    renderer = createRenderer(stageCanvas);
  } catch (error) {
    console.error(error);
  }

  if (!renderer) {
    showFallback(data);
    return;
  }

  const run = {
    ...data,
    renderer,
    raf: 0,
    startedAt: 0,
    timeline: createTimeline(prefersReducedMotion()),
    finished: false,
  };

  try {
    activeRun = run;
    resizeStage(run);
    renderer.setSourceTexture(data.canvas);
    renderer.setParticles(data.particles);
    renderer.setMotion(prefersReducedMotion() ? 0 : 1);
    updateLayout(run);
    startAnimation(run);
  } catch (error) {
    console.error(error);
    disposeRun();
    showFallback(data);
  }
}

function startAnimation(run) {
  cancelAnimationFrame(run.raf);

  const reducedMotion = prefersReducedMotion();
  run.startedAt = performance.now();
  run.timeline = createTimeline(reducedMotion);
  run.finished = false;
  run.renderer.setMotion(reducedMotion ? 0 : 1);
  replayButton.hidden = true;
  setStageSuspense();
  setStageStatus("stage.breaking");
  run.renderer.render(0, 0);

  const tick = (now) => {
    if (activeRun !== run) return;

    const elapsed = (now - run.startedAt) / 1000;
    const progress = progressAt(elapsed, run.timeline);
    run.renderer.render(progress, elapsed);
    updateStageStatus(progress);

    if (progress < 1) {
      run.raf = requestAnimationFrame(tick);
    } else {
      run.finished = true;
      replayButton.hidden = false;
      revealReference(run.referenceName);
    }
  };

  run.raf = requestAnimationFrame(tick);
}

function updateStageStatus(progress) {
  let key;

  if (progress === 0) {
    key = "stage.breaking";
  } else if (progress < 0.55) {
    key = "stage.drifting";
  } else if (progress < 1) {
    key = "stage.reassembling";
  } else {
    key = "stage.settled";
  }

  if (stageStatusKey !== key) setStageStatus(key);
}

function resizeStage(run) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    APP_CONFIG.maxDevicePixelRatio
  );

  run.renderer.resize(width, height, dpr);
}

function updateLayout(run) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const sourceRect = containRect(run.width, run.height, width, height);
  const targetRect = containRect(
    run.referenceWidth,
    run.referenceHeight,
    width,
    height
  );
  const targetArea =
    targetRect.w * width * targetRect.h * height;
  const targetTilePx =
    Math.sqrt(targetArea / run.particles.length) * APP_CONFIG.targetCoverage;

  run.renderer.setLayout({
    sourceRect,
    targetRect,
    targetSize: [targetTilePx / width, targetTilePx / height],
  });
}

function handleResize() {
  if (!activeRun) return;

  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (!activeRun) return;

    resizeStage(activeRun);
    updateLayout(activeRun);

    const elapsed = (performance.now() - activeRun.startedAt) / 1000;
    activeRun.renderer.render(
      progressAt(elapsed, activeRun.timeline),
      elapsed
    );
  });
}

function handleContextLost(event) {
  event.preventDefault();
  if (!activeRun) return;

  disposeRun();
  setStageStatus("stage.contextLost");
  setStatus("stage.contextLostStatus", "error");
}

function replay() {
  if (!activeRun) return;
  startAnimation(activeRun);
}

function closeStage() {
  requestId += 1;
  clearTimeout(fallbackTimer);
  disposeRun();
  stage.hidden = true;
  stageFallback.hidden = true;
  stageFallback.replaceChildren();
  stageCanvas.hidden = false;
  document.body.classList.remove("is-morphing");
  pageMain.inert = false;
  resetUpload();
}

function disposeRun() {
  if (!activeRun) return;

  cancelAnimationFrame(activeRun.raf);
  activeRun.renderer.dispose();
  activeRun = null;
}

function resetUpload() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  input.value = "";
  preview.hidden = true;
  dropzone.classList.remove("is-filled");
  setStatus("upload.waiting");
  input.focus({ preventScroll: true });
}

function showFallback(data) {
  stageCanvas.hidden = true;
  stageFallback.hidden = false;
  stageFallback.replaceChildren();

  const source = new Image();
  source.className = "stage__fallback-image stage__fallback-image--source";
  source.src = previewUrl || data.canvas.toDataURL();
  source.alt = "Your uploaded image";

  const target = new Image();
  target.className = "stage__fallback-image";
  target.src = referenceUrl(data.referenceName);
  target.alt = `Reference ${stripExtension(data.referenceName)}`;

  stageFallback.append(source, target);
  setStageStatus("stage.fallback");

  requestAnimationFrame(() => {
    target.classList.add("is-visible");
  });

  fallbackTimer = window.setTimeout(() => {
    if (stage.hidden || stageFallback.hidden) return;

    revealReference(data.referenceName);
    setStageStatus("stage.settled");
  }, 1900);
}

function setStatus(key, tone = "idle", params = {}) {
  statusState = { key, tone, params };
  status.textContent = t(key, params);
  status.dataset.tone = tone;
}

function setReferenceStatus(key, params = {}) {
  referenceState = { key, params };
  referenceStatus.textContent = t(key, params);
}

function setStageStatus(key) {
  stageStatusKey = key;
  stageStatus.textContent = t(key);
}

function setStageSuspense() {
  stageReference.textContent = t("stage.suspense");
  stageReference.dataset.revealed = "false";
}

function revealReference(name) {
  stageReference.textContent = displayReferenceName(name);
  stageReference.dataset.revealed = "true";
}

function stripExtension(name) {
  return name.replace(/\.[^.]+$/i, "");
}

function displayReferenceName(name) {
  return stripExtension(name).replace(/[-_]+/g, " ");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatType(type) {
  if (!type) return "IMAGE";
  return type.replace("image/", "").replace("+xml", "").toUpperCase();
}

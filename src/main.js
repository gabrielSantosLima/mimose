import {
  APP_CONFIG,
  chooseParticleBudget,
  prefersReducedMotion,
} from "./config.js";
import { coverRect, containRect } from "./gl/layout.js";
import { createRenderer } from "./gl/renderer.js";
import { decodeImageFile } from "./image/decode.js";
import { buildSourceTiles } from "./image/source-tiles.js";
import { pairTiles } from "./particles/pair.js";
import { createTimeline, progressAt } from "./particles/timeline.js";
import { analyzeReference, sampleTargets } from "./reference/analyze.js";
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

let previewUrl = null;
let manifest = [];
let lastReference = null;
let activeRun = null;
let requestId = 0;
let resizeFrame = 0;
let fallbackTimer = 0;
const referenceCache = new Map();

init();

async function init() {
  setupUpload();
  stageClose.addEventListener("click", closeStage);
  replayButton.addEventListener("click", replay);
  window.addEventListener("resize", handleResize);
  stageCanvas.addEventListener("webglcontextlost", handleContextLost);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !stage.hidden) closeStage();
  });

  try {
    manifest = await loadManifest();
    referenceStatus.textContent = `${manifest.length} references ready`;
  } catch (error) {
    console.error(error);
    referenceStatus.textContent = "References unavailable";
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
    setStatus("Please choose an image file.", "error");
    return;
  }

  if (file.size > APP_CONFIG.maxFileSize) {
    setStatus("That image is too large. Try one under 25 MB.", "error");
    return;
  }

  const token = ++requestId;
  showPreview(file);
  setStatus("Preparing the morph…", "ready");

  try {
    if (manifest.length === 0) {
      manifest = await loadManifest();
      referenceStatus.textContent = `${manifest.length} references ready`;
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
    setStatus(
      error.message || "Something went wrong. Try another image.",
      "error"
    );
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

  stage.hidden = false;
  stageCanvas.hidden = false;
  stageFallback.hidden = true;
  stageFallback.replaceChildren();
  document.body.classList.add("is-morphing");
  pageMain.inert = true;
  stageReference.textContent = "your image became....";
  stageReference.dataset.revealed = "false";
  stageStatus.textContent = "Breaking the image apart…";
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
  stageReference.textContent = "your image became....";
  stageReference.dataset.revealed = "false";
  stageStatus.textContent = "Breaking the image apart…";
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
      stageReference.textContent = displayReferenceName(run.referenceName);
      stageReference.dataset.revealed = "true";
    }
  };

  run.raf = requestAnimationFrame(tick);
}

function updateStageStatus(progress) {
  let message;

  if (progress === 0) {
    message = "Breaking the image apart…";
  } else if (progress < 0.55) {
    message = "Drifting through the pixels…";
  } else if (progress < 1) {
    message = "Reassembling the portrait…";
  } else {
    message = "Settled.";
  }

  if (stageStatus.textContent !== message) {
    stageStatus.textContent = message;
  }
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
  const sourceRect = coverRect(run.width, run.height, width, height);
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
  stageStatus.textContent = "The graphics context was lost. Try again.";
  setStatus("The graphics context was lost. Try another image.", "error");
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
  setStatus("Waiting for an image.");
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
  stageStatus.textContent =
    "WebGL2 is unavailable — showing a simple crossfade.";

  requestAnimationFrame(() => {
    target.classList.add("is-visible");
  });

  fallbackTimer = window.setTimeout(() => {
    if (stage.hidden || stageFallback.hidden) return;

    stageReference.textContent = displayReferenceName(data.referenceName);
    stageReference.dataset.revealed = "true";
    stageStatus.textContent = "Settled.";
  }, 1900);
}

function setStatus(message, tone = "idle") {
  status.textContent = message;
  status.dataset.tone = tone;
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

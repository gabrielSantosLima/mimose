import { APP_CONFIG } from "../config.js";
import { getImageDimensions } from "../image/decode.js";

export function analyzeReference(image) {
  const { width, height } = getImageDimensions(image);
  const scale = Math.min(
    1,
    APP_CONFIG.analysisMaxSize / Math.max(width, height)
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not analyze the reference image.");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixelCount = canvas.width * canvas.height;
  const luminance = new Float32Array(pixelCount);
  const alpha = new Float32Array(pixelCount);

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    alpha[index] = data[offset + 3] / 255;
    luminance[index] =
      (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  }

  const edges = computeEdges(luminance, canvas.width, canvas.height);
  const cumulative = new Float64Array(pixelCount);
  let total = 0;

  for (let index = 0; index < pixelCount; index += 1) {
    const importance =
      alpha[index] *
      (0.12 + 1.0 * (1 - luminance[index]) + 1.5 * edges[index]);

    total += importance;
    cumulative[index] = total;
  }

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("The reference image has no visible pixels.");
  }

  return {
    width: canvas.width,
    height: canvas.height,
    luminance,
    cumulative,
    total,
  };
}

export function sampleTargets(analysis, count) {
  if (count <= 0) throw new Error("There are no pixels to place.");

  const { width, height, luminance, cumulative, total } = analysis;
  const targets = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const value = total * ((index + Math.random()) / count);
    const pixelIndex = findPixel(cumulative, value);
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    targets[index] = {
      x: (x + Math.random()) / width,
      y: (y + Math.random()) / height,
      luminance: luminance[pixelIndex],
    };
  }

  return targets;
}

function computeEdges(luminance, width, height) {
  const edges = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const topLeft = luminance[index - width - 1];
      const top = luminance[index - width];
      const topRight = luminance[index - width + 1];
      const left = luminance[index - 1];
      const right = luminance[index + 1];
      const bottomLeft = luminance[index + width - 1];
      const bottom = luminance[index + width];
      const bottomRight = luminance[index + width + 1];

      const gradientX =
        -topLeft - 2 * left - bottomLeft + topRight + 2 * right + bottomRight;
      const gradientY =
        -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight;

      edges[index] = Math.min(
        1,
        Math.sqrt(gradientX * gradientX + gradientY * gradientY) / 4
      );
    }
  }

  return edges;
}

function findPixel(cumulative, value) {
  let low = 0;
  let high = cumulative.length;

  while (low < high) {
    const middle = (low + high) >> 1;
    if (cumulative[middle] < value) low = middle + 1;
    else high = middle;
  }

  return Math.min(low, cumulative.length - 1);
}

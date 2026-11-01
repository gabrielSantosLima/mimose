import { APP_CONFIG } from "../config.js";
import { getImageDimensions } from "./decode.js";

export function buildSourceTiles(image, budget) {
  const { width, height } = getImageDimensions(image);
  const scale = Math.min(
    1,
    APP_CONFIG.sourceMaxSize / Math.max(width, height)
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not create the image canvas.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let pixels;
  try {
    pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    throw new Error("The image pixels could not be read.");
  }

  const targetCount = Math.max(1, budget || 60000);
  const tileSize = Math.sqrt(
    (canvas.width * canvas.height) / targetCount
  );
  const columns = Math.max(1, Math.round(canvas.width / tileSize));
  const rows = Math.max(1, Math.round(canvas.height / tileSize));
  const tileWidth = canvas.width / columns;
  const tileHeight = canvas.height / rows;
  const tiles = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x0 = column * tileWidth;
      const y0 = row * tileHeight;
      const x1 = x0 + tileWidth;
      const y1 = y0 + tileHeight;

      const average = averageTile(
        pixels.data,
        canvas.width,
        canvas.height,
        x0,
        y0,
        x1,
        y1
      );
      if (!average) continue;

      const [red, green, blue, alpha] = average;
      tiles.push({
        srcX: (column + 0.5) / columns,
        srcY: (row + 0.5) / rows,
        rect: [
          column / columns,
          row / rows,
          (column + 1) / columns,
          (row + 1) / rows,
        ],
        srcSize: [1 / columns, 1 / rows],
        color: [red / 255, green / 255, blue / 255],
        alpha,
        luminance:
          (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255,
        seed: Math.random(),
      });
    }
  }

  if (tiles.length === 0) {
    throw new Error("That image has no visible pixels.");
  }

  return {
    canvas,
    width: canvas.width,
    height: canvas.height,
    columns,
    rows,
    tileWidth,
    tileHeight,
    tiles,
  };
}

function averageTile(data, width, height, x0, y0, x1, y1) {
  const startX = Math.max(0, Math.floor(x0));
  const endX = Math.min(width, Math.ceil(x1));
  const startY = Math.max(0, Math.floor(y0));
  const endY = Math.min(height, Math.ceil(y1));
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let totalWeight = 0;

  for (let y = startY; y < endY; y += 1) {
    const overlapY = Math.min(y + 1, y1) - Math.max(y, y0);
    if (overlapY <= 0) continue;

    for (let x = startX; x < endX; x += 1) {
      const overlapX = Math.min(x + 1, x1) - Math.max(x, x0);
      if (overlapX <= 0) continue;

      const weight = overlapX * overlapY;
      const index = (y * width + x) * 4;
      const pixelAlpha = data[index + 3] / 255;
      const effectiveWeight = weight * pixelAlpha;

      totalWeight += weight;
      alpha += effectiveWeight;
      red += data[index] * effectiveWeight;
      green += data[index + 1] * effectiveWeight;
      blue += data[index + 2] * effectiveWeight;
    }
  }

  if (alpha === 0 || totalWeight === 0) return null;

  return [
    red / alpha,
    green / alpha,
    blue / alpha,
    alpha / totalWeight,
  ];
}

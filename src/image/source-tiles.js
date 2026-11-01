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

  const tilePx = Math.max(
    2,
    Math.ceil(Math.sqrt((canvas.width * canvas.height) / budget))
  );
  const columns = Math.ceil(canvas.width / tilePx);
  const rows = Math.ceil(canvas.height / tilePx);
  const tiles = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x0 = column * tilePx;
      const y0 = row * tilePx;
      const x1 = Math.min(x0 + tilePx, canvas.width);
      const y1 = Math.min(y0 + tilePx, canvas.height);

      const average = averageTile(pixels.data, canvas.width, x0, y0, x1, y1);
      if (!average) continue;

      const [red, green, blue, alpha] = average;
      tiles.push({
        srcX: (x0 + (x1 - x0) / 2) / canvas.width,
        srcY: (y0 + (y1 - y0) / 2) / canvas.height,
        rect: [
          x0 / canvas.width,
          y0 / canvas.height,
          x1 / canvas.width,
          y1 / canvas.height,
        ],
        srcSize: [
          (x1 - x0) / canvas.width,
          (y1 - y0) / canvas.height,
        ],
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
    tilePx,
    columns,
    rows,
    tiles,
  };
}

function averageTile(data, width, x0, y0, x1, y1) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let count = 0;

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * width + x) * 4;
      const pixelAlpha = data[index + 3];

      if (pixelAlpha === 0) {
        count += 1;
        continue;
      }

      red += data[index] * pixelAlpha;
      green += data[index + 1] * pixelAlpha;
      blue += data[index + 2] * pixelAlpha;
      alpha += pixelAlpha;
      count += 1;
    }
  }

  if (alpha === 0) return null;

  return [red / alpha, green / alpha, blue / alpha, alpha / (count * 255)];
}

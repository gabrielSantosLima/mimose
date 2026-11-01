import { APP_CONFIG } from "../config.js";

export function adaptTileColors(particles) {
  if (particles.length === 0) return particles;

  const luminances = particles.map((particle) => particle.luminance);
  const mean =
    luminances.reduce((sum, value) => sum + value, 0) / luminances.length;
  const variance =
    luminances.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    luminances.length;
  const spread = Math.sqrt(variance);
  const need = clamp01(
    (APP_CONFIG.contrastTargetSpread - spread) / APP_CONFIG.contrastTargetSpread
  );

  if (need < 0.01) return particles;

  const boost = 1 + need * APP_CONFIG.contrastBoost;
  const influence = need * APP_CONFIG.contrastTargetInfluence;

  return particles.map((particle) => {
    const boosted = clamp01(mean + (particle.luminance - mean) * boost);
    const desiredLuminance = clamp01(
      boosted * (1 - influence) + particle.target.luminance * influence
    );
    const [hue, saturation] = rgbToHsl(particle.color);
    const color = hslToRgb(hue, saturation, desiredLuminance);

    return { ...particle, color };
  });
}

function rgbToHsl([red, green, blue]) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const lightness = (maximum + minimum) / 2;

  if (maximum === minimum) return [0, 0, lightness];

  const delta = maximum - minimum;
  const saturation =
    lightness > 0.5
      ? delta / (2 - maximum - minimum)
      : delta / (maximum + minimum);
  let hue;

  if (maximum === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (maximum === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return [hue / 6, saturation, lightness];
}

function hslToRgb(hue, saturation, lightness) {
  if (saturation === 0) return [lightness, lightness, lightness];

  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return [
    hueToChannel(p, q, hue + 1 / 3),
    hueToChannel(p, q, hue),
    hueToChannel(p, q, hue - 1 / 3),
  ];
}

function hueToChannel(p, q, hue) {
  let value = hue;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

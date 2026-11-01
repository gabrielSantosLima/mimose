import { adaptTileColors } from "./contrast.js";

export function pairTiles(tiles, targets, randomness) {
  if (tiles.length !== targets.length) {
    throw new Error("The source and reference pixel counts do not match.");
  }

  const sortedTiles = tiles.slice().sort((a, b) => a.luminance - b.luminance);
  const sortedTargets = targets
    .slice()
    .sort((a, b) => a.luminance - b.luminance);
  const windowSize = Math.max(1, Math.round(sortedTargets.length * 0.02));

  for (let index = 0; index < sortedTargets.length; index += 1) {
    if (Math.random() >= randomness) continue;

    const offset = Math.floor((Math.random() * 2 - 1) * windowSize);
    const swapIndex = Math.min(
      sortedTargets.length - 1,
      Math.max(0, index + offset)
    );

    const target = sortedTargets[index];
    sortedTargets[index] = sortedTargets[swapIndex];
    sortedTargets[swapIndex] = target;
  }

  const pairedTiles = sortedTiles.map((tile, index) => ({
    ...tile,
    target: sortedTargets[index],
  }));

  return adaptTileColors(pairedTiles);
}

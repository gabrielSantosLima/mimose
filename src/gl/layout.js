export function coverRect(imageWidth, imageHeight, viewportWidth, viewportHeight) {
  return fitRect(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
    Math.max
  );
}

export function containRect(
  imageWidth,
  imageHeight,
  viewportWidth,
  viewportHeight
) {
  return fitRect(
    imageWidth,
    imageHeight,
    viewportWidth,
    viewportHeight,
    Math.min
  );
}

function fitRect(imageWidth, imageHeight, viewportWidth, viewportHeight, pick) {
  const safeViewportWidth = Math.max(1, viewportWidth);
  const safeViewportHeight = Math.max(1, viewportHeight);
  const scale = pick(
    safeViewportWidth / imageWidth,
    safeViewportHeight / imageHeight
  );
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (safeViewportWidth - width) / 2 / safeViewportWidth,
    y: (safeViewportHeight - height) / 2 / safeViewportHeight,
    w: width / safeViewportWidth,
    h: height / safeViewportHeight,
  };
}

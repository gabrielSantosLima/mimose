const REFERENCE_ROOT = new URL("../../reference/", import.meta.url);

export async function loadManifest() {
  const response = await fetch(new URL("manifest.json", REFERENCE_ROOT), {
    cache: "no-cache",
  });

  if (!response.ok) {
    throw new Error("Could not load the reference manifest.");
  }

  const data = await response.json();
  const images = Array.isArray(data.images)
    ? data.images.filter((name) => typeof name === "string" && name.length > 0)
    : [];

  if (images.length === 0) {
    throw new Error("No reference images are available.");
  }

  return images;
}

export function pickReference(images, previousName) {
  const candidates =
    images.length > 1
      ? images.filter((name) => name !== previousName)
      : images;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function referenceUrl(name) {
  return new URL(name, REFERENCE_ROOT).href;
}

export async function loadReferenceBitmap(name) {
  const response = await fetch(referenceUrl(name), { cache: "force-cache" });

  if (!response.ok) {
    throw new Error(`Could not load reference "${name}".`);
  }

  const blob = await response.blob();

  try {
    return await createImageBitmap(blob);
  } catch {
    return loadWithImageElement(blob);
  }
}

function loadWithImageElement(blob) {
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The reference image could not be decoded."));
    };
    image.src = url;
  });
}

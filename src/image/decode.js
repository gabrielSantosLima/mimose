export async function decodeImageFile(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      return decodeWithImageElement(file);
    }
  }
}

export function getImageDimensions(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) {
    throw new Error("The image has no readable dimensions.");
  }

  return { width, height };
}

async function decodeWithImageElement(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;

  try {
    await image.decode();
    return image;
  } catch {
    throw new Error("The image could not be decoded.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

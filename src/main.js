const input = document.querySelector("#image-input");
const dropzone = document.querySelector("#dropzone");
const preview = document.querySelector("#preview");
const previewImage = document.querySelector("#preview-image");
const previewName = document.querySelector("#preview-name");
const previewSize = document.querySelector("#preview-size");
const clearButton = document.querySelector("#clear-button");
const status = document.querySelector("#status");
const referenceStatus = document.querySelector("#reference-status");

let previewUrl = null;

function setStatus(message, tone = "idle") {
  status.textContent = message;
  status.dataset.tone = tone;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatType(type) {
  if (!type) return "image";
  return type.replace("image/", "").replace("+xml", "").toUpperCase();
}

function setPreview(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setStatus("Please choose an image file.", "error");
    return;
  }

  if (previewUrl) URL.revokeObjectURL(previewUrl);

  previewUrl = URL.createObjectURL(file);
  previewImage.src = previewUrl;
  previewImage.alt = `Preview of ${file.name}`;
  previewName.textContent = file.name;
  previewSize.textContent = `${formatBytes(file.size)} · ${formatType(file.type)}`;
  preview.hidden = false;
  dropzone.classList.add("is-filled");
  setStatus("Image loaded. Ready for the morph.", "ready");
}

input.addEventListener("change", () => {
  setPreview(input.files[0]);
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
  setPreview(event.dataTransfer.files[0]);
});

clearButton.addEventListener("click", () => {
  input.value = "";
  input.click();
});

fetch("./reference/manifest.json")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((manifest) => {
    const count = Array.isArray(manifest.images) ? manifest.images.length : 0;
    referenceStatus.textContent = `${count} references ready`;
  })
  .catch(() => {
    referenceStatus.textContent = "References unavailable";
  });

#!/usr/bin/env node
const fs = require("fs");
const fsp = fs.promises;
const os = require("os");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const DEFAULT_INPUT = path.join(os.homedir(), "Downloads");
const DEFAULT_OUTPUT = path.join(ROOT, "reference");
const DEFAULT_MAX_SIZE = 2048;

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".jpeg",
  ".jpg",
  ".png",
  ".tif",
  ".tiff",
  ".webp",
]);

function printHelp() {
  console.log(`Usage: node scripts/convert-references.js [input...] [options]

Convert reference images to PNG and regenerate reference/manifest.json.

Inputs may be image files or directories. With no input, the script reads
the current user's Downloads directory.

Options:
  --out <dir>        Output directory (default: reference/)
  --max-size <px>    Resize so the longest side is at most <px>.
                     Use 0 to keep the original size (default: ${DEFAULT_MAX_SIZE})
  --no-manifest      Do not regenerate reference/manifest.json
  -h, --help         Show this help
`);
}

function parseArgs(argv) {
  const inputs = [];
  const options = {
    output: DEFAULT_OUTPUT,
    maxSize: DEFAULT_MAX_SIZE,
    manifest: true,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("--out requires a directory");
      options.output = path.resolve(value);
      index += 1;
    } else if (arg === "--max-size") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error("--max-size requires a non-negative integer");
      }
      options.maxSize = value;
      index += 1;
    } else if (arg === "--no-manifest") {
      options.manifest = false;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      inputs.push(path.resolve(arg));
    }
  }

  if (inputs.length === 0) inputs.push(DEFAULT_INPUT);
  return { inputs, options };
}

function isImage(file) {
  return IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

async function collectImages(entries) {
  const images = [];

  for (const entry of entries) {
    const stats = await fsp.stat(entry);

    if (stats.isDirectory()) {
      const names = await fsp.readdir(entry);
      for (const name of names) {
        const fullPath = path.join(entry, name);
        const childStats = await fsp.stat(fullPath);
        if (childStats.isFile() && isImage(fullPath)) images.push(fullPath);
      }
    } else if (stats.isFile() && isImage(entry)) {
      images.push(entry);
    } else if (stats.isFile()) {
      console.warn(`Skipping unsupported file: ${entry}`);
    }
  }

  return images.sort((a, b) => a.localeCompare(b));
}

function toFileName(source) {
  const base = path
    .parse(source)
    .name.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "reference"}.png`;
}

function uniqueFileName(fileName, used) {
  const parsed = path.parse(fileName);
  let candidate = fileName;
  let counter = 2;

  while (used.has(candidate)) {
    candidate = `${parsed.name}-${counter}${parsed.ext}`;
    counter += 1;
  }

  used.add(candidate);
  return candidate;
}

async function convertImage(source, output, maxSize) {
  const pipeline = sharp(source, { failOn: "none" }).rotate();
  const resized =
    maxSize > 0
      ? pipeline.resize({
          width: maxSize,
          height: maxSize,
          fit: "inside",
          withoutEnlargement: true,
        })
      : pipeline;

  const info = await resized
    .png({ adaptiveFiltering: true, compressionLevel: 9 })
    .toFile(output);

  return info;
}

async function writeManifest(output) {
  const names = (await fsp.readdir(output))
    .filter((name) => path.extname(name).toLowerCase() === ".png")
    .sort((a, b) => a.localeCompare(b));

  const manifestPath = path.join(output, "manifest.json");
  const manifest = { images: names };
  await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return { manifestPath, count: names.length };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  const { inputs, options } = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  await fsp.mkdir(options.output, { recursive: true });

  let images;
  try {
    images = await collectImages(inputs);
  } catch (error) {
    throw new Error(`Could not read input path: ${error.message}`);
  }

  if (images.length === 0) {
    throw new Error(`No supported images found in: ${inputs.join(", ")}`);
  }

  const used = new Set();
  let failures = 0;

  for (const source of images) {
    const fileName = uniqueFileName(toFileName(source), used);
    const destination = path.join(options.output, fileName);

    try {
      const info = await convertImage(source, destination, options.maxSize);
      console.log(
        `${path.basename(source)} -> ${fileName} ` +
          `(${info.width}x${info.height}, ${formatBytes(info.size)})`
      );
    } catch (error) {
      failures += 1;
      console.error(`Failed to convert ${source}: ${error.message}`);
    }
  }

  if (options.manifest) {
    const { manifestPath, count } = await writeManifest(options.output);
    console.log(`Manifest: ${path.relative(ROOT, manifestPath)} (${count} images)`);
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

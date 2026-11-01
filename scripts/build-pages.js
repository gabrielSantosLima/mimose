#!/usr/bin/env node
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUTPUT = path.join(ROOT, "dist");

const FILES = ["index.html", "404.html", "favicon.ico", "robots.txt", "CNAME"];
const DIRECTORIES = ["src", "reference", "assets", "public"];

async function exists(target) {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyFile(relativePath) {
  const source = path.join(ROOT, relativePath);
  if (!(await exists(source))) return false;

  await fsp.copyFile(source, path.join(OUTPUT, relativePath));
  return true;
}

async function copyDirectory(relativePath) {
  const source = path.join(ROOT, relativePath);
  if (!(await exists(source))) return false;

  await fsp.cp(source, path.join(OUTPUT, relativePath), {
    recursive: true,
    force: true,
  });
  return true;
}

async function main() {
  if (!(await exists(path.join(ROOT, "index.html")))) {
    throw new Error("index.html not found; nothing to deploy");
  }

  await fsp.rm(OUTPUT, { recursive: true, force: true });
  await fsp.mkdir(OUTPUT, { recursive: true });

  const copied = [];

  for (const file of FILES) {
    if (await copyFile(file)) copied.push(file);
  }

  for (const directory of DIRECTORIES) {
    if (await copyDirectory(directory)) copied.push(`${directory}/`);
  }

  // GitHub Pages serves the artifact directly; .nojekyll keeps every file.
  await fsp.writeFile(path.join(OUTPUT, ".nojekyll"), "");

  console.log(`Staged ${copied.length} entries into dist/:`);
  for (const entry of copied) console.log(`- ${entry}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

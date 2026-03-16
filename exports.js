#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Reads a directory recursively and returns a list of all files with their relative paths.
 * @param {string} dir - The directory path.
 * @param {string} baseDir - The base directory for relative paths.
 * @returns {string[]} - A list of relative file paths.
 */
const getFilesRecursively = (dir, baseDir) => {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });

  list.forEach((file) => {
    const fullPath = path.join(dir, file.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (file.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, baseDir));
    } else {
      results.push(relativePath);
    }
  });

  return results;
};

/**
 * Removes the file extension from a path.
 * @param {string} filePath - The file path.
 * @returns {string} - The path without extension.
 */
const removeExtension = (filePath) => {
  return filePath.replace(/\.[^/.]+$/, ''); // Removes last file extension
};

/**
 * Determines the correct source file extension by checking if it exists.
 * @param {string} basePath - The base path without extension.
 * @returns {string} - The correct file path with the appropriate extension.
 */
const getSourceFilePath = (basePath) => {
  const tsPath = `${basePath}.ts`;
  const tsxPath = `${basePath}.tsx`;
  return fs.existsSync(tsxPath) ? tsxPath : tsPath;
};

/**
 * Generates the exports and directories fields dynamically based on dist folder structure.
 */
const generateExports = (distFolder) => {
  const baseDir = path.resolve(distFolder);
  const files = getFilesRecursively(baseDir, baseDir);
  const exports = {};

  // Add the main entry points
  exports['.'] = {
    import: './dist/esm/index.js',
    require: './dist/cjs/index.js',
    types: './dist/types/index.d.ts',
    source: './src/index.ts',
  };

  // Add all other exports
  files.forEach((file) => {
    // Skip declaration files and source maps
    if (file.endsWith('.d.ts') || file.endsWith('.map')) return;

    const parsedPath = path.parse(file);
    const distPath = path.relative(baseDir, file);
    const fileWithoutExt = removeExtension(distPath);

    // Skip index files as they are already handled
    if (fileWithoutExt.endsWith('index')) return;

    // Only process .js files
    if (!file.endsWith('.js')) return;

    const srcPathBase = fileWithoutExt.replace(/^(cjs|esm)\//, '').replace(/\\/g, '/');
    const esm = `./dist/esm/${srcPathBase}.js`;
    const cjs = `./dist/cjs/${srcPathBase}.js`;
    const types = `./dist/types/${srcPathBase}.d.ts`;
    const source = getSourceFilePath(path.join('./src', srcPathBase)).replace(/\\/g, '/');

    exports[`./${srcPathBase}`] = {
      import: esm,
      require: cjs,
      types: types,
      source: source,
    };
  });

  return exports;
};

const exports = generateExports('./dist');
const directories = {
  ts: 'src',
  esm: 'dist/esm',
  cjs: 'dist/cjs',
};

console.log(JSON.stringify({ exports, directories }, null, 2));

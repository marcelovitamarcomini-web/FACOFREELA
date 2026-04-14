import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const inputPath = path.join(repoRoot, 'public', 'logo.png');
const outputDir = path.join(repoRoot, 'scripts', 'vectorize-output');

const threshold = 200;
const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function alphaAt(png, x, y) {
  return png.data[(png.width * y + x) * 4 + 3];
}

function cloneEmptyPng(width, height) {
  return new PNG({ width, height });
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const png = PNG.sync.read(await readFile(inputPath));
  const visited = new Uint8Array(png.width * png.height);
  const components = [];

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const root = y * png.width + x;
      if (visited[root] || alphaAt(png, x, y) < threshold) {
        continue;
      }

      const queue = [root];
      const pixels = [];
      visited[root] = 1;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];
        const cx = current % png.width;
        const cy = Math.floor(current / png.width);
        pixels.push(current);

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= png.width || ny >= png.height) {
            continue;
          }

          const next = ny * png.width + nx;
          if (!visited[next] && alphaAt(png, nx, ny) >= threshold) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }

      components.push({
        pixels,
        minX,
        maxX,
        minY,
        maxY,
      });
    }
  }

  components.sort((a, b) => b.pixels.length - a.pixels.length);

  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    const out = cloneEmptyPng(png.width, png.height);

    for (const pixelIndex of component.pixels) {
      const srcOffset = pixelIndex * 4;
      out.data[srcOffset] = png.data[srcOffset];
      out.data[srcOffset + 1] = png.data[srcOffset + 1];
      out.data[srcOffset + 2] = png.data[srcOffset + 2];
      out.data[srcOffset + 3] = png.data[srcOffset + 3];
    }

    const outputPath = path.join(outputDir, `component-${index + 1}.png`);
    await writeFile(outputPath, PNG.sync.write(out));
    console.log(
      JSON.stringify({
        outputPath,
        pixelCount: component.pixels.length,
        bounds: {
          minX: component.minX,
          minY: component.minY,
          maxX: component.maxX,
          maxY: component.maxY,
          width: component.maxX - component.minX + 1,
          height: component.maxY - component.minY + 1,
        },
      }),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

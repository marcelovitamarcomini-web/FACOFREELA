import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const potrace = require('potrace');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const inputPath = path.join(repoRoot, 'public', 'logo.png');
const outputDir = path.join(repoRoot, 'scripts', 'vectorize-output');

const alphaThreshold = 200;
const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function alphaAt(png, x, y) {
  return png.data[(png.width * y + x) * 4 + 3];
}

function rgbaAt(png, x, y) {
  const offset = (png.width * y + x) * 4;
  return {
    r: png.data[offset],
    g: png.data[offset + 1],
    b: png.data[offset + 2],
    a: png.data[offset + 3],
  };
}

function createBinaryMask(width, height) {
  const png = new PNG({ width, height });
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = 255;
    png.data[index + 1] = 255;
    png.data[index + 2] = 255;
    png.data[index + 3] = 255;
  }
  return png;
}

function fillMaskPixel(mask, pixelIndex, isBlack) {
  const offset = pixelIndex * 4;
  const value = isBlack ? 0 : 255;
  mask.data[offset] = value;
  mask.data[offset + 1] = value;
  mask.data[offset + 2] = value;
  mask.data[offset + 3] = 255;
}

function traceMask(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const instance = new potrace.Potrace({
      turdSize: 5,
      alphaMax: 1,
      optCurve: true,
      optTolerance: 0.12,
      threshold: 128,
      blackOnWhite: true,
      ...options,
    });

    instance.loadImage(buffer, function onLoad(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this.getPathTag());
    });
  });
}

function extractPathData(pathTag) {
  const match = /d=\"([^\"]+)\"/.exec(pathTag);
  if (!match) {
    throw new Error('Nao foi possivel extrair o path do Potrace.');
  }
  return match[1];
}

function findComponents(png) {
  const visited = new Uint8Array(png.width * png.height);
  const components = [];

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const root = y * png.width + x;
      if (visited[root] || alphaAt(png, x, y) < alphaThreshold) {
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
          if (!visited[next] && alphaAt(png, nx, ny) >= alphaThreshold) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }

      components.push({
        pixels,
        minX,
        minY,
        maxX,
        maxY,
      });
    }
  }

  components.sort((a, b) => b.pixels.length - a.pixels.length);
  return components;
}

function isDarkInnerPixel(color) {
  return color.a >= 200 && color.r <= 80 && color.g <= 150 && color.b >= 150;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const png = PNG.sync.read(await readFile(inputPath));
  const components = findComponents(png);

  const topMask = createBinaryMask(png.width, png.height);
  const bottomMask = createBinaryMask(png.width, png.height);
  const rightMask = createBinaryMask(png.width, png.height);
  const darkInnerMask = createBinaryMask(png.width, png.height);

  for (const pixelIndex of components[0].pixels) {
    fillMaskPixel(topMask, pixelIndex, true);
  }
  for (const pixelIndex of components[1].pixels) {
    fillMaskPixel(bottomMask, pixelIndex, true);
  }
  for (const pixelIndex of components[2].pixels) {
    fillMaskPixel(rightMask, pixelIndex, true);
  }

  const darkVisited = new Uint8Array(png.width * png.height);
  const darkComponents = [];

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const root = y * png.width + x;
      if (darkVisited[root] || !isDarkInnerPixel(rgbaAt(png, x, y))) {
        continue;
      }

      const queue = [root];
      const pixels = [];
      darkVisited[root] = 1;
      let minY = y;

      for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];
        const cx = current % png.width;
        const cy = Math.floor(current / png.width);
        pixels.push(current);
        if (cy < minY) minY = cy;

        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= png.width || ny >= png.height) {
            continue;
          }
          const next = ny * png.width + nx;
          if (!darkVisited[next] && isDarkInnerPixel(rgbaAt(png, nx, ny))) {
            darkVisited[next] = 1;
            queue.push(next);
          }
        }
      }

      darkComponents.push({ pixels, minY });
    }
  }

  darkComponents.sort((a, b) => b.pixels.length - a.pixels.length);
  const lowerDarkComponent =
    darkComponents.find((component) => component.minY > 540) ?? darkComponents[0] ?? null;

  if (!lowerDarkComponent) {
    throw new Error('Nao foi possivel identificar a camada interna escura.');
  }

  for (const pixelIndex of lowerDarkComponent.pixels) {
    fillMaskPixel(darkInnerMask, pixelIndex, true);
  }

  const masks = {
    top: topMask,
    bottom: bottomMask,
    right: rightMask,
    darkInner: darkInnerMask,
  };

  for (const [name, mask] of Object.entries(masks)) {
    await writeFile(path.join(outputDir, `${name}-mask.png`), PNG.sync.write(mask));
  }

  const topPath = extractPathData(await traceMask(PNG.sync.write(topMask), { turdSize: 10 }));
  const bottomPath = extractPathData(await traceMask(PNG.sync.write(bottomMask), { turdSize: 10 }));
  const rightPath = extractPathData(await traceMask(PNG.sync.write(rightMask), { turdSize: 6 }));
  const darkInnerPath = extractPathData(await traceMask(PNG.sync.write(darkInnerMask), { turdSize: 6 }));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${png.width}" height="${png.height}" viewBox="0 0 ${png.width} ${png.height}" fill="none" role="img" aria-labelledby="title desc">
  <title id="title">Logo programatica Faco Freela</title>
  <desc id="desc">Versao vetorial redesenhada a partir do contorno do logo original.</desc>
  <defs>
    <linearGradient id="top-gradient" x1="632" y1="415.5" x2="1009" y2="415.5" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#297CF7" />
      <stop offset="0.52" stop-color="#52B0F7" />
      <stop offset="1" stop-color="#C4F5E8" />
    </linearGradient>
    <linearGradient id="bottom-gradient" x1="537" y1="572.5" x2="796" y2="572.5" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#C5F5E7" />
      <stop offset="0.55" stop-color="#68C7ED" />
      <stop offset="1" stop-color="#3C8BF0" />
    </linearGradient>
    <linearGradient id="right-gradient" x1="794" y1="512.5" x2="974" y2="512.5" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#48A8F8" />
      <stop offset="1" stop-color="#B9F1E4" />
    </linearGradient>
    <linearGradient id="inner-gradient" x1="632" y1="610" x2="749" y2="610" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#17317E" />
      <stop offset="0.55" stop-color="#225FD4" />
      <stop offset="1" stop-color="#2F85FF" />
    </linearGradient>
  </defs>
  <path d="${topPath}" fill="url(#top-gradient)" />
  <path d="${bottomPath}" fill="url(#bottom-gradient)" />
  <path d="${rightPath}" fill="url(#right-gradient)" />
  <path d="${darkInnerPath}" fill="url(#inner-gradient)" />
</svg>`;

  const outputSvgPath = path.join(outputDir, 'traced-logo.svg');
  await writeFile(outputSvgPath, svg, 'utf8');
  console.log(`generated ${outputSvgPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

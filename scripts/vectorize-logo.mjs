import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const ImageTracer = require('imagetracerjs');
const { Resvg } = require('@resvg/resvg-js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const inputPath = path.join(repoRoot, 'public', 'logo.png');
const outputDir = path.join(repoRoot, 'scripts', 'vectorize-output');
const currentSvgPath = path.join(repoRoot, 'public', 'logo-programatica.svg');

const presets = {
  posterized2: 'posterized2',
  detailed: 'detailed',
  sharp: 'sharp',
  custom_logo: {
    ltres: 0.5,
    qtres: 0.5,
    pathomit: 4,
    colorsampling: 0,
    numberofcolors: 12,
    mincolorratio: 0,
    colorquantcycles: 3,
    layering: 0,
    strokewidth: 0,
    linefilter: true,
    roundcoords: 1,
    blurradius: 0,
    blurdelta: 20,
    scale: 1,
  },
};

function loadPngImageData(bytes) {
  const png = PNG.sync.read(bytes);
  return {
    width: png.width,
    height: png.height,
    data: png.data,
  };
}

function renderSvgToPng(svgString) {
  const resvg = new Resvg(svgString, {
    fitTo: {
      mode: 'original',
    },
  });

  return resvg.render().asPng();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const bytes = await readFile(inputPath);
  const imageData = loadPngImageData(bytes);

  for (const [name, options] of Object.entries(presets)) {
    const svgString = ImageTracer.imagedataToSVG(imageData, options);
    const svgPath = path.join(outputDir, `${name}.svg`);
    const pngPath = path.join(outputDir, `${name}.png`);
    await writeFile(svgPath, svgString, 'utf8');
    await writeFile(pngPath, renderSvgToPng(svgString));
    console.log(`generated ${name}`);
  }

  const currentSvg = await readFile(currentSvgPath, 'utf8');
  await writeFile(path.join(outputDir, 'current-logo-programatica.png'), renderSvgToPng(currentSvg));
  console.log('rendered current-logo-programatica');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

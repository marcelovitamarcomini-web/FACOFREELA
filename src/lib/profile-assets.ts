import type { ProfileAssetKind } from '../../shared/contracts';

export const acceptedImageTypes = 'image/jpeg,image/png,image/webp,image/avif';

export const profileAssetGuidelines = {
  avatar: {
    aspectRatio: 1,
    maximumFileSizeLabel: '5 MB',
    minimumHeight: 400,
    minimumWidth: 400,
    outputHeight: 800,
    outputWidth: 800,
    recommendedSize: '800 x 800 px',
  },
  banner: {
    aspectRatio: 3,
    maximumFileSizeLabel: '8 MB',
    minimumHeight: 400,
    minimumWidth: 1200,
    outputHeight: 500,
    outputWidth: 1500,
    recommendedSize: '1500 x 500 px',
  },
} as const;

const cropPreviewViewportSize: Record<ProfileAssetKind, { height: number; width: number }> = {
  avatar: {
    height: 280,
    width: 280,
  },
  banner: {
    height: 120,
    width: 360,
  },
};

function outputFileTypeFromInput(inputType: string): { extension: string; mimeType: string } {
  switch (inputType) {
    case 'image/png':
      return { extension: 'png', mimeType: 'image/png' };
    case 'image/webp':
      return { extension: 'webp', mimeType: 'image/webp' };
    default:
      return { extension: 'jpg', mimeType: 'image/jpeg' };
  }
}

export function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function getProfileAssetCropViewportSize(kind: ProfileAssetKind) {
  return cropPreviewViewportSize[kind];
}

export async function readImageDimensions(file: File): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        height: image.naturalHeight,
        width: image.naturalWidth,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('N?o foi poss?vel ler as dimens?es da imagem enviada.'));
    };

    image.src = objectUrl;
  });
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('N?o foi poss?vel carregar a imagem para edi??o.'));
    };

    image.src = objectUrl;
  });
}

export function getProfileAssetTransformMetrics(input: {
  imageHeight: number;
  imageWidth: number;
  viewportHeight: number;
  viewportWidth: number;
  zoom: number;
}) {
  const baseScale = Math.max(
    input.viewportWidth / input.imageWidth,
    input.viewportHeight / input.imageHeight,
  );
  const scale = baseScale * input.zoom;

  return {
    maxOffsetX: Math.max(0, (input.imageWidth * scale - input.viewportWidth) / 2),
    maxOffsetY: Math.max(0, (input.imageHeight * scale - input.viewportHeight) / 2),
    scale,
  };
}

export async function cropProfileAssetFile(input: {
  file: File;
  kind: ProfileAssetKind;
  offsetX: number;
  offsetY: number;
  viewportHeight: number;
  viewportWidth: number;
  zoom: number;
}): Promise<File> {
  const image = await loadImageElement(input.file);
  const guideline = profileAssetGuidelines[input.kind];
  const metrics = getProfileAssetTransformMetrics({
    imageHeight: image.naturalHeight,
    imageWidth: image.naturalWidth,
    viewportHeight: input.viewportHeight,
    viewportWidth: input.viewportWidth,
    zoom: input.zoom,
  });

  const safeOffsetX = clampNumber(input.offsetX, -metrics.maxOffsetX, metrics.maxOffsetX);
  const safeOffsetY = clampNumber(input.offsetY, -metrics.maxOffsetY, metrics.maxOffsetY);

  const sourceWidth = input.viewportWidth / metrics.scale;
  const sourceHeight = input.viewportHeight / metrics.scale;
  const sourceX = clampNumber(
    image.naturalWidth / 2 + (-input.viewportWidth / 2 - safeOffsetX) / metrics.scale,
    0,
    image.naturalWidth - sourceWidth,
  );
  const sourceY = clampNumber(
    image.naturalHeight / 2 + (-input.viewportHeight / 2 - safeOffsetY) / metrics.scale,
    0,
    image.naturalHeight - sourceHeight,
  );

  const canvas = document.createElement('canvas');
  canvas.width = guideline.outputWidth;
  canvas.height = guideline.outputHeight;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('N?o foi poss?vel preparar a imagem para envio.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const output = outputFileTypeFromInput(input.file.type);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, output.mimeType, output.mimeType === 'image/jpeg' ? 0.92 : undefined);
  });

  if (!blob) {
    throw new Error('N?o foi poss?vel finalizar a imagem editada.');
  }

  return new File([blob], `${input.kind}.${output.extension}`, {
    lastModified: Date.now(),
    type: output.mimeType,
  });
}

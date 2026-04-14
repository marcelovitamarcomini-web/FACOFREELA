import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import type { ProfileAssetKind } from '../../shared/contracts';
import {
  clampNumber,
  cropProfileAssetFile,
  getProfileAssetCropViewportSize,
  getProfileAssetTransformMetrics,
  profileAssetGuidelines,
  readImageDimensions,
} from '../lib/profile-assets';

interface ImageCropDialogProps {
  file: File;
  kind: ProfileAssetKind;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void>;
}

type DragState = {
  pointerId: number;
  startOffsetX: number;
  startOffsetY: number;
  startX: number;
  startY: number;
};

export function ImageCropDialog({
  file,
  kind,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [dimensions, setDimensions] = useState<{ height: number; width: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(getProfileAssetCropViewportSize(kind).width);
  const [viewportHeight, setViewportHeight] = useState(getProfileAssetCropViewportSize(kind).height);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guideline = profileAssetGuidelines[kind];
  const title = kind === 'avatar' ? 'Editar foto de perfil' : 'Editar banner';

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setError(null);
    void readImageDimensions(file).then(setDimensions).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível abrir a imagem.');
    });

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const element = previewRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setViewportWidth(entry.contentRect.width);
      setViewportHeight(entry.contentRect.height);
    });

    resizeObserver.observe(element);
    setViewportWidth(element.clientWidth);
    setViewportHeight(element.clientHeight);

    return () => resizeObserver.disconnect();
  }, [kind]);

  const transformMetrics = useMemo(() => {
    if (!dimensions) {
      return null;
    }

    return getProfileAssetTransformMetrics({
      imageHeight: dimensions.height,
      imageWidth: dimensions.width,
      viewportHeight,
      viewportWidth,
      zoom,
    });
  }, [dimensions, viewportHeight, viewportWidth, zoom]);

  useEffect(() => {
    if (!transformMetrics) {
      return;
    }

    setOffsetX((current) =>
      clampNumber(current, -transformMetrics.maxOffsetX, transformMetrics.maxOffsetX),
    );
    setOffsetY((current) =>
      clampNumber(current, -transformMetrics.maxOffsetY, transformMetrics.maxOffsetY),
    );
  }, [transformMetrics]);

  function commitDrag(nextX: number, nextY: number) {
    if (!transformMetrics) {
      return;
    }

    setOffsetX(clampNumber(nextX, -transformMetrics.maxOffsetX, transformMetrics.maxOffsetX));
    setOffsetY(clampNumber(nextY, -transformMetrics.maxOffsetY, transformMetrics.maxOffsetY));
  }

  async function handleSave() {
    if (!dimensions) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const editedFile = await cropProfileAssetFile({
        file,
        kind,
        offsetX,
        offsetY,
        viewportHeight,
        viewportWidth,
        zoom,
      });
      await onConfirm(editedFile);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível editar a imagem.');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!transformMetrics) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    commitDrag(
      dragState.startOffsetX + (event.clientX - dragState.startX),
      dragState.startOffsetY + (event.clientY - dragState.startY),
    );
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="w-full max-w-[38rem] rounded-[32px] border border-white/70 bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0071e3]">
              Editor de imagem
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Arraste para centralizar e use o zoom para ajustar a imagem antes de salvar.
            </p>
          </div>
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            onClick={onCancel}
            type="button"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50/80 p-4">
          <div
            className={`relative mx-auto overflow-hidden border border-slate-200 bg-slate-100 ${
              kind === 'avatar'
                ? 'aspect-square w-full max-w-[18rem] rounded-[28px]'
                : 'aspect-[3/1] w-full max-w-[30rem] rounded-[24px]'
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            ref={previewRef}
          >
            {previewUrl && transformMetrics && dimensions ? (
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 select-none"
                style={{
                  height: dimensions.height * transformMetrics.scale,
                  transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
                  width: dimensions.width * transformMetrics.scale,
                }}
              >
                <img
                  alt={kind === 'avatar' ? 'Preview da foto de perfil' : 'Preview do banner'}
                  className="h-full w-full object-cover"
                  draggable={false}
                  src={previewUrl}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Carregando imagem...
              </div>
            )}
          </div>

          <div className="mt-5 space-y-3">
            <label className="block space-y-2">
              <span className="flex items-center justify-between text-sm font-semibold text-slate-700">
                Zoom
                <span className="text-xs font-medium text-slate-500">{zoom.toFixed(1)}x</span>
              </span>
              <input
                className="w-full accent-[#0071e3]"
                max="3"
                min="1"
                onChange={(event) => setZoom(Number(event.target.value))}
                step="0.05"
                type="range"
                value={zoom}
              />
            </label>

            <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <p>Ideal: {guideline.recommendedSize}</p>
              <p className="mt-1">
                Mínimo: {guideline.minimumWidth} x {guideline.minimumHeight} px. Máximo de arquivo:{' '}
                {guideline.maximumFileSizeLabel}.
              </p>
            </div>

            {error ? (
              <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="rounded-full bg-[#0071e3] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={submitting || !dimensions}
            onClick={() => void handleSave()}
            type="button"
          >
            {submitting ? 'Salvando...' : 'Salvar imagem'}
          </button>
        </div>
      </div>
    </div>
  );
}

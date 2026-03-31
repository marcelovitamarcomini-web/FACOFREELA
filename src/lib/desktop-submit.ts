import type { KeyboardEvent } from 'react';

function isDesktopKeyboardContext() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function handleDesktopEnterSubmit(
  event: KeyboardEvent<HTMLTextAreaElement>,
  form?: HTMLFormElement | null,
) {
  if (
    event.key !== 'Enter' ||
    event.shiftKey ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.nativeEvent.isComposing ||
    !isDesktopKeyboardContext()
  ) {
    return;
  }

  event.preventDefault();
  (form ?? event.currentTarget.form)?.requestSubmit();
}

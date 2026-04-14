import { onlyDigits } from './phone';

function normalizeWhatsappDigits(value?: string | null) {
  const digits = onlyDigits(value ?? '');
  if (!digits) {
    return '';
  }

  return digits.startsWith('55') ? digits : `55${digits}`;
}

export function buildWhatsappUrl(value?: string | null, intro?: string) {
  const digits = normalizeWhatsappDigits(value);
  if (!digits) {
    return '';
  }

  const message = intro?.trim()
    ? `?text=${encodeURIComponent(intro.trim())}`
    : '';

  return `https://wa.me/${digits}${message}`;
}

export function countExternalContactChannels(input: {
  whatsapp?: string | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
}) {
  return [input.whatsapp, input.websiteUrl, input.linkedinUrl].filter(Boolean).length;
}

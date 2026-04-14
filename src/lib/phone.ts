import {
  BRAZIL_DDDS,
  isValidBrazilDdd,
  normalizeBrazilDdd,
  onlyDigits,
} from '../../shared/phone';

export { BRAZIL_DDDS, isValidBrazilDdd, normalizeBrazilDdd, onlyDigits };

export const BRAZIL_COUNTRY_CODE = '+55';

export function formatBrazilPhoneLocal(value: string) {
  const digits = onlyDigits(value).slice(0, 9);

  if (digits.length <= 4) {
    return digits;
  }

  if (digits.length <= 8) {
    return `${digits.slice(0, digits.length - 4)}-${digits.slice(-4)}`;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function composeBrazilPhone(ddd: string, phoneNumber: string) {
  const normalizedDdd = normalizeBrazilDdd(ddd);
  const formattedNumber = formatBrazilPhoneLocal(phoneNumber);

  if (!isValidBrazilDdd(normalizedDdd) || !formattedNumber) {
    return '';
  }

  return `${BRAZIL_COUNTRY_CODE} (${normalizedDdd}) ${formattedNumber}`;
}

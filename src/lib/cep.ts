export type CepLookupResult = {
  cep: string;
  city: string;
  state: string;
};

type ViaCepResponse = {
  cep?: string;
  erro?: boolean;
  localidade?: string;
  uf?: string;
};

export class CepLookupError extends Error {
  kind: 'invalid' | 'not_found' | 'unavailable';

  constructor(kind: 'invalid' | 'not_found' | 'unavailable', message: string) {
    super(message);
    this.kind = kind;
    this.name = 'CepLookupError';
  }
}

export function sanitizeCep(value?: string | null) {
  return value?.replace(/\D/g, '').slice(0, 8) ?? '';
}

export function formatCep(value?: string | null) {
  const digits = sanitizeCep(value);
  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isValidCep(value?: string | null) {
  return sanitizeCep(value).length === 8;
}

export async function lookupCep(
  value: string,
  init?: Pick<RequestInit, 'signal'>,
): Promise<CepLookupResult> {
  const cep = sanitizeCep(value);

  if (!isValidCep(cep)) {
    throw new CepLookupError('invalid', 'Informe um CEP com 8 d?gitos.');
  }

  let response: Response;
  try {
    response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: {
        Accept: 'application/json',
      },
      signal: init?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new CepLookupError(
      'unavailable',
      'N?o foi poss?vel consultar o CEP agora. Tente novamente em instantes.',
    );
  }

  if (!response.ok) {
    throw new CepLookupError(
      'unavailable',
      'N?o foi poss?vel consultar o CEP agora. Tente novamente em instantes.',
    );
  }

  const payload = (await response.json()) as ViaCepResponse;

  if (payload.erro) {
    throw new CepLookupError('not_found', 'N?o encontramos esse CEP. Revise e tente de novo.');
  }

  const city = payload.localidade?.trim();
  const state = payload.uf?.trim().toUpperCase();

  if (!city || !state) {
    throw new CepLookupError(
      'unavailable',
      'O ViaCEP n?o retornou cidade e estado para esse CEP.',
    );
  }

  return {
    cep,
    city,
    state,
  };
}

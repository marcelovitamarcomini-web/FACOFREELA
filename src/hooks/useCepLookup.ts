import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getBrazilCitiesByState,
  isBrazilStateCode,
  OTHER_BRAZIL_CITY_OPTION,
} from '../lib/brazil-states';
import {
  CepLookupError,
  formatCep,
  isValidCep,
  lookupCep,
  sanitizeCep,
  type CepLookupResult,
} from '../lib/cep';

type CepFormValue = {
  cep: string;
  city: string;
  state: string;
};

type CepLookupFeedback = {
  tone: 'error' | 'info' | 'success';
  text: string;
};

type LocationValidationField = 'cep' | 'state' | 'city';

function normalizeLocationValue(value?: Partial<CepFormValue>) {
  return {
    cep: formatCep(value?.cep),
    city: value?.city?.trim() ?? '',
    state: value?.state?.trim().toUpperCase() ?? '',
  } satisfies CepFormValue;
}

function isCityInList(city: string, cityOptions: string[]) {
  const normalizedCity = city.trim().toLocaleLowerCase('pt-BR');
  return cityOptions.some(
    (option) => option.trim().toLocaleLowerCase('pt-BR') === normalizedCity,
  );
}

export function useCepLookup(initialValue?: Partial<CepFormValue>) {
  const [value, setValue] = useState<CepFormValue>(normalizeLocationValue(initialValue));
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<CepLookupFeedback | null>(null);
  const [showManualLocationFields, setShowManualLocationFields] = useState(false);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [cityOptionsLoading, setCityOptionsLoading] = useState(false);
  const [cityOptionsError, setCityOptionsError] = useState<string | null>(null);
  const [useCustomCityInput, setUseCustomCityInput] = useState(false);
  const cepAbortRef = useRef<AbortController | null>(null);
  const cityAbortRef = useRef<AbortController | null>(null);
  const lastResolvedCepRef = useRef(sanitizeCep(initialValue?.cep));

  useEffect(() => {
    return () => {
      cepAbortRef.current?.abort();
      cityAbortRef.current?.abort();
    };
  }, []);

  const syncCustomCityMode = useCallback((nextCity: string, nextCityOptions: string[]) => {
    const normalizedCity = nextCity.trim();
    if (!normalizedCity) {
      setUseCustomCityInput(false);
      return;
    }

    setUseCustomCityInput(!isCityInList(normalizedCity, nextCityOptions));
  }, []);

  const resetManualLocationState = useCallback(() => {
    cityAbortRef.current?.abort();
    setShowManualLocationFields(false);
    setCityOptions([]);
    setCityOptionsError(null);
    setCityOptionsLoading(false);
    setUseCustomCityInput(false);
  }, []);

  const loadCityOptions = useCallback(
    async (stateCode: string, nextCity = '') => {
      const normalizedState = stateCode.trim().toUpperCase();

      cityAbortRef.current?.abort();

      if (!isBrazilStateCode(normalizedState)) {
        setCityOptions([]);
        setCityOptionsError(null);
        setCityOptionsLoading(false);
        setUseCustomCityInput(Boolean(nextCity.trim()));
        return [];
      }

      const controller = new AbortController();
      cityAbortRef.current = controller;
      setCityOptionsLoading(true);
      setCityOptionsError(null);

      try {
        const nextCityOptions = await getBrazilCitiesByState(normalizedState, {
          signal: controller.signal,
        });

        if (cityAbortRef.current !== controller) {
          return nextCityOptions;
        }

        setCityOptions(nextCityOptions);
        syncCustomCityMode(nextCity, nextCityOptions);
        return nextCityOptions;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return [];
        }

        if (cityAbortRef.current !== controller) {
          return [];
        }

        setCityOptions([]);
        setCityOptionsError(
          'Não foi possível carregar as cidades agora. Você pode escolher "Outro" e informar manualmente.',
        );
        setUseCustomCityInput(true);
        return [];
      } finally {
        if (cityAbortRef.current === controller) {
          cityAbortRef.current = null;
          setCityOptionsLoading(false);
        }
      }
    },
    [syncCustomCityMode],
  );

  const applyStoredValue = useCallback(
    (nextValue?: Partial<CepFormValue>) => {
      const normalizedValue = normalizeLocationValue(nextValue);
      cepAbortRef.current?.abort();
      setLoading(false);
      setValue(normalizedValue);
      lastResolvedCepRef.current = sanitizeCep(normalizedValue.cep);
      setFeedback(null);
      resetManualLocationState();
    },
    [resetManualLocationState],
  );

  function handleCepInput(rawCep: string) {
    const formattedCep = formatCep(rawCep);
    const sanitizedCep = sanitizeCep(formattedCep);

    setValue((current) => ({
      ...current,
      cep: formattedCep,
      city: sanitizedCep.length === 8 ? current.city : '',
      state: sanitizedCep.length === 8 ? current.state : '',
    }));

    if (sanitizedCep.length < 8) {
      setFeedback(null);
      if (!sanitizedCep) {
        resetManualLocationState();
      }
    }
  }

  async function resolveCep(rawCep?: string, options?: { force?: boolean }) {
    const nextCep = sanitizeCep(rawCep ?? value.cep);

    if (!nextCep) {
      setFeedback(null);
      setValue((current) => ({
        ...current,
        city: '',
        state: '',
      }));
      resetManualLocationState();
      return null;
    }

    if (!isValidCep(nextCep)) {
      setFeedback({
        tone: 'error',
        text: 'Informe um CEP com 8 dígitos.',
      });
      setValue((current) => ({
        ...current,
        city: '',
        state: '',
      }));
      resetManualLocationState();
      return null;
    }

    if (
      !options?.force &&
      nextCep === lastResolvedCepRef.current &&
      value.city.trim() &&
      value.state.trim()
    ) {
      return {
        cep: nextCep,
        city: value.city.trim(),
        state: value.state.trim(),
      } satisfies CepLookupResult;
    }

    cepAbortRef.current?.abort();
    const controller = new AbortController();
    cepAbortRef.current = controller;

    setLoading(true);
    setFeedback({
      tone: 'info',
      text: 'Consultando CEP...',
    });

    try {
      const result = await lookupCep(nextCep, {
        signal: controller.signal,
      });

      if (cepAbortRef.current !== controller) {
        return result;
      }

      setValue({
        cep: formatCep(result.cep),
        city: result.city,
        state: result.state,
      });
      lastResolvedCepRef.current = result.cep;
      resetManualLocationState();
      setFeedback({
        tone: 'success',
        text: `Base principal identificada: ${result.state} | ${result.city}.`,
      });
      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null;
      }

      if (cepAbortRef.current !== controller) {
        return null;
      }

      setValue((current) => {
        if (sanitizeCep(current.cep) !== nextCep) {
          return current;
        }

        return {
          ...current,
          city: '',
          state: '',
        };
      });

      if (error instanceof CepLookupError) {
        if (error.kind === 'invalid') {
          resetManualLocationState();
          setFeedback({
            tone: 'error',
            text: error.message,
          });
          return null;
        }

        setShowManualLocationFields(true);
        setCityOptions([]);
        setCityOptionsError(null);
        setUseCustomCityInput(false);
        setFeedback({
          tone: 'error',
          text:
            error.kind === 'not_found'
              ? 'CEP não encontrado. Selecione estado e cidade para continuar.'
              : 'Não foi possível confirmar o CEP agora. Selecione estado e cidade para continuar.',
        });
        return null;
      }

      resetManualLocationState();
      setFeedback({
        tone: 'error',
        text: 'Não foi possível consultar o CEP agora. Tente novamente em instantes.',
      });
      return null;
    } finally {
      if (cepAbortRef.current === controller) {
        cepAbortRef.current = null;
        setLoading(false);
      }
    }
  }

  async function handleManualStateChange(nextState: string) {
    const normalizedState = nextState.trim().toUpperCase();

    setShowManualLocationFields(true);
    setFeedback(null);
    setCityOptionsError(null);
    setUseCustomCityInput(false);
    setValue((current) => ({
      ...current,
      state: normalizedState,
      city: '',
    }));

    if (!normalizedState) {
      cityAbortRef.current?.abort();
      setCityOptions([]);
      setCityOptionsLoading(false);
      return;
    }

    await loadCityOptions(normalizedState);
  }

  function handleManualCitySelect(nextCity: string) {
    setFeedback(null);
    setCityOptionsError(null);

    if (nextCity === OTHER_BRAZIL_CITY_OPTION) {
      setUseCustomCityInput(true);
      setValue((current) => ({
        ...current,
        city: '',
      }));
      return;
    }

    setUseCustomCityInput(false);
    setValue((current) => ({
      ...current,
      city: nextCity,
    }));
  }

  function handleCustomCityInput(nextCity: string) {
    setFeedback(null);
    setUseCustomCityInput(true);
    setValue((current) => ({
      ...current,
      city: nextCity,
    }));
  }

  function validateResolvedLocation() {
    const cep = sanitizeCep(value.cep);

    if (!cep) {
      return {
        ok: false as const,
        field: 'cep' satisfies LocationValidationField,
        message: 'Informe o CEP principal de atendimento.',
      };
    }

    if (!isValidCep(cep)) {
      return {
        ok: false as const,
        field: 'cep' satisfies LocationValidationField,
        message: 'Informe um CEP com 8 dígitos.',
      };
    }

    if (!isBrazilStateCode(value.state)) {
      return {
        ok: false as const,
        field: 'state' satisfies LocationValidationField,
        message: 'Selecione o estado principal de atendimento.',
      };
    }

    if (!value.city.trim()) {
      return {
        ok: false as const,
        field: 'city' satisfies LocationValidationField,
        message: useCustomCityInput
          ? 'Informe a cidade principal de atendimento.'
          : 'Selecione a cidade principal de atendimento.',
      };
    }

    return {
      ok: true as const,
      value: {
        cep,
        city: value.city.trim(),
        state: value.state.trim(),
      },
    };
  }

  const manualCitySelectValue = useMemo(() => {
    if (useCustomCityInput) {
      return OTHER_BRAZIL_CITY_OPTION;
    }

    return isCityInList(value.city, cityOptions) ? value.city : '';
  }, [cityOptions, useCustomCityInput, value.city]);

  return {
    value,
    applyStoredValue,
    handleCepInput,
    resolveCep,
    validateResolvedLocation,
    handleManualStateChange,
    handleManualCitySelect,
    handleCustomCityInput,
    loading,
    feedback,
    showManualLocationFields,
    cityOptions,
    cityOptionsLoading,
    cityOptionsError,
    useCustomCityInput,
    manualCitySelectValue,
  };
}

export const BRAZIL_STATES = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
] as const;

type BrazilStateCode = (typeof BRAZIL_STATES)[number]['code'];
type IbgeCityRow = {
  nome?: string;
};

const brazilStateCodeSet = new Set<string>(BRAZIL_STATES.map((state) => state.code));
const brazilCitiesByStateCache = new Map<BrazilStateCode, string[]>();

export const OTHER_BRAZIL_CITY_OPTION = '__other__';

export function isBrazilStateCode(value?: string | null): value is BrazilStateCode {
  return brazilStateCodeSet.has(value?.trim().toUpperCase() ?? '');
}

export async function getBrazilCitiesByState(
  stateCode: string,
  init?: Pick<RequestInit, 'signal'>,
) {
  const normalizedState = stateCode.trim().toUpperCase();

  if (!isBrazilStateCode(normalizedState)) {
    return [];
  }

  const cachedCities = brazilCitiesByStateCache.get(normalizedState);
  if (cachedCities) {
    return cachedCities;
  }

  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${normalizedState}/municipios`,
    {
      headers: {
        Accept: 'application/json',
      },
      signal: init?.signal,
    },
  );

  if (!response.ok) {
    throw new Error('Não foi possível carregar as cidades desse estado agora.');
  }

  const payload = (await response.json()) as IbgeCityRow[];
  const cities = Array.from(
    new Set(
      payload
        .map((city) => city.nome?.trim())
        .filter((cityName): cityName is string => Boolean(cityName)),
    ),
  ).sort((firstCity, secondCity) => firstCity.localeCompare(secondCity, 'pt-BR'));

  brazilCitiesByStateCache.set(normalizedState, cities);
  return cities;
}

export function buildBrazilLocation(city: string, state: string) {
  return [city.trim(), state.trim()].filter(Boolean).join(', ');
}

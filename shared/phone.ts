export const BRAZIL_DDDS = [
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '21',
  '22',
  '24',
  '27',
  '28',
  '31',
  '32',
  '33',
  '34',
  '35',
  '37',
  '38',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '49',
  '51',
  '53',
  '54',
  '55',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '67',
  '68',
  '69',
  '71',
  '73',
  '74',
  '75',
  '77',
  '79',
  '81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '89',
  '91',
  '92',
  '93',
  '94',
  '95',
  '96',
  '97',
  '98',
  '99',
] as const;

const BRAZIL_DDD_SET = new Set<string>(BRAZIL_DDDS);
const brazilPhonePattern = /^\+55 \((\d{2})\) \d{4,5}-\d{4}$/;

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function normalizeBrazilDdd(value: string) {
  return onlyDigits(value).slice(0, 2);
}

export function isValidBrazilDdd(value: string) {
  return BRAZIL_DDD_SET.has(normalizeBrazilDdd(value));
}

export function extractBrazilPhoneDdd(value: string) {
  const match = value.match(brazilPhonePattern);
  return match?.[1] ?? '';
}

export function isValidBrazilPhone(value: string) {
  if (!brazilPhonePattern.test(value)) {
    return false;
  }

  return isValidBrazilDdd(extractBrazilPhoneDdd(value));
}

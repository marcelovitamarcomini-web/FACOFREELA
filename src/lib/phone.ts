export const BRAZIL_COUNTRY_CODE = '+55';

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

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

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
  const normalizedDdd = onlyDigits(ddd).slice(0, 2);
  const formattedNumber = formatBrazilPhoneLocal(phoneNumber);

  if (!normalizedDdd || !formattedNumber) {
    return '';
  }

  return `${BRAZIL_COUNTRY_CODE} (${normalizedDdd}) ${formattedNumber}`;
}

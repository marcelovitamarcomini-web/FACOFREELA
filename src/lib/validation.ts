import type { ZodError } from 'zod';

export function getFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors = error.flatten().fieldErrors;

  return Object.entries(fieldErrors).reduce<Record<string, string>>(
    (accumulator, [field, messages]) => {
      const firstMessage = Array.isArray(messages) ? messages[0] : undefined;
      if (firstMessage) {
        accumulator[field] = firstMessage;
      }

      return accumulator;
    },
    {},
  );
}

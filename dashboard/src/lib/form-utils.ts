export type FormDataObject = Record<string, unknown>;

export function getFormDataObject(e: React.FormEvent<HTMLFormElement>): FormDataObject {
  const form = e.currentTarget;
  const raw = new FormData(form);
  const result: FormDataObject = {};

  for (const [rawKey, value] of raw.entries()) {
    if (value instanceof File && value.name === '') continue;

    const coerced = typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

    const arrayMatch = rawKey.match(/^(.+)\[\]$/);
    if (arrayMatch) {
      const key = arrayMatch[1];
      if (!Array.isArray(result[key])) result[key] = [];
      (result[key] as unknown[]).push(coerced);
      continue;
    }

    if (rawKey.includes('.')) {
      const parts = rawKey.split('.');
      let cursor = result;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') {
          cursor[parts[i]] = {};
        }
        cursor = cursor[parts[i]] as FormDataObject;
      }
      cursor[parts[parts.length - 1]] = coerced;
      continue;
    }

    result[rawKey] = coerced;
  }

  return result;
}

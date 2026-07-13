import { describe, it, expect } from 'vitest';
import type { FormEvent } from 'react';
import { getFormDataObject } from './form-utils';
import { cn } from '@/lib/utils';

function buildFormEvent(fields: Array<{ name: string; value: string }>): FormEvent<HTMLFormElement> {
  const form = document.createElement('form');
  for (const { name, value } of fields) {
    const input = document.createElement('input');
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  return { currentTarget: form } as unknown as FormEvent<HTMLFormElement>;
}

describe('getFormDataObject', () => {
  it('extracts flat string fields, trimmed', () => {
    const event = buildFormEvent([
      { name: 'email', value: '  test@example.com  ' },
      { name: 'password', value: 'secret' },
    ]);
    expect(getFormDataObject(event)).toEqual({ email: 'test@example.com', password: 'secret' });
  });

  it('coerces empty/whitespace-only values to null', () => {
    const event = buildFormEvent([{ name: 'notes', value: '   ' }]);
    expect(getFormDataObject(event)).toEqual({ notes: null });
  });

  it('collects array-keyed fields (name[]) into arrays', () => {
    const event = buildFormEvent([
      { name: 'tags[]', value: 'a' },
      { name: 'tags[]', value: 'b' },
    ]);
    expect(getFormDataObject(event)).toEqual({ tags: ['a', 'b'] });
  });

  it('builds nested objects from dotted keys', () => {
    const event = buildFormEvent([
      { name: 'address.city', value: 'Pune' },
      { name: 'address.zip', value: '411001' },
    ]);
    expect(getFormDataObject(event)).toEqual({ address: { city: 'Pune', zip: '411001' } });
  });
});

describe('@ alias resolution (regression: vitest must inherit vite.config.ts alias)', () => {
  it('resolves `@/lib/utils` and runs `cn`', () => {
    expect(typeof cn('a', 'b')).toBe('string');
    expect(cn('a', 'b')).toBe('a b');
  });
});

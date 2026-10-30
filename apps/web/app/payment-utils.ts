export function parseEuroMinorUnits(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const [whole, fraction = ''] = normalized.split('.');
  const amount = Number(`${whole}${fraction.padEnd(2, '0')}`);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
}

export function formatEuro(amount: number): string {
  const digits = String(amount).padStart(3, '0');
  return `EUR ${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

export interface SavedIdentity {
  id: string;
  username: string;
}

export function readIdentities(value: string | null): SavedIdentity[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is SavedIdentity =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof entry.id === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.id) &&
          typeof entry.username === 'string' &&
          entry.username.length > 0,
      )
      .map(({ id, username }) => ({ id, username }));
  } catch {
    return [];
  }
}

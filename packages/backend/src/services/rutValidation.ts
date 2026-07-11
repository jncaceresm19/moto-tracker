export function validateRut(rut: string): boolean {
  const cleaned = rut.replace(/[\.\-\s]/g, '').toUpperCase();

  if (!/^\d+[0-9K]$/.test(cleaned)) return false;
  if (cleaned.length < 2) return false;

  const body = cleaned.slice(0, -1);
  const expectedCheck = cleaned.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const computedCheck = remainder === 0 ? '0' : remainder === 1 ? 'K' : (11 - remainder).toString();

  return computedCheck === expectedCheck;
}

export function normalizeRut(rut: string): string {
  return rut.replace(/[\.\-\s]/g, '').toUpperCase();
}

export function formatRut(rut: string): string {
  const normalized = normalizeRut(rut);
  const body = normalized.slice(0, -1);
  const check = normalized.slice(-1);

  let formatted = '';
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) {
      formatted = '.' + formatted;
    }
    formatted = body[i] + formatted;
    count++;
  }

  return `${formatted}-${check}`;
}

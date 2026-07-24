const OLD_PLATE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{2}$/;
const NEW_PLATE_REGEX = /^[A-Z]{4}[0-9]{2}$/;
const MOTORCYCLE_OLD_REGEX = /^[A-Z]{3}[0-9]{2,3}$/;

export interface PlateValidationResult {
  valid: boolean;
  format?: 'old' | 'new' | 'motorcycle_old';
  normalized: string;
  checkDigit?: string;
}

export interface PlateParts {
  letters: string;
  numbers: string;
}

export function stripCheckDigit(rawPlate: string): { plate: string; checkDigit?: string } {
  const withoutDots = rawPlate.toUpperCase().replace(/[\s.]/g, '');
  const parts = withoutDots.split('-');

  if (parts.length === 2 && /^[0-9K]$/.test(parts[1])) {
    return { plate: parts[0], checkDigit: parts[1] };
  }

  return { plate: parts.join('') };
}

function normalizeLeadingZeros(plate: string): string {
  const match = plate.match(/^([A-Z]+)(0*)([0-9]+)$/);
  if (!match) return plate;
  const [, letters, , digits] = match;
  return `${letters}${digits}`;
}

export function getDisplayPlateParts(rawPlate: string): PlateParts {
  const { plate } = stripCheckDigit(rawPlate);
  const normalized = normalizeLeadingZeros(plate.replace(/[\s\-]/g, ''));
  const match = normalized.match(/^([A-Z]+)([0-9]+)$/);
  if (match) return { letters: match[1], numbers: match[2] };
  return { letters: normalized, numbers: '' };
}

export function formatPlate(raw: string): string {
  const { letters, numbers } = getDisplayPlateParts(raw);
  return numbers ? `${letters}-${numbers}` : letters;
}

export function validatePlate(rawPlate: string): PlateValidationResult {
  const { plate, checkDigit } = stripCheckDigit(rawPlate);
  const normalized = normalizeLeadingZeros(plate.replace(/[\s\-]/g, ''));

  if (OLD_PLATE_REGEX.test(normalized)) {
    return { valid: true, format: 'old', normalized, checkDigit };
  }
  if (NEW_PLATE_REGEX.test(normalized)) {
    return { valid: true, format: 'new', normalized, checkDigit };
  }
  if (MOTORCYCLE_OLD_REGEX.test(normalized)) {
    return { valid: true, format: 'motorcycle_old', normalized, checkDigit };
  }

  return { valid: false, normalized };
}
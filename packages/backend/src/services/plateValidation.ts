const OLD_PLATE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{2}$/;
const NEW_PLATE_REGEX = /^[A-Z]{4}[0-9]{2}$/;

export interface PlateValidationResult {
  valid: boolean;
  format?: 'old' | 'new';
  normalized: string;
}

export function validatePlate(plate: string): PlateValidationResult {
  const normalized = plate.toUpperCase().replace(/[\s\-]/g, '');

  if (OLD_PLATE_REGEX.test(normalized)) {
    return { valid: true, format: 'old', normalized };
  }
  if (NEW_PLATE_REGEX.test(normalized)) {
    return { valid: true, format: 'new', normalized };
  }

  return { valid: false, normalized };
}

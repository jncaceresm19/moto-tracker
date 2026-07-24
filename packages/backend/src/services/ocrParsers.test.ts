import { describe, it, expect } from 'vitest';
import { parseDriversLicense } from './ocrParsers';

describe('parseDriversLicense', () => {
  it('should extract both dates when both labels are recognized', () => {
    const text = `LICENCIA DE CONDUCIR
RUT: 12.345.678-9
ULTIMO CONTROL 15 ENE 2020
FECHA DE CONTROL 15 ENE 2026`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    expect(result.expiryDate).toBe('2026-01-15');
  });

  it('should extract both dates with accented labels', () => {
    const text = `LICENCIA DE CONDUCIR
RUT: 12.345.678-9
ÚLTIMO CONTROL 15 ENE 2020
FECHA DE CONTROL 15 ENE 2026`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    expect(result.expiryDate).toBe('2026-01-15');
  });

  it('should extract dates when labels are on separate lines from dates', () => {
    const text = `LICENCIA DE CONDUCIR
RUT: 12.345.678-9
ÚLTIMO CONTROL
15 ENE 2020
FECHA DE CONTROL
15 ENE 2026`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    expect(result.expiryDate).toBe('2026-01-15');
  });

  it('should still find issueDate from date BEFORE "fecha de control" when "ultimo" label is missing', () => {
    // Tesseract often fails to recognize "ÚLTIMO CONTROL" — only "FECHA DE CONTROL" appears
    const text = `LICENCIA DE CONDUCIR
RUT: 12.345.678-9
15 ENE 2020
FECHA DE CONTROL 15 ENE 2026`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    expect(result.expiryDate).toBe('2026-01-15');
  });

  it('should handle garbled Tesseract output with mixed labels', () => {
    const text = `LICENCIA DE CONDUCIR
RUT 12.345.678-9
ultimo control 15/01/2020
fecha de control 15/01/2026`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    expect(result.expiryDate).toBe('2026-01-15');
  });

  it('should NOT swap dates when only one label is near both dates', () => {
    // This tests the CRITICAL FIX: forward-only search for "fecha de control"
    // Old code would find "15/01/2020" (ultimo control date) when searching backward
    // and wrongly assign it to expiryDate
    const text = `ultimo control 15/01/2020 fecha de control 15/01/2026`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    expect(result.expiryDate).toBe('2026-01-15');
  });

  it('should handle Tesseract-garbled numeric years (2079 -> 2029)', () => {
    const text = `ULTIMO CONTROL 15 ENE 2020
FECHA DE CONTROL 15 ENE 2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    // 2029 is within valid range (2015-2035), keep as-is
    expect(result.expiryDate).toBe('2029-01-15');
  });

  it('should fallback to +6 years if no expiryDate found', () => {
    const text = `LICENCIA DE CONDUCIR
ULTIMO CONTROL 15 ENE 2020`;
    // Only "ultimo control" found, no "fecha de control"
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    // Should calculate expiryDate as +6 years
    expect(result.expiryDate).toBe('2026-01-31'); // last day of month
  });

  it('should NOT take fecha de control date when it appears BEFORE ultimo control in OCR text', () => {
    // Tesseract sometimes outputs "fecha de control" info first
    const text = `LICENCIA DE CONDUCIR 15 ENE 2026 ULTIMO CONTROL 15 ENE 2020`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    expect(result.expiryDate).toBe('2026-01-15');
  });

  it('should handle pure inverted label order', () => {
    // Worst case: labels in reverse order
    const text = `FECHA DE CONTROL 15 ENE 2026 ULTIMO CONTROL 15 ENE 2020`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    expect(result.expiryDate).toBe('2026-01-15');
  });

  it('should extract issueDate from "FECHA ULTIMO" when CONTROL is hidden', () => {
    // User's exact scenario: "control" in "fecha ultimo control" is nearly
    // invisible — Tesseract only reads "FECHA ULTIMO" then the date
    const text = `LICENCIA DE CONDUCIR
FECHA ULTIMO 05/04/2023
FECHA DE CONTROL 19/04/2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should extract RUT from license', () => {
    const text = `LICENCIA DE CONDUCIR
RUT: 12.345.678-9
ULTIMO CONTROL 15 ENE 2020
FECHA DE CONTROL 15 ENE 2026`;
    const result = parseDriversLicense(text);
    expect(result.rut).toBe('12.345.678-9');
  });

  // ── NEW TESTS: edge cases from real-world Tesseract output ──────────────

  it('should handle issue date BEFORE the ultimo label in OCR output', () => {
    // Tesseract sometimes reads the date before the label due to
    // document layout and reading order
    const text = `LICENCIA DE CONDUCIR
RUT 12.345.678-9
05/04/2023 FECHA ULTIMO CONTROL
19/04/2029 FECHA DE CONTROL`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle both labels consecutive without a date between them', () => {
    // When Tesseract merges lines: "FECHA ULTIMO CONTROL FECHA DE CONTROL 05/04/2023 19/04/2029"
    // The expiry forward search would find 05/04/2023 (the issue date) first
    const text = `LICENCIA DE CONDUCIR
RUT 12.345.678-9
FECHA ULTIMO CONTROL FECHA DE CONTROL 05/04/2023 19/04/2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle only FECHA DE CONTROL recognized with single date (expiry)', () => {
    // Worst case: only "FECHA DE CONTROL" is readable, only the expiry date
    const text = `RUT 12.345.678-9
FECHA DE CONTROL 19/04/2029`;
    const result = parseDriversLicense(text);
    // The single date is near "fecha de control" → it's the expiry
    // Should calculate issueDate as -6 years from expiry
    expect(result.issueDate).toBe('2023-04-30'); // last day of Apr 2023
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle both dates on one line with labels after dates', () => {
    // Tesseract reordering: dates before labels
    const text = `05/04/2023 FECHA ULTIMO CONTROL 19/04/2029 FECHA DE CONTROL`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle ultimo label garbled with only CONTROL readable', () => {
    // "ULTIMO" is completely garbled by Tesseract, only "FECHA DE CONTROL" found
    const text = `LICENCIA DE CONDUCIR
RUT 12.345.678-9
FECHA DE CONTROL 19/04/2029
05/04/2023`;
    const result = parseDriversLicense(text);
    // "fecha de control" expiry = 2029
    // The other date 2023 should be the issue date (before "fecha de control")
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should swap dates when issueDate > expiryDate due to OCR confusion', () => {
    // Edge case: dates are read in wrong order
    const text = `ULTIMO CONTROL 19/04/2029 FECHA DE CONTROL 05/04/2023`;
    const result = parseDriversLicense(text);
    // Cross-validation should detect issueDate(2029) > expiryDate(2023) and fix
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle garbled ultimo (ult1mo) with date before label', () => {
    // Tesseract reads "ULT1MO" (1 instead of I) and date appears before label
    const text = `15/01/2020 ULT1MO CONTROL 15/01/2026 FECHA DE CONTROL`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    expect(result.expiryDate).toBe('2026-01-15');
  });

  it('should handle Spanish text dates with labels on same line', () => {
    const text = `ULTIMO CONTROL 15 DE ENERO DE 2020 FECHA DE CONTROL 15 DE ENERO DE 2026`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2020-01-15');
    expect(result.expiryDate).toBe('2026-01-15');
  });

  it('should handle single numeric date when only FECHA DE CONTROL is present', () => {
    // Only expiry expressed numerically, no second date at all
    const text = `FECHA DE CONTROL 15/01/2029`;
    const result = parseDriversLicense(text);
    // Near "fecha de control" → expiryDate
    expect(result.expiryDate).toBe('2029-01-15');
    // Should calculate issueDate from expiry - 6 years
    expect(result.issueDate).toBe('2023-01-31'); // last day of Jan 2023
  });

  // ── NEW FORMAT (municipalidad layout) ──────────────────────────────────

  it('should handle new license format: ULTIMO CONTROL + PROXIMO CONTROL under Municipalidad', () => {
    // New format: labels below "MUNICIPALIDAD", side by side
    const text = `MUNICIPALIDAD DE SANTIAGO
ULTIMO CONTROL 05/04/2023 PROXIMO CONTROL 19/04/2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle new license with accented PROXIMO CONTROL', () => {
    const text = `MUNICIPALIDAD DE PROVIDENCIA
ÚLTIMO CONTROL 05/04/2023    PRÓXIMO CONTROL 19/04/2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle new license with garbled PROX1MO CONTROL', () => {
    const text = `MUNICIPALIDAD DE LAS CONDES
ULTIMO CONTROL 05/04/2023 PROX1MO CONTROL 19/04/2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle new license with PROXIMO CONTROL first in OCR text', () => {
    // Tesseract sometimes reads right-to-left or out of order
    const text = `PROXIMO CONTROL 19/04/2029 ULTIMO CONTROL 05/04/2023`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle new license: proximo on separate line from date', () => {
    const text = `MUNICIPALIDAD DE VITACURA
ULTIMO CONTROL
05/04/2023
PROXIMO CONTROL
19/04/2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  // ── OLD FORMAT (registro civil / address-based) ────────────────────────

  it('should handle old license: date under DIRECCION is issueDate', () => {
    // Old format: address line with date below (issue date)
    const text = `LICENCIA DE CONDUCIR
RUT 12.345.678-9
DIRECCION: CALLE FALSA 123
05/04/2023
FECHA DE CONTROL 19/04/2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle old license: date under DOMICILIO is issueDate', () => {
    const text = `LICENCIA DE CONDUCIR
RUT 12.345.678-9
DOMICILIO: AV SIEMPRE VIVA 742
05/04/2023
FECHA DE CONTROL 19/04/2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle old license: DIRECCION with only fecha de control recognized', () => {
    // "ULTIMO CONTROL" not recognized, but address is present
    const text = `LICENCIA DE CONDUCIR
RUT 12.345.678-9
DIRECCION: CALLE FALSA 123
05/04/2023
FECHA DE CONTROL 19/04/2029`;
    const result = parseDriversLicense(text);
    // issueDate from date under DIRECCION
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle old license: DOMICILIO with garbled date, ULTIMO CONTROL present', () => {
    const text = `LICENCIA DE CONDUCIR
DOMICILIO CALLE FALSA 123
05/04/2023
ULTIMO CONTROL
FECHA DE CONTROL 19/04/2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  it('should handle old license: date under DIR even abbreviated', () => {
    const text = `LICENCIA DE CONDUCIR
DIR: CALLE FALSA 123
05/04/2023
FECHA DE CONTROL 19/04/2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });

  // ── MIXED / HYBRID ────────────────────────────────────────────────────

  it('should handle license with both FECHA DE CONTROL and PROXIMO CONTROL present', () => {
    // Some licenses might have both labels printed
    const text = `ULTIMO CONTROL 05/04/2023
FECHA DE CONTROL 19/04/2029
PROXIMO CONTROL 19/04/2029`;
    const result = parseDriversLicense(text);
    expect(result.issueDate).toBe('2023-04-05');
    expect(result.expiryDate).toBe('2029-04-19');
  });
});

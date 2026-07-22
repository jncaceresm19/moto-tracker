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
});

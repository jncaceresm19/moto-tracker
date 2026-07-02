import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseDatesFromText } from './ocr.js';

describe('OCR Service', () => {
  describe('parseDatesFromText', () => {
    it('should extract DD/MM/YYYY format dates', () => {
      const text = 'Vencimiento: 31/12/2026';
      const results = parseDatesFromText(text);

      expect(results).toHaveLength(1);
      expect(results[0].date).toBe('2026-12-31');
      expect(results[0].confidence).toBeGreaterThan(0.6);
    });

    it('should extract DD-MM-YYYY format dates', () => {
      const text = 'Fecha de vencimiento: 15-06-2025';
      const results = parseDatesFromText(text);

      expect(results).toHaveLength(1);
      expect(results[0].date).toBe('2025-06-15');
      expect(results[0].confidence).toBeGreaterThan(0.6);
    });

    it('should extract DD.MM.YYYY format dates', () => {
      const text = 'Caduca el 01.03.2027';
      const results = parseDatesFromText(text);

      expect(results).toHaveLength(1);
      expect(results[0].date).toBe('2027-03-01');
      expect(results[0].confidence).toBeGreaterThan(0.6);
    });

    it('should extract YYYY-MM-DD format dates', () => {
      const text = 'Expiry: 2026-08-15';
      const results = parseDatesFromText(text);

      expect(results).toHaveLength(1);
      expect(results[0].date).toBe('2026-08-15');
    });

    it('should return multiple dates sorted by confidence', () => {
      const text = 'Vencimiento: 31/12/2026 and also 15/06/2025';
      const results = parseDatesFromText(text);

      expect(results.length).toBeGreaterThanOrEqual(2);
      // First result should have higher or equal confidence
      expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
    });

    it('should boost confidence when date keywords are nearby', () => {
      const textWithKeyword = 'Vencimiento: 31/12/2026';
      const textWithout = 'Something 31/12/2026';

      const withKeyword = parseDatesFromText(textWithKeyword);
      const without = parseDatesFromText(textWithout);

      expect(withKeyword[0].confidence).toBeGreaterThan(without[0].confidence);
    });

    it('should return empty array when no dates found', () => {
      const text = 'No dates in this text';
      const results = parseDatesFromText(text);

      expect(results).toHaveLength(0);
    });

    it('should skip invalid dates', () => {
      const text = 'Invalid: 32/13/2026'; // day 32, month 13
      const results = parseDatesFromText(text);

      expect(results).toHaveLength(0);
    });

    it('should skip years outside valid range', () => {
      const text = 'Date: 01/01/1999'; // too old
      const results = parseDatesFromText(text);

      expect(results).toHaveLength(0);
    });

    it('should handle multiple date formats in same text', () => {
      const text = 'Start: 01/01/2026 End: 2026-12-31';
      const results = parseDatesFromText(text);

      expect(results).toHaveLength(2);
    });

    it('should deduplicate same date from different formats', () => {
      // DD/MM/YYYY and MM/DD/YYYY could produce same result
      const text = '31/12/2026';
      const results = parseDatesFromText(text);

      expect(results).toHaveLength(1);
      expect(results[0].date).toBe('2026-12-31');
    });
  });

  describe('extractTextFromImage', () => {
    it('should throw when GOOGLE_VISION_API_KEY is not set', async () => {
      const originalKey = process.env.GOOGLE_VISION_API_KEY;
      delete process.env.GOOGLE_VISION_API_KEY;

      const { extractTextFromImage } = await import('./ocr.js');

      await expect(extractTextFromImage(Buffer.from('test'))).rejects.toThrow('GOOGLE_VISION_API_KEY');

      process.env.GOOGLE_VISION_API_KEY = originalKey;
    });
  });

  describe('processDocumentImage', () => {
    it('should return rawText and confidence 0 when no dates found', async () => {
      // Mock the vision client
      vi.mock('@google-cloud/vision', () => ({
        ImageAnnotatorClient: vi.fn().mockImplementation(() => ({
          textDetection: vi.fn().mockResolvedValue([
            { textAnnotations: [{ description: 'No dates here' }] },
          ]),
        })),
      }));

      process.env.GOOGLE_VISION_API_KEY = 'test-key';

      const { processDocumentImage } = await import('./ocr.js');
      const result = await processDocumentImage(Buffer.from('test'));

      expect(result.rawText).toBe('No dates here');
      expect(result.confidence).toBe(0);
      expect(result.date).toBeUndefined();
    });
  });
});

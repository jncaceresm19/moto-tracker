import { ImageAnnotatorClient } from '@google-cloud/vision';
import type { OcrResult } from '@moto-tracker/shared';

// Date regex patterns for Chilean documents
const DATE_PATTERNS = [
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g,
  // YYYY/MM/DD or YYYY-MM-DD
  /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
];

// Spanish date keywords (higher confidence when found near a date)
const DATE_KEYWORDS = [
  'vencimiento',
  'caduca',
  'fecha',
  'validez',
  'vigencia',
  'expira',
  'hasta',
  'desde',
];

let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_VISION_API_KEY environment variable is not set');
    }
    visionClient = new ImageAnnotatorClient({ apiKey });
  }
  return visionClient;
}

/**
 * Parse dates from OCR text and return the most likely expiry date.
 * Returns all found dates with confidence scores.
 */
export function parseDatesFromText(text: string): Array<{ date: string; confidence: number }> {
  const results: Array<{ date: string; confidence: number }> = [];
  const lowerText = text.toLowerCase();

  // Check for date keywords nearby
  const hasKeyword = (position: number): boolean => {
    const contextStart = Math.max(0, position - 50);
    const context = lowerText.slice(contextStart, position + 50);
    return DATE_KEYWORDS.some((kw) => context.includes(kw));
  };

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmyPattern = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g;
  let match;
  while ((match = dmyPattern.exec(text)) !== null) {
    const [, day, month, year] = match;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    // Basic date validation
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      let confidence = 0.6;
      if (hasKeyword(match.index!)) confidence += 0.3;
      results.push({ date: dateStr, confidence: Math.min(confidence, 1.0) });
    }
  }

  // YYYY/MM/DD, YYYY-MM-DD
  const ymdPattern = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g;
  while ((match = ymdPattern.exec(text)) !== null) {
    const [, year, month, day] = match;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      let confidence = 0.6;
      if (hasKeyword(match.index!)) confidence += 0.3;
      results.push({ date: dateStr, confidence: Math.min(confidence, 1.0) });
    }
  }

  // Deduplicate by date string, keeping highest confidence
  const seen = new Map<string, number>();
  for (const r of results) {
    const existing = seen.get(r.date) ?? 0;
    if (r.confidence > existing) {
      seen.set(r.date, r.confidence);
    }
  }

  return Array.from(seen.entries())
    .map(([date, confidence]) => ({ date, confidence }))
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Extract text from image using Google Vision API.
 */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  const client = getVisionClient();
  const [result] = await client.textDetection({
    image: { content: imageBuffer.toString('base64') },
  });
  const detections = result.textAnnotations;
  return detections?.[0]?.description ?? '';
}

/**
 * Full OCR pipeline: extract text from image, parse dates, return result.
 */
export async function processDocumentImage(imageBuffer: Buffer): Promise<OcrResult> {
  const rawText = await extractTextFromImage(imageBuffer);
  const dates = parseDatesFromText(rawText);

  if (dates.length === 0) {
    return {
      confidence: 0,
      rawText,
    };
  }

  // Return the best date match
  return {
    date: dates[0].date,
    confidence: dates[0].confidence,
    rawText,
  };
}

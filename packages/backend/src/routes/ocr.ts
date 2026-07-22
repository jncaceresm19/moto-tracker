import { Router, Request, Response } from 'express';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { PDFParse } from 'pdf-parse';
import {
  parseCirculationPermit,
  parseTechnicalReview,
  parseDriversLicense,
  parsePadron,
  parseInsurance,
  parseGeneric,
} from '../services/ocrParsers';

const router = Router();

const VALID_DOC_TYPES = ['circulation_permit', 'technical_review', 'drivers_license', 'padron', 'insurance'];

const PARSERS: Record<string, (text: string) => any> = {
  circulation_permit: parseCirculationPermit,
  technical_review: parseTechnicalReview,
  drivers_license: parseDriversLicense,
  padron: parsePadron,
  insurance: parseInsurance,
};

// POST /api/ocr/extract — Extract structured data from document image using Tesseract.js
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { imageBase64, documentType } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }
    if (!documentType || !VALID_DOC_TYPES.includes(documentType)) {
      return res.status(400).json({ error: `documentType must be one of: ${VALID_DOC_TYPES.join(', ')}` });
    }

    // Strip data URI prefix if present
    const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Clean, 'base64');

    // Preprocess image for better OCR on documents:
    // 5 passes with different preprocessing to maximize Tesseract accuracy.
    // Each pass handles a different lighting/quality scenario.
    const processedBuffer = await sharp(imageBuffer)
      .resize({ width: 2400, withoutEnlargement: true })
      .grayscale()
      .sharpen({ sigma: 2.0 })
      .normalize()
      .threshold(140)           // pass 1: standard binarization
      .toBuffer();

    const softBuffer = await sharp(imageBuffer)
      .resize({ width: 2400, withoutEnlargement: true })
      .grayscale()
      .sharpen({ sigma: 1.2 })
      .normalize()              // pass 2: no threshold — for degraded areas
      .toBuffer();

    const lowThreshBuffer = await sharp(imageBuffer)
      .resize({ width: 2400, withoutEnlargement: true })
      .grayscale()
      .sharpen({ sigma: 1.8 })
      .normalize()
      .threshold(100)           // pass 3: low threshold — faded text
      .toBuffer();

    // Pass 4: brightness + contrast boost — preserves natural gradients
    // WITHOUT thresholding. Works well for documents with colored backgrounds
    // (like Chilean padrón) where thresholding destroys text.
    const gammaBuffer = await sharp(imageBuffer)
      .resize({ width: 3000, withoutEnlargement: true })
      .grayscale()
      .linear(1.4, 10)          // brighten midtones (replaces invalid gamma 0.7)
      .sharpen({ sigma: 1.0 })
      .normalize()
      .toBuffer();

    // Pass 5: high contrast boost — for photos with poor lighting
    const highContrastBuffer = await sharp(imageBuffer)
      .resize({ width: 2400, withoutEnlargement: true })
      .grayscale()
      .linear(1.5, -30)        // increase contrast
      .sharpen({ sigma: 2.0 })
      .normalize()
      .threshold(130)
      .toBuffer();

    console.log(`[OCR] Processing ${documentType} with Tesseract.js (5-pass)...`);

    // Run Tesseract on all five preprocessed versions
    const [result1, result2, result3, result4, result5] = await Promise.all([
      Tesseract.recognize(processedBuffer, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Pass 1 (thresh140) progress: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      }),
      Tesseract.recognize(softBuffer, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Pass 2 (no-thresh) progress: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      }),
      Tesseract.recognize(lowThreshBuffer, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Pass 3 (thresh100) progress: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      }),
      Tesseract.recognize(gammaBuffer, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Pass 4 (gamma) progress: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      }),
      Tesseract.recognize(highContrastBuffer, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Pass 5 (contrast) progress: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      }),
    ]);

    // Pick the text that found the most date-like content
    const text1 = result1.data.text || '';
    const text2 = result2.data.text || '';
    const text3 = result3.data.text || '';
    const text4 = result4.data.text || '';
    const text5 = result5.data.text || '';

    // Log all passes for debugging
    console.log(`[OCR] Pass 1 (thresh140, ${text1.length} chars):\n---\n${text1}\n---`);
    console.log(`[OCR] Pass 2 (no-thresh, ${text2.length} chars):\n---\n${text2}\n---`);
    console.log(`[OCR] Pass 3 (thresh100, ${text3.length} chars):\n---\n${text3}\n---`);
    console.log(`[OCR] Pass 4 (gamma, ${text4.length} chars):\n---\n${text4}\n---`);
    console.log(`[OCR] Pass 5 (contrast, ${text5.length} chars):\n---\n${text5}\n---`);

    // Count date-like patterns in each pass to pick the best
    const countDates = (t: string) => {
      const m1 = (t.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/g) || []).length;
      const m2 = (t.match(/\d{1,2}\s+[a-záéíóú]{3,}\s+\d{4}/gi) || []).length;
      const m3 = (t.match(/\d{1,2}[a-záéíóú]{3,}\d{4}/gi) || []).length;
      return m1 + m2 + m3;
    };

    const scores = [
      { text: text1, score: countDates(text1), confidence: result1.data.confidence, label: 'thresh140' },
      { text: text2, score: countDates(text2), confidence: result2.data.confidence, label: 'no-thresh' },
      { text: text3, score: countDates(text3), confidence: result3.data.confidence, label: 'thresh100' },
      { text: text4, score: countDates(text4), confidence: result4.data.confidence, label: 'gamma' },
      { text: text5, score: countDates(text5), confidence: result5.data.confidence, label: 'contrast' },
    ].sort((a, b) => b.score - a.score);

    console.log(`[OCR] Pass scores: ${scores.map(s => `${s.label}=${s.score}(conf=${Math.round(s.confidence)})`).join(', ')}`);

    // Use the best pass. If tied, prefer the longest text.
    const best = scores[0].score > 0
      ? scores[0]
      : scores.reduce((a, b) => a.text.length >= b.text.length ? a : b);
    const fullText = best.text;

    // Average confidence across passes (for UI feedback)
    const avgConfidence = Math.round(
      scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length
    );

    if (!fullText.trim()) {
      return res.json({
        error: 'No se pudo leer el documento. Intenta con mejor iluminación y enfocando el texto.',
        confidence: avgConfidence,
      });
    }

    console.log(`[OCR] Raw text (${fullText.length} chars):`, fullText.substring(0, 500));
    console.log(`[OCR] Full text for debugging:\n---\n${fullText}\n---`);

    // Parse by document type
    const parser = PARSERS[documentType] || parseGeneric;
    const result = parser(fullText);

    // Attach confidence to response for UI feedback
    (result as any).confidence = avgConfidence;

    console.log(`[OCR] Parsed ${documentType} (confidence: ${avgConfidence}):`, result);
    res.json(result);
  } catch (err) {
    console.error('[OCR] Extract error:', err);
    res.status(500).json({ error: 'Error interno al procesar el documento' });
  }
});

// POST /api/ocr/extract-pdf — Extract text from PDF and parse by document type
router.post('/extract-pdf', async (req: Request, res: Response) => {
  try {
    const { pdfBase64, documentType } = req.body;

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return res.status(400).json({ error: 'pdfBase64 is required' });
    }
    if (!documentType || !VALID_DOC_TYPES.includes(documentType)) {
      return res.status(400).json({ error: `documentType must be one of: ${VALID_DOC_TYPES.join(', ')}` });
    }

    const base64Clean = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(base64Clean, 'base64');

    console.log(`[OCR] Processing ${documentType} PDF (${pdfBuffer.length} bytes)...`);

    const pdfParser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    await pdfParser.load();
    const pdfResult = await pdfParser.getText();
    const fullText = pdfResult.text || '';

    console.log(`[PDF] Extracted text (${fullText.length} chars):`, fullText.substring(0, 500));
    console.log(`[PDF] Full text for debugging:\n---\n${fullText}\n---`);

    if (!fullText.trim()) {
      return res.json({
        error: 'El PDF no tiene texto extraíble. Es un documento escaneado. Subí una foto del documento para OCR.',
      });
    }

    const parser = PARSERS[documentType] || parseGeneric;
    const result = parser(fullText);

    console.log(`[OCR] Parsed ${documentType} from PDF:`, result);
    res.json(result);
  } catch (err) {
    console.error('[OCR] PDF extract error:', err);
    res.status(500).json({ error: 'Error interno al procesar el PDF' });
  }
});

export default router;

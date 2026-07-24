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
    // 6 passes with different preprocessing to maximize Tesseract accuracy.
    // Each pass handles a different lighting/quality/document scenario.
    const processedBuffer = await sharp(imageBuffer)
      .resize({ width: 2400 })
      .grayscale()
      .sharpen({ sigma: 2.0 })
      .normalize()
      .threshold(140)           // pass 1: standard binarization — clean high-contrast docs
      .toBuffer();

    const softBuffer = await sharp(imageBuffer)
      .resize({ width: 2400 })
      .grayscale()
      .sharpen({ sigma: 1.2 })
      .normalize()              // pass 2: no threshold — for mildly degraded areas
      .toBuffer();

    const lowThreshBuffer = await sharp(imageBuffer)
      .resize({ width: 2400 })
      .grayscale()
      .sharpen({ sigma: 1.8 })
      .normalize()
      .threshold(100)           // pass 3: low threshold — faded but still high-contrast text
      .toBuffer();

    const gammaBuffer = await sharp(imageBuffer)
      .resize({ width: 3000 })
      .grayscale()
      .linear(1.4, 10)          // pass 4: brightness + contrast boost — preserves natural gradients
      .sharpen({ sigma: 1.0 })
      .normalize()
      .toBuffer();

    const highContrastBuffer = await sharp(imageBuffer)
      .resize({ width: 2400 })
      .grayscale()
      .linear(1.5, -30)        // pass 5: high contrast boost — for photos with poor lighting
      .sharpen({ sigma: 2.0 })
      .normalize()
      .threshold(130)
      .toBuffer();

    // Pass 6: NATURAL — minimal processing for degraded/faded documents.
    // No normalize, no threshold, no linear transform.
    // Old licenses with faded text or worn surfaces need the RAW grayscale
    // because normalize/threshold can destroy faint strokes entirely.
    const naturalBuffer = await sharp(imageBuffer)
      .resize({ width: 3000 })
      .grayscale()
      .sharpen({ sigma: 0.5 })  // very mild sharpen — just enough to define edges
      .toBuffer();

    // Pass 7: GAMMA BRIGHTEN — brightens midtones to rescue faded text.
    // Gamma correction (>1.0) lightens midtones more than highlights/shadows,
    // making faint gray text distinguishable from the background.
    // normalize() then stretches the full histogram for maximum readability.
    const adaptiveGammaBuffer = await sharp(imageBuffer)
      .resize({ width: 3000 })
      .grayscale()
      .gamma(1.5)               // brighten midtones — faded text re-emerges
      .normalize()              // stretch histogram for max contrast
      .sharpen({ sigma: 0.8 })
      .toBuffer();

    console.log(`[OCR] Processing ${documentType} with Tesseract.js (7-pass)...`);

    // Run Tesseract on all seven preprocessed versions
    const [result1, result2, result3, result4, result5, result6, result7] = await Promise.all([
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
      Tesseract.recognize(naturalBuffer, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Pass 6 (natural) progress: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      }),
      Tesseract.recognize(adaptiveGammaBuffer, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Pass 7 (adaptive) progress: ${Math.round((m.progress || 0) * 100)}%`);
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
    const text6 = result6.data.text || '';
    const text7 = result7.data.text || '';

    // Log all passes for debugging
    console.log(`[OCR] Pass 1 (thresh140, ${text1.length} chars):\n---\n${text1}\n---`);
    console.log(`[OCR] Pass 2 (no-thresh, ${text2.length} chars):\n---\n${text2}\n---`);
    console.log(`[OCR] Pass 3 (thresh100, ${text3.length} chars):\n---\n${text3}\n---`);
    console.log(`[OCR] Pass 4 (gamma, ${text4.length} chars):\n---\n${text4}\n---`);
    console.log(`[OCR] Pass 5 (contrast, ${text5.length} chars):\n---\n${text5}\n---`);
    console.log(`[OCR] Pass 6 (natural, ${text6.length} chars):\n---\n${text6}\n---`);
    console.log(`[OCR] Pass 7 (adaptive, ${text7.length} chars):\n---\n${text7}\n---`);

    // Count date-like patterns in each pass to pick the best
    const countDates = (t: string) => {
      const m1 = (t.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/g) || []).length;
      const m2 = (t.match(/\d{1,2}\s+[a-záéíóú]{3,}\s+\d{4}/gi) || []).length;
      const m3 = (t.match(/\d{1,2}[a-záéíóú]{3,}\d{4}/gi) || []).length;
      return m1 + m2 + m3;
    };

    // Count keyword-like patterns (letters + spaces) — higher means readable text
    const countReadable = (t: string) => {
      return (t.match(/[a-záéíóúñ]{3,}/gi) || []).length;
    };

    const scores = [
      { text: text1, score: countDates(text1), confidence: result1.data.confidence, label: 'thresh140' },
      { text: text2, score: countDates(text2), confidence: result2.data.confidence, label: 'no-thresh' },
      { text: text3, score: countDates(text3), confidence: result3.data.confidence, label: 'thresh100' },
      { text: text4, score: countDates(text4), confidence: result4.data.confidence, label: 'gamma' },
      { text: text5, score: countDates(text5), confidence: result5.data.confidence, label: 'contrast' },
      { text: text6, score: countDates(text6), confidence: result6.data.confidence, label: 'natural' },
      { text: text7, score: countDates(text7), confidence: result7.data.confidence, label: 'adaptive' },
    ].sort((a, b) => b.score - a.score);

    console.log(`[OCR] Pass scores: ${scores.map(s => `${s.label}=${s.score}(readable=${countReadable(s.text)}, conf=${Math.round(s.confidence)})`).join(', ')}`);

    // Use the best pass. If tied or no dates at all, prefer the pass with the
    // most readable text (3+ letter words) — this favors the natural pass for
    // faded documents where thresholding destroys text.
    const best = scores[0].score > 0
      ? scores[0]
      : scores.reduce((a, b) => {
          const aReadable = countReadable(a.text);
          const bReadable = countReadable(b.text);
          return aReadable >= bReadable ? a : b;
        });
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

// Resolved paths for pdfjs-dist resources (computed once at module load)
const pdfjsDir = require('path').dirname(require.resolve('pdfjs-dist/package.json'));
const pdfjsFontsUrl = 'file:///' + (pdfjsDir + '/standard_fonts/').replace(/\\/g, '/');

// Lazy pdfjs initialization (only loads on first pdf-to-image request)
let pdfjsInitPromise: Promise<any> | null = null;
async function getPdfjs() {
  if (!pdfjsInitPromise) {
    pdfjsInitPromise = (async () => {
      const [pdfjsLib, { createCanvas, Path2D }] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('@napi-rs/canvas'),
      ]);

      // pdf-parse (pdfjs-dist 5.4.296) ya seteó globalThis.Path2D con su
      // propio Path2D, incompatible con @napi-rs/canvas. Forzamos el correcto
      // porque el polyfill de pdfjs 6.1.200 solo lo setea si no existe.
      globalThis.Path2D = Path2D;

      // Force the 6.1.200 worker handler onto globalThis so the fake worker
      // (used in Node.js) picks up OUR worker instead of any stale one that
      // pdf-parse may have left behind.
      const workerModule = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
      (globalThis as any).pdfjsWorker = { WorkerMessageHandler: workerModule.WorkerMessageHandler };

      return { pdfjsLib, createCanvas };
    })();
  }
  return pdfjsInitPromise;
}

/** Convert raw PDF buffer to base64 JPEG. Exported so documents.ts can call
 *  it directly instead of making an HTTP self-call. */
export async function pdfBufferToJpeg(pdfBuffer: Buffer): Promise<string> {
  const { pdfjsLib, createCanvas } = await getPdfjs();

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    standardFontDataUrl: pdfjsFontsUrl,
  }).promise;
  const page = await doc.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1.5, 1200 / baseViewport.width);
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  await page.render({ canvasContext: ctx, viewport }).promise;
  const jpegBuffer = canvas.toBuffer('image/jpeg', { quality: 0.6 });

  const imageBase64 = jpegBuffer.toString('base64');
  console.log(`[PDF-to-image] Converted: ${(pdfBuffer.length / 1024).toFixed(0)}KB PDF → scale=${scale.toFixed(2)} → ${(jpegBuffer.length / 1024).toFixed(0)}KB JPEG`);
  return imageBase64;
}

// POST /api/ocr/pdf-to-image — Convert first page of PDF to JPEG image
router.post('/pdf-to-image', async (req: Request, res: Response) => {
  try {
    const { pdfBase64 } = req.body;

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return res.status(400).json({ error: 'pdfBase64 is required' });
    }

    const base64Clean = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(base64Clean, 'base64');

    if (pdfBuffer.length === 0) {
      return res.status(400).json({ error: 'Empty PDF data' });
    }

    const imageBase64 = await pdfBufferToJpeg(pdfBuffer);
    res.json({ imageBase64 });
  } catch (err) {
    console.error('[PDF-to-image] Error:', err);
    res.status(500).json({ error: 'Error al convertir PDF a imagen' });
  }
});

export default router;

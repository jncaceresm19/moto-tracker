import { api } from '../api';

export interface OcrResult {
  comuna?: string;
  issueDate?: string;
  expiryDate?: string;
  patente?: string;
  rut?: string;
  brand?: string;
  model?: string;
  year?: string;
  engineNumber?: string;
  chassisNumber?: string;
  serialNumber?: string;
  color?: string;
  error?: string;
  confidence?: number; // 0-100, Tesseract average confidence across passes
}

export async function extractDocumentData(
  imageBase64: string,
  documentType: string
): Promise<OcrResult> {
  return api<OcrResult>('/api/ocr/extract', {
    method: 'POST',
    body: { imageBase64, documentType },
  });
}

export async function extractPdfData(
  pdfBase64: string,
  documentType: string
): Promise<OcrResult> {
  return api<OcrResult>('/api/ocr/extract-pdf', {
    method: 'POST',
    body: { pdfBase64, documentType },
  });
}

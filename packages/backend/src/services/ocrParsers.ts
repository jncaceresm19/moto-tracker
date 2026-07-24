// OCR Parsers for Chilean motorcycle documents
// Each parser extracts structured data from raw OCR text

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
}

// ── Chilean communes (346 comunas) ──────────────────────────────────────────
const CHILEAN_COMMUNES = [
  'Arica', 'Camarones', 'Putre', 'General Lagos',
  'Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Camiña', 'Huara', 'Cristóbal Colón',
  'Antofagasta', 'Mejillones', 'Sierra Gorda', 'Taltal', 'Calama', 'Ollagüe', 'San Pedro de Atacama',
  'Copiapó', 'Caldera', 'Vallenar', 'Alto del Carmen', 'Freirina', 'Huasco',
  'La Serena', 'Coquimbo', 'Andacollo', 'La Higuera', 'Paiguano', 'Vicuña',
  'Illapel', 'Canela', 'Los Vilos', 'Salamanca', 'Combarbalá', 'Monte Patria', 'Punitaqui', 'Río Hurtado',
  'Valparaíso', 'Viña del Mar', 'Concón', 'Quilpué', 'Villa Alemana', 'Casablanca', 'Juan Fernández',
  'San Antonio', 'Cartagena', 'El Quisco', 'El Tabo', 'Santo Domingo', 'Isla de Pascua',
  'Los Andes', 'Calle Larga', 'Rinconada', 'San Esteban',
  'San Felipe', 'Putaendo', 'Santa María', 'Panquehue', 'Llaillay', 'Catemu', 'Quillota',
  'La Cruz', 'Calera', 'Hijuelas', 'Nogales', 'La Ligua', 'Petorca', 'Zapallar',
  'Quilpue', 'Villa Alemana',
  'Santiago', 'Providencia', 'Las Condes', 'Vitacura', 'Ñuñoa', 'Macul', 'Peñalolén',
  'La Florida', 'Puente Alto', 'San Bernardo', 'Buin', 'Paine', 'Calera de Tango',
  'San José de Maipo', 'Colina', 'Lampa', 'Tiltil', 'Pirque',
  'Talca', 'Constitución', 'Curepto', 'Empedrado', 'Maule', 'San Clemente',
  'San Rafael', 'Cauquenes', 'Chanco', 'Pelluhue', 'Retiro',
  'Linares', 'Cervantes', 'San Javier', 'Villa Alegre', 'Yerbas Buenas', 'Colbún', 'Parral', 'San Nicolás',
  'Chillán', 'Bulnes', 'Chillán Viejo', 'Cobquecura', 'Coelemu', 'Ninhue', 'Portezuelo', 'Quirihue', 'Ránquil', 'San Carlos', 'San Nicolás', 'Yungay',
  'Concepción', 'Coronel', 'Lota', 'Los Ángeles', 'Chiguayante', 'Hualpén', 'Talcahuano', 'Tomé',
  'Mulchén', 'Nacimiento', 'Negrete', 'Mischael', 'Alto Biobío',
  'Temuco', 'Padre Las Casas', 'Villarrica', 'Pitrufquén', 'Freire', 'Cunco', 'Curarrehue', 'Lonquimay', 'Melipeuco', 'Nueva Imperial', 'Puerto Saavedra', 'Lautaro', 'Galvarino', 'Perquenco', 'Vilcún',
  'Valdivia', 'Corral', 'Lanco', 'Mariquina', 'Máfil', 'La Unión', 'Río Bueno', 'Panguipulli', 'Los Lagos', 'Futrono', 'Lago Ranco',
  'Puerto Montt', 'Calbuco', 'Puerto Varas', 'Osorno', 'Puerto Octay', 'Purranque', 'Río Negro', 'San Juan de la Costa', 'San Pablo', 'Achao', 'Castro', 'Chonchi', 'Curaco de Vélez', 'Dalcahue', 'Puqueldón', 'Queilén', 'Quellón', 'Quemchi', 'Quinchao', 'Ancud',
  'Chaitén', 'Futaleufú', 'Palena',
  'Coyhaique', 'Aysén', 'Cisnes', 'Guaitecas', 'Chile Chico', 'Cochrane', 'O\u2019Higgins', 'Tortel',
  'Punta Arenas', 'Porvenir', 'Puerto Williams', 'Cabo de Hornos',
];

// ── Helper: extract dates from text ─────────────────────────────────────────
// Handles: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, "19 NOVIEMBRE 2025", "19 de noviembre de 2025"
const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
  mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9, set: 9, octubre: 10, oct: 10,
  noviembre: 11, nov: 11, diciembre: 12, dic: 12,
};

function spanishMonthToNum(month: string): number | undefined {
  return SPANISH_MONTHS[month.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
}

// ── Helper: correct garbled years ─────────────────────────────────────────
// Tesseract often misreads digits: 2→7, 0→8, 1→7, etc.
// For documents, valid year range is 2015-2035
function fixGarbledYear(y: number): number {
  if (y >= 2015 && y <= 2035) return y;
  // Tesseract common: 2079→2029 (7 misread as 2), 2089→2039, etc.
  // If year is in 2070-2099 range, assume 2020-2039 range
  if (y >= 2070 && y <= 2099) return y - 50;
  // If year is 2040-2069, assume same decade
  if (y >= 2040 && y <= 2069) return y - 40;
  return y;
}

function extractDates(text: string): string[] {
  const dates: string[] = [];

  // 1. Numeric: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const numericRegex = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g;
  let match;
  while ((match = numericRegex.exec(text)) !== null) {
    const [, day, month, year] = match;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
      dates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }

  // 2. Spanish text: "19 NOVIEMBRE 2025" or "19 de noviembre de 2025"
  const spanishRegex = /(\d{1,2})\s+(?:de\s+)?([a-zA-Záéíóúñ]+)\s+(?:de\s+)?(\d{4})/gi;
  while ((match = spanishRegex.exec(text)) !== null) {
    const [, day, monthStr, year] = match;
    const m = spanishMonthToNum(monthStr);
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);
    if (m && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!dates.includes(iso)) dates.push(iso); // dedupe
    }
  }

  // 3. Tesseract-garbled: "16ENE2020", "I6ENE2020" — no spaces
  const garbledRegex = /(\d{1,2})([a-zA-Záéíóúñ]{3,10})(\d{4})/gi;
  while ((match = garbledRegex.exec(text)) !== null) {
    const [, day, monthStr, year] = match;
    const m = spanishMonthToNum(monthStr);
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);
    if (m && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!dates.includes(iso)) dates.push(iso);
    }
  }

  return dates;
}

// ── Helper: extract RUT ─────────────────────────────────────────────────────
function extractRut(text: string): string | undefined {
  const rutMatch = text.match(/(\d{1,2}\.\d{3}\.\d{3}-[\dkK])/);
  if (rutMatch) return rutMatch[1];
  // Fallback: 7-8 digits + dash + digit/k
  const rutFallback = text.match(/(\d{7,8}-[\dkK])/);
  return rutFallback?.[1];
}

// ── Helper: extract patente ─────────────────────────────────────────────────
function extractPatente(text: string): string | undefined {
  // New format: BBBB-NN (4 letters + 2 digits)
  const newFormat = text.match(/\b([A-Z]{4})-?(\d{2})\b/);
  if (newFormat) return `${newFormat[1]}${newFormat[2]}`;
  // Old format: BB-NNNN (2 letters + 4 digits)
  const oldFormat = text.match(/\b([A-Z]{2})-?(\d{4})\b/);
  if (oldFormat) return `${oldFormat[1]}${oldFormat[2]}`;
  return undefined;
}

// ── Helper: find commune in text ────────────────────────────────────────────
function findCommune(text: string): string | undefined {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Try labeled patterns first: "Comuna: Santiago", "Municipalidad de Santiago"
  const labelMatch = text.match(/(?:comuna|municipalidad\s+de)[:\s]+([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+)/i);
  if (labelMatch) {
    const candidate = labelMatch[1].trim();
    const match = CHILEAN_COMMUNES.find(c => c.toLowerCase() === candidate.toLowerCase());
    if (match) return match;
  }

  // Search for commune name in text
  for (const commune of CHILEAN_COMMUNES) {
    const communeNorm = commune.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalized.includes(communeNorm)) return commune;
  }
  return undefined;
}

// ── Parser: Permiso de Circulación ──────────────────────────────────────────
export function parseCirculationPermit(text: string): OcrResult {
  const comuna = findCommune(text);
  const dates = extractDates(text);

  // First date is typically issue date
  const issueDate = dates[0];

  // Expiry: March 31 of (issue year + 1)
  let expiryDate: string | undefined;
  if (issueDate) {
    const year = parseInt(issueDate.split('-')[0], 10);
    expiryDate = `${year + 1}-03-31`;
  }

  return { comuna, issueDate, expiryDate };
}

// ── Helper: last day of month ──────────────────────────────────────────────
function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

// ── Helper: find expiry month near keywords ─────────────────────────────────
// Looks for month name NEAR "válido", "hasta", "vence", etc.
// Does NOT match standalone month names (that would match the issue date month)
function findExpiryMonth(text: string): number | undefined {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Keywords that indicate expiry context (with or without accents, Tesseract garbles them)
  const keywordPatterns = [
    /v[aá]lido\s+(?:hasta|el|la)?\s*/i,
    /hasta\s*/i,
    /vencimiento\s*/i,
    /expira\s*/i,
    /vence\s*/i,
    /fecha\s+de\s+vencimiento\s*/i,
    /fecha\s+de\s+expiracion\s*/i,
  ];

  for (const kwPattern of keywordPatterns) {
    const kwMatch = normalized.match(kwPattern);
    if (kwMatch) {
      const kwEnd = normalized.indexOf(kwMatch[0]) + kwMatch[0].length;
      const afterKw = normalized.substring(kwEnd, kwEnd + 60);
      for (const [name, num] of Object.entries(SPANISH_MONTHS)) {
        if (afterKw.includes(name)) return num;
      }
    }
  }

  return undefined; // No expiry keyword found → caller defaults to issue month
}

// ── Helper: try to parse a date string from a text window ──────────────────
function tryParseDateInWindow(window: string): string | undefined {
  // Try numeric date first: 16/01/2020
  const numMatch = window.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (numMatch) {
    let [, day, month, year] = numMatch;
    let d = parseInt(day, 10), m = parseInt(month, 10), y = parseInt(year, 10);
    if (d > 31) d = 30;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Try Spanish text date: "16 ENE 2020"
  const spMatch = window.match(/(\d{1,2})\s+(?:de\s+)?([a-zA-Záéíóúñ]+)\s+(?:de\s+)?(\d{4})/i);
  if (spMatch) {
    const [, day, monthStr, year] = spMatch;
    const m = spanishMonthToNum(monthStr);
    let d = parseInt(day, 10), y = parseInt(year, 10);
    if (d > 31) d = 30;
    if (m && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Try garbled: "16ENE2020"
  const garbledMatch = window.match(/(\d{1,2})([a-zA-Záéíóúñ]{3,10})(\d{4})/i);
  if (garbledMatch) {
    const [, day, monthStr, year] = garbledMatch;
    const m = spanishMonthToNum(monthStr);
    let d = parseInt(day, 10), y = parseInt(year, 10);
    if (d > 31) d = 30;
    if (m && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return undefined;
}

// ── Helper: find a date near a keyword in text ──────────────────────────────
// Searches BOTH forward and backward from the keyword match (±120 chars).
// This handles Chilean license layouts where the date may appear before or
// after the label depending on OCR text ordering.
function findDateNearKeyword(text: string, keywordPatterns: string[]): string | undefined {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  for (const kw of keywordPatterns) {
    const kwRegex = new RegExp(kw, 'i');
    const kwMatch = normalized.match(kwRegex);
    if (!kwMatch) continue;

    const kwStart = normalized.indexOf(kwMatch[0]);
    const kwEnd = kwStart + kwMatch[0].length;

    // Search backward up to 120 chars (date may precede the label)
    const backStart = Math.max(0, kwStart - 120);
    const backWindow = text.substring(backStart, kwStart);
    const backDate = tryParseDateInWindow(backWindow);
    if (backDate) return backDate;

    // Search forward up to 120 chars (date may follow the label)
    const fwdWindow = text.substring(kwEnd, kwEnd + 120);
    const fwdDate = tryParseDateInWindow(fwdWindow);
    if (fwdDate) return fwdDate;
  }

  return undefined;
}

// ── Helper: find the date NEAREST a keyword (either direction) ──────────────
// Unlike findDateNearKeyword (backward-first) and findDateAfterKeyword
// (forward-only), this measures the absolute character distance from the
// keyword center to each candidate date and returns the closest one.
// Critical for "FECHA ÚLTIMO CONTROL" where the issue date may appear before
// or after the label depending on Tesseract reading order.
function findDateNearestKeyword(text: string, keywordPatterns: string[]): string | undefined {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  for (const kw of keywordPatterns) {
    const kwMatch = normalized.match(new RegExp(kw, 'i'));
    if (!kwMatch) continue;

    const kwStart = normalized.indexOf(kwMatch[0]);
    if (kwStart < 0) continue;
    const kwEnd = kwStart + kwMatch[0].length;
    const kwCenter = Math.floor((kwStart + kwEnd) / 2);

    // Search backward ±120 chars
    const searchStart = Math.max(0, kwStart - 120);
    const searchEnd = kwEnd + 120;
    const searchRegion = text.substring(searchStart, searchEnd);
    const regionOffset = searchStart;

    let bestDate: string | undefined;
    let bestDist = Infinity;

    // Numeric dates: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    const numRegex = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g;
    let m: RegExpExecArray | null;
    while ((m = numRegex.exec(searchRegion)) !== null) {
      const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100) {
        const dateCenter = regionOffset + m.index + Math.floor(m[0].length / 2);
        const dist = Math.abs(dateCenter - kwCenter);
        if (dist < bestDist) {
          bestDist = dist;
          bestDate = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
      }
    }

    // Spanish text dates: "19 NOVIEMBRE 2025" or "19 de noviembre de 2025"
    const spRegex = /(\d{1,2})\s+(?:de\s+)?([a-zA-Záéíóúñ]+)\s+(?:de\s+)?(\d{4})/gi;
    while ((m = spRegex.exec(searchRegion)) !== null) {
      const monthNum = spanishMonthToNum(m[2]);
      if (monthNum) {
        const d = parseInt(m[1], 10), y = parseInt(m[3], 10);
        if (d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
          const dateCenter = regionOffset + m.index + Math.floor(m[0].length / 2);
          const dist = Math.abs(dateCenter - kwCenter);
          if (dist < bestDist) {
            bestDist = dist;
            bestDate = `${y}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          }
        }
      }
    }

    // Garbled dates: "16ENE2020"
    const garbledRegex = /(\d{1,2})([a-zA-Záéíóúñ]{3,10})(\d{4})/gi;
    while ((m = garbledRegex.exec(searchRegion)) !== null) {
      const monthNum = spanishMonthToNum(m[2]);
      if (monthNum) {
        const d = parseInt(m[1], 10), y = parseInt(m[3], 10);
        if (d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
          const dateCenter = regionOffset + m.index + Math.floor(m[0].length / 2);
          const dist = Math.abs(dateCenter - kwCenter);
          if (dist < bestDist) {
            bestDist = dist;
            bestDate = `${y}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          }
        }
      }
    }

    if (bestDate) return bestDate;
  }

  return undefined;
}

// ── Helper: find a date ONLY AFTER a keyword in text ─────────────────────────
// Unlike findDateNearKeyword, this does NOT search backward.
// Critical for "FECHA DE CONTROL" where the date AFTER the label is the
// expiry date, and the date BEFORE it belongs to "ÚLTIMO CONTROL".
function findDateAfterKeyword(text: string, keywordPatterns: string[]): string | undefined {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  for (const kw of keywordPatterns) {
    const kwMatch = normalized.match(new RegExp(kw, 'i'));
    if (!kwMatch) continue;

    const kwEnd = normalized.indexOf(kwMatch[0]) + kwMatch[0].length;
    const fwdWindow = text.substring(kwEnd, kwEnd + 120);
    const fwdDate = tryParseDateInWindow(fwdWindow);
    if (fwdDate) return fwdDate;
  }
  return undefined;
}

// ── Helper: find a date ONLY BEFORE a keyword in text ────────────────────────
function findDateBeforeKeyword(text: string, keywordPatterns: string[]): string | undefined {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  for (const kw of keywordPatterns) {
    const kwMatch = normalized.match(new RegExp(kw, 'i'));
    if (!kwMatch) continue;

    const kwStart = normalized.indexOf(kwMatch[0]);
    const backStart = Math.max(0, kwStart - 120);
    const backWindow = text.substring(backStart, kwStart);
    const backDate = tryParseDateInWindow(backWindow);
    if (backDate) return backDate;
  }
  return undefined;
}

// ── Parser: Revisión Técnica ────────────────────────────────────────────────
// Rules:
// - Issue date: first date found in text (front photo only)
// - Expiry: last day of the expiry month (read from text), year = issue year + 1
// - If no expiry month found in text, default to issue month + 1 year
export function parseTechnicalReview(text: string): OcrResult {
  const dates = extractDates(text);
  const issueDate = dates[0];

  // Find expiry month from text
  const expiryMonth = findExpiryMonth(text);

  let expiryDate: string | undefined;
  if (issueDate) {
    const issueYear = parseInt(issueDate.split('-')[0], 10);
    const issueMonth = parseInt(issueDate.split('-')[1], 10);
    // Use found expiry month, or default to same month as issue
    const expMonth = expiryMonth || issueMonth;
    expiryDate = lastDayOfMonth(issueYear + 1, expMonth);
  }

  return { issueDate, expiryDate };
}

// ── Parser: Licencia de Conducir ────────────────────────────────────────────
// Two license formats are supported:
//
// NEW FORMAT (municipalidad layout):
//   "MUNICIPALIDAD DE SANTIAGO"
//   "ÚLTIMO CONTROL: 05/04/2023    PRÓXIMO CONTROL: 19/04/2029"
//   - "ÚLTIMO CONTROL" → issueDate (emission)
//   - "PRÓXIMO CONTROL" → expiryDate (next control)
//
// OLD FORMAT (registro civil layout):
//   "FECHA ÚLTIMO CONTROL" → issueDate
//   "FECHA DE CONTROL"     → expiryDate
//   OR the date under "DIRECCIÓN/DOMICILIO" is the issue date.
//
// STRATEGY: Use findDateNearestKeyword (bidirectional-by-distance) for
// "ÚLTIMO CONTROL" (both formats) and findDateAfterKeyword for
// "PRÓXIMO CONTROL" and "FECHA DE CONTROL" (expiry). The nearest-date
// search handles Tesseract reordering where the issue date appears before
// the label in OCR output.
//
// For old licenses where "ÚLTIMO CONTROL" isn't recognized, fall back to
// the date near "DIRECCIÓN/DOMICILIO" as issueDate.
//
// Tesseract often garbles accented chars and letters (1/i/l/0 confusion),
// so we use fuzzy keyword patterns.
export function parseDriversLicense(text: string): OcrResult {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // ── 1. Keyword-based extraction ────────────────────────────────────────
  // "ÚLTIMO CONTROL" → issueDate — nearest-date search (handles both
  // date-before-label and date-after-label Tesseract output).
  const ultimoPatterns = [
    'fecha\\s+ult[1i0]?mo',            // "fecha ultimo" — PRIMARY: no "CONTROL" needed
    'fecha.*?ult[1i0]?mo',             // "fecha...ultimo" garbled between words
    'ult[1i0]?mo\\s+control',          // "ultimo control" — when fully readable
    'ult[1i0]?mo',                     // just "ultimo" nearby
    'u[1i0]?lt[1i0]?mo',              // "ultimo" with 1/i/0 confusion
  ];
  let issueDate = findDateNearestKeyword(text, ultimoPatterns);

  // "PRÓXIMO CONTROL" → expiryDate (new format), forward-only.
  const proximoPatterns = [
    'prox[1i0]?mo\\s+control',         // "proximo control" — PRIMARY
    'fecha\\s+de\\s+prox[1i0]?mo\\s+control', // "fecha de proximo control"
    'prox[1i0]?mo',                    // just "proximo"
    'p[1i0]?rox[1i0]?mo',             // "proximo" with 1/i/0 confusion
  ];
  let expiryDate = findDateAfterKeyword(text, proximoPatterns);

  // Fallback: "FECHA DE CONTROL" → expiryDate (old format), forward-only.
  if (!expiryDate) {
    expiryDate = findDateAfterKeyword(text, ['fecha\\s+de\\s+control']);
  }

  if (!expiryDate) {
    // Fallback: "control" standalone (exclude "ultimo control")
    // Also exclude "proximo control" to avoid matching the issue-date label
    const standaloneControl = text.match(/(?<!ult[1i0]?mo\s)(?<!prox[1i0]?mo\s)(control)/i);
    if (standaloneControl) {
      const controlIdx = text.indexOf(standaloneControl[1], standaloneControl.index);
      const afterWindow = text.substring(controlIdx + 7, controlIdx + 7 + 120);
      expiryDate = tryParseDateInWindow(afterWindow);
    }
  }

  // ── 1a. Deduplication: if expiryDate === issueDate, search further ahead ──
  // This happens when both labels are consecutive without a date between them.
  if (issueDate && expiryDate && expiryDate === issueDate) {
    // Re-find the expiry keyword and skip past the issue date
    const proxMatch = normalized.match(/prox[1i0]?mo\\s+control|fecha\\s+de\\s+control/i);
    if (proxMatch) {
      const kwEnd = normalized.indexOf(proxMatch[0]) + proxMatch[0].length;
      const fwdText = text.substring(kwEnd, kwEnd + 120);
      const dateStr = issueDate.split('-').reverse().join('/');
      const dateStrAlt = issueDate.split('-').reverse().join('-');
      const cleaned = fwdText.replace(new RegExp(escapeRegex(dateStr), 'g'), '')
                             .replace(new RegExp(escapeRegex(dateStrAlt), 'g'), '');
      const nextDate = tryParseDateInWindow(cleaned);
      if (nextDate) expiryDate = nextDate;
    }
  }

  // ── 1b. Fallback: if "ÚLTIMO CONTROL" label wasn't recognized,
  // extract the date BEFORE "FECHA DE CONTROL" as issueDate.
  if (!issueDate) {
    issueDate = findDateBeforeKeyword(text, ['fecha\\s+de\\s+control']);
  }

  // ── 1c. Old license fallback: if issueDate still not found, check if
  // there's an address (DIRECCIÓN/DOMICILIO) and take the date after it.
  // On old Chilean licenses, the issue date sits below the address line.
  if (!issueDate) {
    const addressPatterns = [
      'direcci[oó]n',                   // "dirección"
      'domicilio',                      // "domicilio"
      'dir',                            // "dir" abbreviated
    ];
    issueDate = findDateAfterKeyword(text, addressPatterns);
  }

  // ── 2. Labeled date extraction: find keyword positions in normalized text ─
  if (!issueDate || !expiryDate) {
    // Find all date positions in the normalized text
    const allDatesWithPos: { date: string; pos: number }[] = [];
    const dateRegex = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g;
    let m: RegExpExecArray | null;
    while ((m = dateRegex.exec(normalized)) !== null) {
      const [, day, month, year] = m;
      const d = parseInt(day, 10), mo = parseInt(month, 10), y = parseInt(year, 10);
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100) {
        allDatesWithPos.push({
          date: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          pos: m.index,
        });
      }
    }

    if (!issueDate && allDatesWithPos.length > 0) {
      // Strategy A: Find the "ultimo" keyword position
      const ultimoKwPos = normalized.search(/ult[1i]?mo/i);
      if (ultimoKwPos >= 0) {
        const afterUltimo = allDatesWithPos.filter(d => d.pos > ultimoKwPos);
        if (afterUltimo.length > 0) {
          issueDate = afterUltimo[0].date;
        } else {
          const beforeUltimo = allDatesWithPos.filter(d => d.pos < ultimoKwPos);
          if (beforeUltimo.length > 0) {
            issueDate = beforeUltimo[beforeUltimo.length - 1].date;
          }
        }
      }

      // Strategy B: If "ultimo" not found, use the date BEFORE "fecha de control"
      if (!issueDate) {
        const fcPos = normalized.search(/fecha\s+de\s+control|prox[1i0]?mo\s+control/i);
        if (fcPos >= 0) {
          const beforeControl = allDatesWithPos.filter(d => d.pos < fcPos);
          if (beforeControl.length > 0) {
            issueDate = beforeControl[beforeControl.length - 1].date;
          }
        }
      }

      // Strategy C: Date after "dirección/domicilio" (old license)
      if (!issueDate) {
        const dirPos = normalized.search(/direcci[oó]n|domicilio/i);
        if (dirPos >= 0) {
          const afterDir = allDatesWithPos.filter(d => d.pos > dirPos);
          if (afterDir.length > 0) {
            issueDate = afterDir[0].date;
          }
        }
      }
    }

    if (!expiryDate && allDatesWithPos.length > 0) {
      // Find the expiry keyword position (proximo control or fecha de control)
      const controlKwPos = (() => {
        const proxPos = normalized.search(/prox[1i0]?mo\s+control/i);
        if (proxPos >= 0) return proxPos;
        const fcPos = normalized.search(/fecha\s+de\s+control/i);
        if (fcPos >= 0) return fcPos;
        // Fallback: standalone "control" that is NOT preceded by "ultimo" or "proximo"
        let searchFrom = 0;
        while (searchFrom < normalized.length) {
          const pos = normalized.indexOf('control', searchFrom);
          if (pos < 0) break;
          const before = normalized.substring(Math.max(0, pos - 15), pos);
          if (!/ult[1i]?mo|prox[1i]?mo/i.test(before)) return pos;
          searchFrom = pos + 7;
        }
        return -1;
      })();
      if (controlKwPos >= 0) {
        const afterControl = allDatesWithPos.filter(d => d.pos > controlKwPos && d.date !== issueDate);
        if (afterControl.length > 0) {
          expiryDate = afterControl[0].date;
        }
      }
    }
  }

  // ── 2a. Cross-validation: ensure issueDate < expiryDate ────────────────
  if (issueDate && expiryDate) {
    if (new Date(expiryDate) <= new Date(issueDate)) {
      const allDates = extractDates(text);
      if (allDates.length >= 2) {
        const sorted = [...allDates].sort();
        const chronoIssue = sorted[0];
        const chronoExpiry = sorted[sorted.length - 1];
        if (new Date(chronoExpiry) > new Date(chronoIssue)) {
          issueDate = chronoIssue;
          expiryDate = chronoExpiry;
        }
      } else {
        const earlier = issueDate < expiryDate ? issueDate : expiryDate;
        const later = issueDate < expiryDate ? expiryDate : issueDate;
        issueDate = earlier;
        expiryDate = later;
        if (issueDate === expiryDate) {
          const [y, m] = issueDate.split('-').map(Number);
          expiryDate = lastDayOfMonth(y + 6, m);
        }
      }
    }
  }

  // ── 3. Fallback: positional logic from all dates in text ───────────────
  if (!issueDate || !expiryDate) {
    const allDates = extractDates(text);
    if (allDates.length >= 2) {
      const sorted = [...allDates].sort();
      if (!issueDate) issueDate = sorted[0];
      if (!expiryDate) expiryDate = sorted[sorted.length - 1];
      if (new Date(expiryDate) <= new Date(issueDate)) {
        [issueDate, expiryDate] = [expiryDate, issueDate];
      }
    } else if (allDates.length === 1) {
      const singleDate = allDates[0];
      const year = parseInt(singleDate.split('-')[0], 10);
      const nowYear = new Date().getFullYear();
      // Check if this single date is near an expiry keyword — likely expiry, not issue
      const nearExpiryKeyword = findDateAfterKeyword(text, [
        'prox[1i0]?mo\\s+control',
        'fecha\\s+de\\s+control',
      ]);
      if (nearExpiryKeyword === singleDate) {
        expiryDate = singleDate;
        const [y, m] = expiryDate.split('-').map(Number);
        issueDate = lastDayOfMonth(y - 6, m);
      } else if (year > nowYear + 4) {
        expiryDate = singleDate;
        const [y, m] = expiryDate.split('-').map(Number);
        issueDate = lastDayOfMonth(y - 6, m);
      } else {
        issueDate = singleDate;
      }
    }
  }

  // ── 4. Fallback: +6 years from issue date ──────────────────────────────
  if (!expiryDate && issueDate) {
    const [y, m] = issueDate.split('-').map(Number);
    expiryDate = lastDayOfMonth(y + 6, m);
  }

  const rut = extractRut(text);

  console.log(`[OCR-LICENSE] keyword issueDate=${issueDate}, expiryDate=${expiryDate}`);
  console.log(`[OCR-LICENSE] normalized (first 500):\n${normalized.substring(0, 500)}`);

  return { issueDate, expiryDate, rut };
}

// ── Helper: escape regex special characters ──────────────────────────────────
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Common motorcycle brands (for lenient matching when labels are missing) ──
const KNOWN_BRANDS = [
  'YAMAHA', 'HONDA', 'SUZUKI', 'KAWASAKI', 'BMW', 'DUCATI', 'KTM', 'TRIUMPH',
  'HARLEY DAVIDSON', 'HARLEY-DAVIDSON', 'HARLEY', 'INDIAN', 'APRILIA', 'BETA',
  'GASGAS', 'HUSQVARNA', 'SHERCO', 'VENTO', 'ZANELLA', 'GILERA', 'PIAGGIO',
  'VESPA', 'SYM', 'KYMCO', 'BASHAN', 'MOTORRA', 'CORVEN', 'GUERRERO',
  'BAJAJ', 'HERO', 'TVS', 'ROYAL ENFIELD', 'CFMOTO', 'BENELLI', 'MOTO GUZZI',
  'HIMO', 'VOLK', 'LIFAN', 'DAYUN', 'JIALING', 'HAOJUE', 'SUNDIRO', 'URAL',
];

// ── Common Spanish color names (for lenient matching) ────────────────────────
const COLOR_WORDS = [
  'ROJO', 'AZUL', 'VERDE', 'NEGRO', 'NEGRA', 'BLANCO', 'BLANCA', 'GRIS',
  'PLATEADO', 'DORADO', 'AMARILLO', 'NARANJA', 'MARRON', 'CAFE', 'CELESTE',
  'VINO', 'BORDEAUX', 'VIOLETA', 'BEIGE', 'CREMA', 'ROSA', 'ROSADO',
];

// ── Parser: Padrón ──────────────────────────────────────────────────────────
export function parsePadron(text: string): OcrResult {
  // Find date near "EMISIÓN" keyword — not just the first date in the text
  const issueDate = findDateNearKeyword(text, ['emisi[oó]n', 'fecha\s+de\s+emisi[oó]n']);
  const patente = extractPatente(text);
  const rut = extractRut(text);

  // Try to extract brand/model/year
  let brand: string | undefined;
  let model: string | undefined;
  let year: string | undefined;

  // Year: 4-digit number between 1980-2030
  const yearMatch = text.match(/\b((?:19|20)\d{2})\b/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10);
    if (y >= 1980 && y <= 2035) year = String(y);
  }

  // Brand/model: look for common patterns (labeled first)
  const brandLabelMatch = text.match(/(?:marca|brand|fabricante)[:\s]+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s]+)/i);
  if (brandLabelMatch) {
    brand = brandLabelMatch[1].trim();
  }

  const modelLabelMatch = text.match(/(?:modelo|model)[:\s]+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ0-9\s]+)/i);
  if (modelLabelMatch) {
    model = modelLabelMatch[1].trim();
  }

  // Fallback: if brand not found by label, try known brands in text
  if (!brand) {
    const upperText = text.toUpperCase();
    for (const kb of KNOWN_BRANDS) {
      const idx = upperText.indexOf(kb);
      if (idx >= 0) {
        // Extract the word(s) around the match for the brand name
        const before = upperText.substring(Math.max(0, idx - 20), idx);
        const after = upperText.substring(idx, idx + kb.length + 20);
        // If preceded by a label, use the label extraction instead
        if (!/(?:marca|marc|MARCA)\s*:?\s*$/i.test(before.trim())) {
          brand = kb;
          break;
        }
      }
    }
  }

  // Engine/chassis numbers: labeled first, then fallback to alphanumeric sequences
  let engineNumber: string | undefined;
  let chassisNumber: string | undefined;
  let serialNumber: string | undefined;

  const engineMatch = text.match(/(?:motor|n[uú]mero\s+de\s+motor|nro\.?\s*motor|n°\s*motor)[:\s]*([A-Za-z0-9]+)/i);
  if (engineMatch) engineNumber = engineMatch[1];

  const chassisMatch = text.match(/(?:chasis|n[uú]mero\s+de\s+chasis|nro\.?\s*chasis|n°\s*chasis|vin)[:\s]*([A-Za-z0-9]+)/i);
  if (chassisMatch) chassisNumber = chassisMatch[1];

  const serialMatch = text.match(/(?:serie|n[uú]mero\s+de\s+serie|nro\.?\s*serie|n°\s*serie)[:\s]*([A-Za-z0-9]+)/i);
  if (serialMatch) serialNumber = serialMatch[1];

  // Color: labeled first
  let color: string | undefined;
  const colorLabelMatch = text.match(/(?:color|colour)[:\s]+([A-Za-záéíóúñÁÉÍÓÚÑ]+)/i);
  if (colorLabelMatch) {
    color = colorLabelMatch[1].trim();
  }

  // Fallback color: scan text for known color words
  if (!color) {
    const upperText = text.toUpperCase();
    for (const cw of COLOR_WORDS) {
      // Match whole word (surrounded by non-alphanumeric)
      const re = new RegExp(`\\b${cw}\\b`);
      if (re.test(upperText)) {
        color = cw.charAt(0) + cw.substring(1).toLowerCase();
        break;
      }
    }
  }

  return {
    issueDate,
    patente,
    rut,
    brand,
    model,
    year,
    engineNumber,
    chassisNumber,
    serialNumber,
    color,
  };
}

// ── Parser: Seguro Obligatorio ─────────────────────────────────────────────
export function parseInsurance(text: string): OcrResult {
  // Issue date: near "rige", "desde"
  let issueDate = findDateNearKeyword(text, ['rige', 'desde']);

  // Fallback: first date in the text
  if (!issueDate) {
    const allDates = extractDates(text);
    if (allDates.length >= 1) issueDate = allDates[0];
  }

  // Expiry is ALWAYS March 31 of the year after issue
  let expiryDate: string | undefined;
  if (issueDate) {
    const [y] = issueDate.split('-').map(Number);
    expiryDate = `${y + 1}-03-31`;
  }

  const patente = extractPatente(text);
  const rut = extractRut(text);

  return { issueDate, expiryDate, patente, rut };
}

// ── Parser: Generic fallback ────────────────────────────────────────────────
export function parseGeneric(text: string): OcrResult {
  const dates = extractDates(text);
  const rut = extractRut(text);
  const patente = extractPatente(text);

  return {
    issueDate: dates[0],
    expiryDate: dates[1],
    rut,
    patente,
  };
}

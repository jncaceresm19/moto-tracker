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
// Chilean license back has two date fields:
//   - "FECHA ÚLTIMO CONTROL" → issueDate (when the license was last emitted)
//   - "FECHA DE CONTROL"     → expiryDate (next control deadline)
//
// "CONTROL" in "FECHA ÚLTIMO CONTROL" is often partially hidden by the
// document layout, so Tesseract may only read "FECHA ULTIMO" without it.
// The PRIMARY pattern is "FECHA ULTIMO" — no "CONTROL" needed.
//
// CRITICAL: ALL keyword searches use forward-only (findDateAfterKeyword).
// Bidirectional search (findDateNearKeyword) grabs the wrong date because
// it searches backward first from either label.
//
// When Tesseract fails to recognize "FECHA ÚLTIMO", we fall back to
// extracting the date that appears BEFORE "FECHA DE CONTROL" as issueDate.
//
// Tesseract often garbles accented chars and letters (1/i/l/0 confusion),
// so we use fuzzy keyword patterns.
export function parseDriversLicense(text: string): OcrResult {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // ── 1. Keyword-based extraction — ALL forward-only ─────────────────────
  // CRITICAL: Using forward-only search (findDateAfterKeyword) for BOTH labels.
  // findDateNearKeyword searches backward first — root cause of date swapping.
  //
  // The actual label is "FECHA ÚLTIMO CONTROL", where "CONTROL" is often
  // partially hidden by the document layout. Tesseract may only read
  // "FECHA ULTIMO" without "CONTROL". So we search for "FECHA ULTIMO"
  // as the PRIMARY pattern — it doesn't need "CONTROL" to match.
  const ultimoPatterns = [
    'fecha\\s+ult[1i0]?mo',            // "fecha ultimo" — PRIMARY: no "CONTROL" needed
    'fecha.*?ult[1i0]?mo',             // "fecha...ultimo" garbled between words
    'ult[1i0]?mo\\s+control',          // "ultimo control" — when fully readable
    'ult[1i0]?mo',                     // just "ultimo" nearby
    'u[1i0]?lt[1i0]?mo',              // "ultimo" with 1/i/0 confusion
  ];
  let issueDate = findDateAfterKeyword(text, ultimoPatterns);

  // "FECHA DE CONTROL" → expiryDate, forward-only
  let expiryDate = findDateAfterKeyword(text, ['fecha\\s+de\\s+control']);
  if (!expiryDate) {
    // Fallback: "control" standalone (exclude "ultimo control")
    const standaloneControl = text.match(/(?<!ult[1i0]?mo\s)(control)/i);
    if (standaloneControl) {
      const controlIdx = text.indexOf(standaloneControl[1], standaloneControl.index);
      const afterWindow = text.substring(controlIdx + 7, controlIdx + 7 + 120);
      expiryDate = tryParseDateInWindow(afterWindow);
    }
  }

  // ── 1b. Fallback: if "FECHA ÚLTIMO" label wasn't recognized,
  // extract the date BEFORE "FECHA DE CONTROL" as issueDate.
  if (!issueDate) {
    issueDate = findDateBeforeKeyword(text, ['fecha\\s+de\\s+control']);
  }

  // ── 2. Labeled date extraction: find "ULTIMO" and "CONTROL" labels ─────
  // Some licenses print labels on one line and dates on the next.
  // Try to extract dates by their label position in the normalized text.
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
          // Date might be BEFORE the keyword (OCR reorder)
          const beforeUltimo = allDatesWithPos.filter(d => d.pos < ultimoKwPos);
          if (beforeUltimo.length > 0) {
            issueDate = beforeUltimo[beforeUltimo.length - 1].date;
          }
        }
      }

      // Strategy B: If "ultimo" not found, use the date BEFORE "fecha de control"
      // The "ÚLTIMO CONTROL" date is always above/earlier than "FECHA DE CONTROL"
      if (!issueDate) {
        const fcPos = normalized.search(/fecha\s+de\s+control/i);
        if (fcPos >= 0) {
          const beforeControl = allDatesWithPos.filter(d => d.pos < fcPos);
          if (beforeControl.length > 0) {
            // Take the date closest to (but before) "fecha de control"
            issueDate = beforeControl[beforeControl.length - 1].date;
          }
        }
      }
    }

    if (!expiryDate && allDatesWithPos.length > 0) {
      // Find the "control" keyword position — the date nearest AFTER it is expiryDate
      // But skip if it matches "ultimo control" (that's issueDate)
      const controlKwPos = (() => {
        // Look for "fecha de control" specifically, not "ultimo control"
        const fcPos = normalized.search(/fecha\s+de\s+control/i);
        if (fcPos >= 0) return fcPos;
        // Fallback: find standalone "control" that is NOT preceded by "ultimo"
        let searchFrom = 0;
        while (searchFrom < normalized.length) {
          const pos = normalized.indexOf('control', searchFrom);
          if (pos < 0) break;
          const before = normalized.substring(Math.max(0, pos - 15), pos);
          if (!/ult[1i]?mo/i.test(before)) return pos;
          searchFrom = pos + 7;
        }
        return -1;
      })();
      if (controlKwPos >= 0) {
        const afterControl = allDatesWithPos.filter(d => d.pos > controlKwPos);
        if (afterControl.length > 0) {
          expiryDate = afterControl[0].date;
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
      const year = parseInt(allDates[0].split('-')[0], 10);
      const nowYear = new Date().getFullYear();
      if (year > nowYear + 4) {
        expiryDate = allDates[0];
        const [y, m] = expiryDate.split('-').map(Number);
        issueDate = lastDayOfMonth(y - 6, m);
      } else {
        issueDate = allDates[0];
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

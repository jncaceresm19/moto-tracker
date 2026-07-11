# Spec: Rain Alerts & Moto Verification

## Feature 1 — Rain Alert on Home Screen

### 1. Database Schema

```typescript
// packages/backend/src/db/schema.ts — new table
export const weatherCache = sqliteTable('weather_cache', {
  zoneId: text('zone_id').primaryKey(), // comuna ID (e.g., 'santiago', 'Providencia')
  zoneName: text('zone_name').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  data: text('data').notNull(), // JSON: OpenWeatherMap One Call response
  lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const idxWeatherCacheLastFetched = index('idx_weather_cache_last_fetched').on(weatherCache.lastFetchedAt);
```

### 2. Zone Mapping

**Table: Chilean comuna centroids** (seed data, ~346 rows)

```typescript
// packages/backend/src/data/chileComunas.ts
export interface ComunaZone {
  id: string;           // comuna name normalized (e.g., 'santiago')
  name: string;         // display name (e.g., 'Santiago')
  region: string;       // region name
  latitude: number;     // centroid lat
  longitude: number;    // centroid lon
}

export const CHILE_COMUNAS: ComunaZone[] = [
  { id: 'santiago', name: 'Santiago', region: 'Metropolitana', latitude: -33.4489, longitude: -70.6693 },
  { id: 'providencia', name: 'Providencia', region: 'Metropolitana', latitude: -33.4258, longitude: -70.6112 },
  // ... ~344 more
];
```

**Zone resolution algorithm:**

```typescript
// packages/backend/src/services/weatherZone.ts
export function resolveZone(lat: number, lon: number): ComunaZone | null {
  // Find nearest comuna centroid using Haversine distance
  // Return null if closest is >50km away (rural area, no alert)
  let closest: ComunaZone | null = null;
  let minDist = Infinity;
  
  for (const comuna of CHILE_COMUNAS) {
    const dist = haversineDistance(lat, lon, comuna.latitude, comuna.longitude);
    if (dist < minDist) {
      minDist = dist;
      closest = comuna;
    }
  }
  
  return minDist <= 50 ? closest : null; // 50km threshold
}
```

### 3. API Contract

**GET /api/weather/rain-alert**

Request:
```
Headers: Authorization: Bearer <token>
Query: lat (number), lon (number) — user's current location
```

Response (200):
```json
{
  "success": true,
  "data": {
    "shouldShow": true,
    "minutesUntilRain": 42,
    "probability": 78,
    "message": "Lluvia en ~40 min",
    "suggestion": "Considera esperar o llevar equipo impermeable",
    "zoneName": "Providencia"
  }
}
```

Response when no rain expected:
```json
{
  "success": true,
  "data": {
    "shouldShow": false,
    "minutesUntilRain": null,
    "probability": 0,
    "message": null,
    "suggestion": null,
    "zoneName": "Providencia"
  }
}
```

Error Response (400):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_LOCATION",
    "message": "Invalid coordinates provided"
  }
}
```

### 4. Cache Logic

```typescript
// packages/backend/src/services/weatherCache.ts
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function getWeatherForZone(zone: ComunaZone): Promise<WeatherData> {
  const cached = await db.select().from(weatherCache)
    .where(eq(weatherCache.zoneId, zone.id))
    .get();
  
  const now = new Date();
  
  // Lazy refresh: if stale, fetch before returning
  if (cached && (now.getTime() - cached.lastFetchedAt.getTime()) < CACHE_TTL_MS) {
    return JSON.parse(cached.data);
  }
  
  // Fetch fresh data
  const freshData = await fetchOpenWeatherMap(zone.latitude, zone.longitude);
  
  if (cached) {
    // Update existing
    await db.update(weatherCache)
      .set({ data: JSON.stringify(freshData), lastFetchedAt: now, updatedAt: now })
      .where(eq(weatherCache.zoneId, zone.id));
  } else {
    // Insert new
    await db.insert(weatherCache).values({
      zoneId: zone.id,
      zoneName: zone.name,
      latitude: zone.latitude,
      longitude: zone.longitude,
      data: JSON.stringify(freshData),
      lastFetchedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  
  return freshData;
}
```

### 5. OpenWeatherMap Integration

```typescript
// packages/backend/src/services/openWeatherMap.ts
const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall';

interface OpenWeatherResponse {
  minutely: Array<{
    dt: number;       // unix timestamp
    precipitation: number; // mm
    probability: number;   // 0-100
  }>;
  hourly: Array<{
    dt: number;
    pop: number;      // probability of precipitation 0-1
    rain?: { '1h': number };
  }>;
}

export async function fetchOpenWeatherMap(lat: number, lon: number): Promise<OpenWeatherResponse> {
  const url = `${BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&exclude=current,minutely,daily,alerts`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenWeatherMap API error: ${response.status}`);
  }
  
  return response.json();
}

export function extractRainAlert(data: OpenWeatherResponse): RainAlertResult {
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  
  // Check minutely data (next 60 min, most precise)
  if (data.minutely) {
    for (const minute of data.minutely) {
      const minutesAhead = (minute.dt * 1000 - now) / 60000;
      if (minutesAhead > 0 && minutesAhead <= 60 && minute.probability > 60) {
        return {
          shouldShow: true,
          minutesUntilRain: Math.round(minutesAhead),
          probability: minute.probability,
        };
      }
    }
  }
  
  // Check hourly data (next 2 hours)
  if (data.hourly) {
    for (const hour of data.hourly) {
      const hoursAhead = (hour.dt * 1000 - now) / 3600000;
      if (hoursAhead > 0 && hoursAhead <= 2 && hour.pop > 0.6) {
        return {
          shouldShow: true,
          minutesUntilRain: Math.round(hoursAhead * 60),
          probability: Math.round(hour.pop * 100),
        };
      }
    }
  }
  
  return { shouldShow: false, minutesUntilRain: null, probability: 0 };
}
```

### 6. Frontend Component

```typescript
// packages/mobile/src/components/RainAlertCard.tsx
interface RainAlertCardProps {
  minutesUntilRain: number;
  probability: number;
  zoneName?: string;
  onDismiss: () => void;
  onPress: () => void;
}

// Styling: amber/orange theme (#F59E0B accent)
// Layout: compact card with rain icon, message, dismiss X button
// Position: between DashboardPanel (GPS) and TheftAlerts section in Home
```

### 7. Dismiss Logic

```typescript
// packages/mobile/src/services/rainAlertDismiss.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISS_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function isDismissed(userId: string): Promise<boolean> {
  const key = `rain_alert_dismissed_${userId}`;
  const dismissedAt = await AsyncStorage.getItem(key);
  if (!dismissedAt) return false;
  
  return (Date.now() - parseInt(dismissedAt)) < DISMISS_COOLDOWN_MS;
}

export async function dismiss(userId: string): Promise<void> {
  const key = `rain_alert_dismissed_${userId}`;
  await AsyncStorage.setItem(key, Date.now().toString());
}

export async function shouldShowAlert(
  userId: string,
  probability: number,
  previousProbability: number
): Promise<boolean> {
  const dismissed = await isDismissed(userId);
  if (!dismissed) return true;
  
  // Re-appear if probability increased significantly (e.g., from 65% to 85%)
  if (probability > previousProbability + 15) return true;
  
  return false;
}
```

### 8. i18n Keys

```typescript
// packages/mobile/src/language-context.tsx
en: {
  weatherRainAlertTitle: 'Rain expected soon',
  weatherRainAlertSubtitle: 'Consider waiting or bringing waterproof gear',
  weatherRainAlertDetail: 'Rain in approximately {minutes} minutes ({probability}% probability)',
  weatherRainAlertDismiss: 'Dismiss',
  weatherRainAlertZone: 'Zone: {zone}',
}

es: {
  weatherRainAlertTitle: 'Lluvia esperada pronto',
  weatherRainAlertSubtitle: 'Considera esperar o llevar equipo impermeable',
  weatherRainAlertDetail: 'Lluvia en aproximadamente {minutes} minutos (probabilidad {probability}%)',
  weatherRainAlertDismiss: 'Cerrar',
  weatherRainAlertZone: 'Zona: {zone}',
}
```

---

## Feature 2 — Moto Verification System

### 1. Database Schema Changes

```typescript
// packages/backend/src/db/schema.ts — additions

// Users table additions
export const usersExtended = sqliteTable('users', {
  // ... existing fields ...
  rut: text('rut').unique(),
  verificadoClaveunica: integer('verificado_claveunica', { mode: 'boolean' }).default(false),
  identidadVerificada: integer('identidad_verificada', { mode: 'boolean' }).default(false),
  otpSecret: text('otp_secret'),
  otpExpiresAt: integer('otp_expires_at', { mode: 'timestamp' }),
  otpAttempts: integer('otp_attempts').default(0),
  otpLockedUntil: integer('otp_locked_until', { mode: 'timestamp' }),
});

// Motorcycles table additions
export const motorcyclesExtended = sqliteTable('motorcycles', {
  // ... existing fields ...
  verificada: integer('verificada', { mode: 'boolean' }).default(false),
  verificadaEn: integer('verificada_en', { mode: 'timestamp' }),
  verificadaPor: text('verificada_por'), // 'clave_unica' | 'carnet' | 'padron'
  fotoConPatente: text('foto_con_patente'),
  rtVigente: integer('rt_vigente', { mode: 'boolean' }),
  encargoRobo: integer('encargo_robo', { mode: 'boolean' }).default(false),
  desvinculada: integer('desvinculada', { mode: 'boolean' }).default(false),
  desvinculadaEn: integer('desvinculada_en', { mode: 'timestamp' }),
});

// New table: pending verifications
export const verificacionesPendientes = sqliteTable('verificaciones_pendientes', {
  id: text('id').primaryKey(),
  motorcycleId: text('motorcycle_id').notNull().references(() => motorcycles.id),
  userId: text('user_id').notNull().references(() => users.id),
  tipo: text('tipo').notNull(), // 'carnet_front', 'carnet_back', 'selfie', 'carta_autorizacion'
  archivoUrl: text('archivo_url').notNull(),
  estado: text('estado').notNull().default('pendiente'), // 'pendiente' | 'aprobada' | 'rechazada'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  reviewerNotes: text('reviewer_notes'),
});

// OTP table (alternative to Redis)
export const otps = sqliteTable('otps', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  code: text('code').notNull(), // 6 digits
  tipo: text('tipo').notNull().default('email'), // 'email' | 'sms'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  used: integer('used', { mode: 'boolean' }).default(false),
});

export const idxOtpsUserId = index('idx_otps_user_id').on(otps.userId);
export const idxMotorcyclesVerificada = index('idx_motorcycles_verificada').on(motorcycles.verificada);
```

### 2. RUT Validation

```typescript
// packages/backend/src/services/rutValidation.ts
export function validateRut(rut: string): boolean {
  // Normalize: remove dots, dashes, spaces
  const cleaned = rut.replace(/[\.\-\s]/g, '').toUpperCase();
  
  // Format: digits + check digit (e.g., 12345678K)
  if (!/^\d+[0-9K]$/.test(cleaned)) return false;
  
  const body = cleaned.slice(0, -1);
  const expectedCheck = cleaned.slice(-1);
  
  // Modulo 11 algorithm
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const remainder = sum % 11;
  const computedCheck = remainder === 0 ? '0' : remainder === 1 ? 'K' : (11 - remainder).toString();
  
  return computedCheck === expectedCheck;
}

export function normalizeRut(rut: string): string {
  return rut.replace(/[\.\-\s]/g, '').toUpperCase();
}
```

### 3. ClaveÚnica OAuth Flow

```
1. Frontend: user taps "Registrarse con ClaveÚnica"
2. Frontend → GET /api/auth/claveunica → returns { authUrl }
3. Frontend: opens WebView/authSession to authUrl
4. ClaveÚnica login page → user authenticates
5. ClaveÚnica → GET /api/auth/claveunica/callback?code=XXX
6. Backend:
   a. Exchange code for token via ClaveÚnica token endpoint
   b. Validate token signature (JWT)
   c. Extract: rut, name, email
   d. Check if user exists by RUT or email
   e. If exists: link accounts, set verificado_claveunica = true
   f. If new: create user with verificado_claveunica = true, passwordHash = ''
   g. Generate JWT tokens
   h. Redirect to app with tokens
```

### 4. OTP System

```typescript
// packages/backend/src/services/otp.ts
const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(userId: string, email: string): Promise<{ success: boolean; error?: string }> {
  // Check lockout
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (user?.otpLockedUntil && user.otpLockedUntil > new Date()) {
    return { success: false, error: 'ACCOUNT_LOCKED' };
  }
  
  // Check resend cooldown
  const recentOtp = await db.select().from(otps)
    .where(eq(otps.userId, userId))
    .orderBy(desc(otps.createdAt))
    .get();
  
  if (recentOtp && (Date.now() - recentOtp.createdAt.getTime()) < RESEND_COOLDOWN_MS) {
    return { success: false, error: 'RESEND_COOLDOWN' };
  }
  
  const code = generateOtp();
  const now = new Date();
  
  await db.insert(otps).values({
    id: crypto.randomUUID(),
    userId,
    code,
    tipo: 'email',
    createdAt: now,
    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
  });
  
  // Send email (use existing email service or simple SMTP)
  await sendEmail(email, 'Tu código de verificación', `Tu código es: ${code}`);
  
  return { success: true };
}

export async function verifyOtp(userId: string, code: string): Promise<{ success: boolean; error?: string }> {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  
  if (user?.otpLockedUntil && user.otpLockedUntil > new Date()) {
    return { success: false, error: 'ACCOUNT_LOCKED' };
  }
  
  const otp = await db.select().from(otps)
    .where(and(
      eq(otps.userId, userId),
      eq(otps.code, code),
      eq(otps.used, false),
    ))
    .orderBy(desc(otps.createdAt))
    .get();
  
  if (!otp) {
    // Increment attempts
    const attempts = (user?.otpAttempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await db.update(users).set({
        otpAttempts: attempts,
        otpLockedUntil: new Date(Date.now() + LOCKOUT_MS),
      }).where(eq(users.id, userId));
      return { success: false, error: 'ACCOUNT_LOCKED' };
    }
    await db.update(users).set({ otpAttempts: attempts }).where(eq(users.id, userId));
    return { success: false, error: 'INVALID_CODE' };
  }
  
  if (otp.expiresAt < new Date()) {
    return { success: false, error: 'CODE_EXPIRED' };
  }
  
  // Mark as used
  await db.update(otps).set({ used: true }).where(eq(otps.id, otp.id));
  await db.update(users).set({ otpAttempts: 0, otpLockedUntil: null }).where(eq(users.id, userId));
  
  return { success: true };
}
```

### 5. Verification Flow

**ClaveÚnica User Path:**
```
1. User taps "Verificar esta moto"
2. System checks: user.verificado_claveunica == true?
   YES → Show padrón upload screen only
3. User uploads padrón photo
4. System validates plate format
5. System checks prt.cl for RT status
6. System checks encargoporrobo
7. If all OK → motorcycle.verificada = true
8. If issues → show warnings, let user proceed
```

**Email User Path (First Moto):**
```
1. User taps "Verificar esta moto"
2. System checks: user.identidad_verificada == false?
   YES → Show full verification screen:
   a. Upload carnet front photo
   b. Upload carnet back photo
   c. Take selfie
   d. Upload padrón photo
3. System validates: RUT_carnet == RUT_registro == RUT_padrón
4. If match → motorcycle.verificada = true, user.identidad_verificada = true
5. If mismatch → show error, manual review
```

**Email User Path (Subsequent Motos):**
```
1. User taps "Verificar esta moto"
2. System checks: user.identidad_verificada == true?
   YES → Show padrón upload only (same as ClaveÚnica path)
```

### 6. Plate Validation

```typescript
// packages/backend/src/services/plateValidation.ts
const OLD_PLATE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{2}$/;
const NEW_PLATE_REGEX = /^[A-Z]{4}[0-9]{2}$/;

export function validatePlate(plate: string): { valid: boolean; format?: 'old' | 'new' } {
  const normalized = plate.toUpperCase().replace(/[\s\-]/g, '');
  
  if (OLD_PLATE_REGEX.test(normalized)) {
    return { valid: true, format: 'old' };
  }
  if (NEW_PLATE_REGEX.test(normalized)) {
    return { valid: true, format: 'new' };
  }
  
  return { valid: false };
}
```

### 7. External Service Integration

```typescript
// packages/backend/src/services/vehicleCheck.ts
export async function checkTechnicalReview(plate: string): Promise<{ vigente: boolean; error?: string }> {
  try {
    const response = await fetch(`https://www.prt.cl/consulta/resultado?patente=${plate}`);
    const html = await response.text();
    
    // Parse HTML for RT status
    // This is fragile — log errors for monitoring
    const hasVigente = html.includes('VIGENTE') || html.includes('vigente');
    return { vigente: hasVigente };
  } catch (error) {
    console.error('[VEHICLE_CHECK] prt.cl error:', error);
    return { vigente: false, error: 'SERVICE_UNAVAILABLE' };
  }
}

export async function checkTheftHistory(plate: string): Promise<{ encargo: boolean; error?: string }> {
  try {
    const response = await fetch(`https://www.encargoporrobovehiculos.cl/consulta?patente=${plate}`);
    const html = await response.text();
    
    const hasEncargo = html.includes('ENCARGO') || html.includes('encargo');
    return { encargo: hasEncargo };
  } catch (error) {
    console.error('[VEHICLE_CHECK] encargoporrobo error:', error);
    return { encargo: false, error: 'SERVICE_UNAVAILABLE' };
  }
}
```

### 8. API Endpoints

**POST /api/auth/register** (modified)
```json
Request: { email, password, name, phone?, rut }
Response: { user, accessToken, refreshToken }
```

**POST /api/auth/claveunica** (new)
```json
Response: { authUrl: "https://accounts.climateunica.gob.cl/..." }
```

**POST /api/auth/claveunica/callback** (new)
```json
Request: { code }
Response: { user, accessToken, refreshToken, linked: boolean }
```

**POST /api/otp/send** (new)
```json
Headers: Authorization: Bearer <token>
Response: { success: true }
```

**POST /api/otp/verify** (new)
```json
Headers: Authorization: Bearer <token>
Request: { code }
Response: { success: true }
```

**POST /api/motorcycles/:id/verify** (new)
```json
Headers: Authorization: Bearer <token>
Request: { padronUrl, carnetFrontUrl?, carnetBackUrl?, selfieUrl? }
Response: {摩托车.verificada: true, warnings: [...] }
```

**GET /api/motorcycles/:id/verification-status** (new)
```json
Response: { verificada, verificadaEn, verificadaPor, pendingFiles: [...] }
```

**POST /api/motorcycles/:id/unlink** (new)
```json
Headers: Authorization: Bearer <token>
Response: { success: true }
```

### 9. Security Considerations

- All endpoints require authentication
- RUT validation server-side (never trust client)
- OTP codes hashed before storage (bcrypt)
- Rate limiting on OTP endpoints (3 attempts per 10 min per user)
- Photo uploads: validate file type, max size 10MB
- ClaveÚnica token signature validation (never trust URL params)
- Scraping: use proper User-Agent, respect rate limits
- Data protection: carnet/selfie photos stored securely, not in logs

### 10. Migration Strategy

1. Add new columns to users table (nullable initially)
2. Add new columns to motorcycles table (nullable initially)
3. Create new tables (verificaciones_pendientes, otps, weather_cache)
4. Existing Google users: no forced migration, ask RUT only when verifying moto
5. Existing motorcycles: verificada defaults to false (they need to verify)

### 11. i18n Keys

```typescript
en: {
  // Registration
  registerRut: 'RUT',
  registerRutPlaceholder: '12345678-5',
  registerRutInvalid: 'Invalid RUT format',
  
  // ClaveÚnica
  registerWithClaveUnica: 'Register with ClaveÚnica',
  loginWithClaveUnica: 'Login with ClaveÚnica',
  claveUnicaLinking: 'We detected an existing account. Link your ClaveÚnica?',
  
  // Verification
  verifyMotoTitle: 'Verify your motorcycle',
  verifyMotoSubtitle: 'Verify to unlock theft reporting',
  verifyMotoPadron: 'Vehicle registration (padrón)',
  verifyMotoCarnetFront: 'ID card (front)',
  verifyMotoCarnetBack: 'ID card (back)',
  verifyMotoSelfie: 'Selfie with ID',
  verifyMotoPhoto: 'Photo with visible plate',
  verifyMotoPending: 'Verification pending review',
  verifyMotoRejected: 'Verification rejected',
  verifyMotoApproved: 'Verified',
  verifyMotoStart: 'Start verification',
  verifyMotoThirdParty: 'This motorcycle is not in my name',
  verifyMotoAuthLetter: 'Authorization letter required',
  
  // OTP
  otpTitle: 'Verify your email',
  otpSubtitle: 'Enter the 6-digit code sent to your email',
  otpResend: 'Resend code',
  otpResendIn: 'Resend in {seconds}s',
  otpLocked: 'Too many attempts. Try again in {minutes} minutes.',
  
  // Plate
  plateInvalid: 'Invalid license plate format',
  plateRtExpired: 'Technical review not current. Is this correct?',
  plateTheftHistory: 'This vehicle has a theft report on file',
  
  // Motorcycle limit
  motoLimitReached: 'Maximum 10 motorcycles per account',
  unlinkMoto: 'Unlink motorcycle',
  unlinkConfirm: 'You will no longer be able to report thefts for this motorcycle',
}

es: {
  registerRut: 'RUT',
  registerRutPlaceholder: '12345678-5',
  registerRutInvalid: 'RUT inválido',
  registerWithClaveUnica: 'Registrarse con ClaveÚnica',
  loginWithClaveUnica: 'Iniciar sesión con ClaveÚnica',
  claveUnicaLinking: 'Detectamos una cuenta existente. ¿Vincular tu ClaveÚnica?',
  verifyMotoTitle: 'Verificá tu moto',
  verifyMotoSubtitle: 'Verificá para poder reportar robos',
  verifyMotoPadron: 'Padrón de la moto',
  verifyMotoCarnetFront: 'Carnet (anverso)',
  verifyMotoCarnetBack: 'Carnet (reverso)',
  verifyMotoSelfie: 'Selfie con carnet',
  verifyMotoPhoto: 'Foto con patente visible',
  verifyMotoPending: 'Verificación en revisión',
  verifyMotoRejected: 'Verificación rechazada',
  verifyMotoApproved: 'Verificada',
  verifyMotoStart: 'Iniciar verificación',
  verifyMotoThirdParty: 'Esta moto no está a mi nombre',
  verifyMotoAuthLetter: 'Se requiere carta de autorización',
  otpTitle: 'Verificá tu correo',
  otpSubtitle: 'Ingresá el código de 6 dígitos enviado a tu correo',
  otpResend: 'Reenviar código',
  otpResendIn: 'Reenviar en {seconds}s',
  otpLocked: 'Demasiados intentos. Intentá de nuevo en {minutes} minutos.',
  plateInvalid: 'Formato de patente inválido',
  plateRtExpired: 'Revisión técnica no vigente. ¿Es correcto?',
  plateTheftHistory: 'Este vehículo tiene un encargo por robo',
  motoLimitReached: 'Máximo 10 motos por cuenta',
  unlinkMoto: 'Desvincular moto',
  unlinkConfirm: 'No podrás reportar robos de esta moto',
}
```

# Design: Rain Alerts & Moto Verification

## Architecture Overview

```
packages/backend/src/
├── db/
│   └── schema.ts                    # Modified: +weather_cache, +users fields, +motorcycles fields, +verificaciones_pendientes, +otps
├── routes/
│   ├── weather.ts                   # NEW: GET /api/weather/rain-alert
│   ├── auth.ts                      # Modified: +RUT validation, +ClaveÚnica endpoints
│   ├── motorcycles.ts               # Modified: +verification endpoints, +unlink
│   └── otp.ts                       # NEW: POST /api/otp/send, /api/otp/verify
├── services/
│   ├── weatherZone.ts               # NEW: zone resolution, comuna mapping
│   ├── weatherCache.ts              # NEW: cache logic, lazy TTL refresh
│   ├── openWeatherMap.ts            # NEW: API integration
│   ├── rutValidation.ts             # NEW: RUT modulo 11 algorithm
│   ├── claveUnica.ts                # NEW: OAuth flow
│   ├── otp.ts                       # NEW: OTP generation, verification, lockout
│   ├── plateValidation.ts           # NEW: plate regex, prt.cl, encargoporrobo
│   └── vehicleCheck.ts              # NEW: external service integration
├── data/
│   └── chileComunas.ts              # NEW: comuna centroid dataset
└── index.ts                         # Modified: register new routes

packages/mobile/src/
├── components/
│   ├── RainAlertCard.tsx            # NEW: weather alert component
│   └── VerificationModal.tsx        # NEW: moto verification flow
├── services/
│   ├── rainAlertDismiss.ts          # NEW: AsyncStorage dismiss logic
│   ├── weatherApi.ts                # NEW: API client for weather endpoint
│   ├── verificationApi.ts           # NEW: API client for verification
│   └── claveUnicaAuth.ts            # NEW: ClaveÚnica OAuth client
├── language-context.tsx             # Modified: +new i18n keys
└── theme-context.tsx                # Unchanged (amber color added to RainAlertCard locally)

packages/mobile/app/(app)/
├── index.tsx                        # Modified: +RainAlertCard section
└── motorcycle/[id]/
    └── verify.tsx                   # NEW: verification screen
```

---

## Feature 1 — Rain Alert Design

### Backend Architecture

**New files:**

| File | Purpose |
|------|---------|
| `routes/weather.ts` | Express router for weather endpoints |
| `services/weatherZone.ts` | Zone resolution: user lat/lon → comuna |
| `services/weatherCache.ts` | Cache management, lazy TTL refresh |
| `services/openWeatherMap.ts` | OpenWeatherMap API client |
| `data/chileComunas.ts` | Comuna centroid dataset (~346 rows) |

**Modified files:**

| File | Change |
|------|--------|
| `db/schema.ts` | Add weatherCache table |
| `index.ts` | Register weather routes |

**Route registration:**

```typescript
// packages/backend/src/index.ts
import weatherRoutes from './routes/weather';
app.use('/api/weather', weatherRoutes);
```

### Database Design

```typescript
// packages/backend/src/db/schema.ts
export const weatherCache = sqliteTable('weather_cache', {
  zoneId: text('zone_id').primaryKey(),
  zoneName: text('zone_name').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  data: text('data').notNull(), // JSON serialized OpenWeatherMap response
  lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

### API Design

```typescript
// packages/backend/src/routes/weather.ts
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveZone } from '../services/weatherZone';
import { getWeatherForZone } from '../services/weatherCache';
import { extractRainAlert } from '../services/openWeatherMap';
import { createErrorResponse } from '@moto-tracker/shared';

const router = Router();

router.get('/rain-alert', authenticate, async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    
    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json(createErrorResponse('INVALID_LOCATION', 'Invalid coordinates'));
      return;
    }
    
    const zone = resolveZone(lat, lon);
    if (!zone) {
      res.json({ success: true, data: { shouldShow: false, zoneName: null } });
      return;
    }
    
    const weatherData = await getWeatherForZone(zone);
    const alert = extractRainAlert(weatherData);
    
    res.json({
      success: true,
      data: {
        ...alert,
        zoneName: zone.name,
        message: alert.shouldShow ? `Lluvia en ~${alert.minutesUntilRain} min` : null,
        suggestion: alert.shouldShow ? 'Considera esperar o llevar equipo impermeable' : null,
      },
    });
  } catch (error) {
    console.error('[WEATHER] Error:', error);
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to fetch weather data'));
  }
});

export default router;
```

### Caching Strategy

**Pattern: Lazy TTL with Stale-While-Revalidate**

```
Request arrives → Check cache TTL
├── Fresh (< 10 min) → Return cached data
├── Stale (10-30 min) → Return cached data + fetch in background
└── Very stale (> 30 min) → Fetch fresh, then return
```

This avoids:
- Scheduler complexity (no node-cron, no external cron)
- Wasted API calls when nobody checks weather
- Cold start delays (always return something if cache exists)

### Frontend Architecture

**New component: RainAlertCard**

```typescript
// packages/mobile/src/components/RainAlertCard.tsx
interface RainAlertCardProps {
  minutesUntilRain: number;
  probability: number;
  zoneName?: string;
  onDismiss: () => void;
  onPress: () => void;
}

// Visual design:
// - Background: #FEF3C7 (light amber-50) / dark: #78350F (amber-900)
// - Border: #F59E0B (amber-500)
// - Icon: Ionicons "cloudy-night" or "rainy"
// - Layout: horizontal card, icon left, text center, X button right
// - Typography: title bold, subtitle smaller
// - Size: compact, similar to a notification banner
```

**Integration in Home screen:**

```typescript
// packages/mobile/app/(app)/index.tsx
// Add between DashboardPanel and TheftAlerts section:

{/* Rain Alert */}
{rainAlert && rainAlert.shouldShow && (
  <View style={styles.section}>
    <RainAlertCard
      minutesUntilRain={rainAlert.minutesUntilRain}
      probability={rainAlert.probability}
      zoneName={rainAlert.zoneName}
      onDismiss={handleDismissRainAlert}
      onPress={handleRainAlertPress}
    />
  </View>
)}
```

**Data fetching:**

```typescript
// packages/mobile/src/services/weatherApi.ts
export async function fetchRainAlert(lat: number, lon: number): Promise<RainAlertData> {
  const response = await api.get(`/weather/rain-alert?lat=${lat}&lon=${lon}`);
  return response.data.data;
}
```

**Dismiss state management:**

```typescript
// In Home screen (index.tsx)
const [rainAlert, setRainAlert] = useState<RainAlertData | null>(null);

useEffect(() => {
  loadRainAlert();
}, []);

const loadRainAlert = async () => {
  try {
    const loc = await getCurrentLocation();
    const alert = await fetchRainAlert(loc.lat, loc.lon);
    
    if (alert.shouldShow) {
      const dismissed = await isDismissed(user.id);
      if (!dismissed) {
        setRainAlert(alert);
      }
    }
  } catch (e) {
    console.log('[RAIN] Error:', e);
  }
};

const handleDismissRainAlert = async () => {
  await dismiss(user.id);
  setRainAlert(null);
};
```

---

## Feature 2 — Moto Verification Design

### Backend Architecture

**New files:**

| File | Purpose |
|------|---------|
| `services/rutValidation.ts` | RUT modulo 11 algorithm |
| `services/claveUnica.ts` | ClaveÚnica OAuth integration |
| `services/otp.ts` | OTP generation, verification, lockout |
| `services/plateValidation.ts` | Plate regex + external checks |
| `services/vehicleCheck.ts` | prt.cl + encargoporrobo scraping |
| `routes/otp.ts` | OTP endpoints |

**Modified files:**

| File | Change |
|------|--------|
| `db/schema.ts` | Add fields to users/motorcycles, new tables |
| `routes/auth.ts` | Add RUT validation, ClaveÚnica endpoints |
| `routes/motorcycles.ts` | Add verification, unlink endpoints |

### Database Design

**Users table additions:**

```typescript
rut: text('rut').unique(),
verificadoClaveunica: integer('verificado_claveunica', { mode: 'boolean' }).default(false),
identidadVerificada: integer('identidad_verificada', { mode: 'boolean' }).default(false),
otpAttempts: integer('otp_attempts').default(0),
otpLockedUntil: integer('otp_locked_until', { mode: 'timestamp' }),
```

**Motorcycles table additions:**

```typescript
verificada: integer('verificada', { mode: 'boolean' }).default(false),
verificadaEn: integer('verificada_en', { mode: 'timestamp' }),
verificadaPor: text('verificada_por'), // 'clave_unica' | 'carnet' | 'padron'
fotoConPatente: text('foto_con_patente'),
rtVigente: integer('rt_vigente', { mode: 'boolean' }),
encargoRobo: integer('encargo_robo', { mode: 'boolean' }).default(false),
desvinculada: integer('desvinculada', { mode: 'boolean' }).default(false),
```

**New tables:**

```typescript
// Pending verifications for manual review
verificacionesPendientes: {
  id, motorcycleId, userId, tipo, archivoUrl, estado, createdAt, reviewedAt, reviewerNotes
}

// OTP codes
otps: {
  id, userId, code, tipo, createdAt, expiresAt, used
}
```

### Auth Architecture

**Registration flow (Email + RUT):**

```
1. Client sends: { email, password, name, rut }
2. Backend validates RUT (modulo 11)
3. Backend checks if RUT already exists
4. If exists: return error "RUT already registered"
5. If new: create user with rut field, verificado_claveunica = false
6. Return tokens
```

**ClaveÚnica OAuth flow:**

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│ ClaveÚnica   │
│              │◀────│              │◀────│   Server     │
└─────────────┘     └──────────────┘     └──────────────┘

1. Frontend: GET /api/auth/claveunica
2. Backend: generate OAuth URL with client_id, redirect_uri, scopes (run, name, email)
3. Backend → Frontend: { authUrl }
4. Frontend: open authUrl in WebView/authSession
5. User authenticates with ClaveÚnica
6. ClaveÚnica → Backend: GET /api/auth/claveunica/callback?code=XXX
7. Backend:
   a. Exchange code for token (POST to ClaveÚnica token endpoint)
   b. Validate token signature (JWT verification)
   c. Extract: rut, name, email from token claims
   d. Check if user exists by email OR rut
   e. If exists by email (same RUT): offer account linking
   f. If exists by RUT: return existing account
   g. If new: create user, verificado_claveunica = true
8. Backend → Frontend: redirect with tokens
```

### Verification State Machine

```
                    ┌─────────────────┐
                    │   UNVERIFIED    │
                    │ verificada=false │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
     │   PENDING   │ │  REJECTED   │ │  UNLINKED   │
     │  (manual    │ │  (manual    │ │  (sold)     │
     │   review)   │ │   review)   │ │             │
     └──────┬──────┘ └──────┬──────┘ └─────────────┘
            │               │
            ▼               ▼
     ┌─────────────┐ ┌─────────────┐
     │  VERIFIED   │ │ UNVERIFIED  │
     │ verificada=true│ │ (retry)     │
     └─────────────┘ └─────────────┘
```

**State transitions:**

| From | To | Trigger |
|------|-----|---------|
| UNVERIFIED | VERIFIED | Auto-verification (ClaveÚnica + padrón match, or email + carnet match) |
| UNVERIFIED | PENDING | Manual review needed (third-party moto, mismatch) |
| PENDING | VERIFIED | Admin approves |
| PENDING | REJECTED | Admin rejects |
| VERIFIED | UNLINKED | Owner unlinks (sold motorcycle) |

### Scraping Architecture

```typescript
// packages/backend/src/services/vehicleCheck.ts

// Pattern: fetch HTML → parse → extract relevant data → cache result
// Error handling: always return graceful fallback, never block registration

export async function checkTechnicalReview(plate: string): Promise<{
  vigente: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`https://www.prt.cl/consulta/resultado?patente=${plate}`, {
      headers: {
        'User-Agent': 'MotoTracker/1.0 (contacto@moto-tracker.cl)',
      },
    });
    
    if (!response.ok) {
      return { vigente: false, error: 'SERVICE_UNAVAILABLE' };
    }
    
    const html = await response.text();
    
    // Parse for RT status
    // This is intentionally fragile — monitor and update regex as needed
    const vigenteMatch = html.match(/(?:VIGENTE|vigente|Vigente)/);
    
    return { vigente: !!vigenteMatch };
  } catch (error) {
    console.error('[VEHICLE_CHECK] prt.cl error:', error);
    return { vigente: false, error: 'SERVICE_UNAVAILABLE' };
  }
}
```

### Frontend Architecture

**New screens/modals:**

| Screen | Purpose |
|--------|---------|
| `VerificationModal` | Step-by-step verification flow |
| `PlatePhotoPicker` | Camera/gallery for plate photo |
| `CarnetPicker` | Camera for carnet front/back |
| `SelfiePicker` | Camera for selfie with ID |

**VerificationModal flow:**

```
Step 1: Choose verification method
├── "Soy usuario ClaveÚnica" → Step 2a
└── "Tengo email y contraseña" → Step 2b

Step 2a (ClaveÚnica):
└── Upload padrón photo → Validate → Done

Step 2b (Email, first moto):
├── Upload carnet front → 
├── Upload carnet back →
├── Take selfie →
├── Upload padrón →
└── Validate all → Done

Step 2b (Email, subsequent):
└── Upload padrón photo → Validate → Done
```

**Motorcycle list status display:**

```typescript
// In motos.tsx — each motorcycle card shows:
// - Green checkmark + "Verificada" if verificada = true
// - Orange warning + "Verificar" button if verificada = false
// - Gray clock + "En revisión" if pending manual review
```

### Integration Points

**Theft reporting gate:**

```typescript
// In ActiveMotoModal or theft reporting flow:
if (!motorcycle.verificada) {
  // Show CustomAlert: "Verifica esta moto primero para poder reportar robos"
  // Button: "Verificar" → opens VerificationModal
  return;
}
// Proceed with theft reporting
```

**Registration form update:**

```typescript
// In register.tsx:
// Add RUT field after email/password
// Validate RUT client-side before submission
// Show error if RUT is invalid
```

### Error Handling Patterns

Consistent with existing backend:

```typescript
// All errors use createErrorResponse from @moto-tracker/shared
import { createErrorResponse } from '@moto-tracker/shared';

// Pattern:
res.status(4XX).json(createErrorResponse('ERROR_CODE', 'Human message'));
```

**External service errors:**

```typescript
// Scraping failures are NEVER blocking
// Always return fallback value + error string
// Log for monitoring
try {
  const result = await checkTechnicalReview(plate);
  // result.vigente may be false due to service error
  // Show warning but allow registration
} catch (error) {
  console.error('[SCRAPING] Error:', error);
  // Continue with registration, note the check failed
}
```

### Testing Strategy

**Backend unit tests:**

| Test | What to verify |
|------|---------------|
| `rutValidation.test.ts` | Modulo 11 algorithm, edge cases (K check digit, invalid formats) |
| `otp.test.ts` | Generation, verification, lockout, expiry, cooldown |
| `plateValidation.test.ts` | Old/new plate formats, normalization |
| `weatherZone.test.ts` | Zone resolution, distance calculation, rural threshold |
| `weatherCache.test.ts` | TTL logic, stale-while-revalidate |
| `openWeatherMap.test.ts` | Rain alert extraction from API response |

**Backend integration tests:**

| Test | What to verify |
|------|---------------|
| `weather.test.ts` | GET /api/weather/rain-alert end-to-end |
| `auth-extended.test.ts` | Registration with RUT, ClaveÚnica callback |
| `verification.test.ts` | Full verification flow, state transitions |

**Mocking external services:**

```typescript
// Mock OpenWeatherMap responses
// Mock prt.cl HTML responses
// Mock encargoporrobo HTML responses
// Mock ClaveÚnica token exchange
// Mock email sending (OTP)
```

### Deployment Considerations

**Environment variables needed:**

```env
# OpenWeatherMap
OPENWEATHER_API_KEY=xxx

# ClaveÚnica
CLAVEUNICA_CLIENT_ID=xxx
CLAVEUNICA_CLIENT_SECRET=xxx
CLAVEUNICA_REDIRECT_URI=https://your-app.cl/api/auth/claveunica/callback
CLAVEUNICA_BASE_URL=https://accounts.claveunica.gob.cl

# Email (OTP)
SMTP_HOST=xxx
SMTP_PORT=587
SMTP_USER=xxx
SMTP_PASS=xxx
```

**Database migrations:**

1. Create weather_cache table
2. Add columns to users table (rut, verificado_claveunica, identidad_verificada, otp fields)
3. Add columns to motorcycles table (verificada, verificada_en, verificada_por, foto_con_patente, rt_vigente, encargo_robo, desvinculada)
4. Create verificaciones_pendientes table
5. Create otps table
6. Seed chileComunas data

**Migration order matters:** Run schema changes before deploying new code to avoid runtime errors.

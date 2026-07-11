# Tasks: Rain Alerts & Moto Verification

## PR 1: Rain Alert (~400-500 lines)

### Work Unit 1.1: Weather Cache Schema + Data
**Complexity:** S
**Files:**
- CREATE: `packages/backend/src/data/chileComunas.ts`
- MODIFY: `packages/backend/src/db/schema.ts`

**Tasks:**
1. Create `chileComunas.ts` with ~346 Chilean comuna centroids (id, name, region, latitude, longitude)
2. Add `weatherCache` table to schema.ts with Drizzle ORM
3. Add index on `lastFetchedAt`

**Acceptance criteria:**
- Schema compiles without errors
- ChileComunas data exports typed array

---

### Work Unit 1.2: Weather Services
**Complexity:** M
**Files:**
- CREATE: `packages/backend/src/services/openWeatherMap.ts`
- CREATE: `packages/backend/src/services/weatherZone.ts`
- CREATE: `packages/backend/src/services/weatherCache.ts`

**Dependencies:** 1.1

**Tasks:**
1. Implement `openWeatherMap.ts`: API call to One Call 3.0, extract minutely/hourly precipitation data
2. Implement `weatherZone.ts`: resolve user lat/lon to nearest comuna (haversine, 50km threshold)
3. Implement `weatherCache.ts`: lazy TTL refresh (10 min), stale-while-revalidate pattern

**Acceptance criteria:**
- `extractRainAlert()` correctly identifies rain probability >60% within 2 hours
- Zone resolution finds nearest comuna within 50km
- Cache returns fresh data within TTL, fetches when stale

---

### Work Unit 1.3: Weather Endpoint
**Complexity:** S
**Files:**
- CREATE: `packages/backend/src/routes/weather.ts`
- MODIFY: `packages/backend/src/index.ts`

**Dependencies:** 1.2

**Tasks:**
1. Create Express router with `GET /api/weather/rain-alert` endpoint
2. Add `authenticate` middleware
3. Parse lat/lon query params, validate
4. Call zone resolution → cache → OpenWeatherMap pipeline
5. Return structured response: `{ shouldShow, minutesUntilRain, probability, message, suggestion, zoneName }`
6. Register route in index.ts

**Acceptance criteria:**
- Endpoint returns correct response for valid coordinates
- Returns `shouldShow: false` when no rain expected
- Returns 400 for invalid coordinates
- Requires authentication

---

### Work Unit 1.4: Frontend Weather Service + Dismiss
**Complexity:** S
**Files:**
- CREATE: `packages/mobile/src/services/weatherApi.ts`
- CREATE: `packages/mobile/src/services/rainAlertDismiss.ts`

**Tasks:**
1. Create API client for `GET /api/weather/rain-alert`
2. Implement AsyncStorage dismiss logic: key per user, 1-hour cooldown
3. Implement re-appear logic: if probability increases >15%, override dismiss

**Acceptance criteria:**
- `fetchRainAlert(lat, lon)` returns typed response
- `isDismissed(userId)` respects 1-hour cooldown
- `shouldShowAlert()` returns true when probability increases significantly

---

### Work Unit 1.5: RainAlertCard Component
**Complexity:** M
**Files:**
- CREATE: `packages/mobile/src/components/RainAlertCard.tsx`
- MODIFY: `packages/mobile/app/(app)/index.tsx`
- MODIFY: `packages/mobile/src/language-context.tsx`

**Dependencies:** 1.4

**Tasks:**
1. Create `RainAlertCard` component with amber/orange theme:
   - Background: light amber (#FEF3C7) / dark amber (#78350F)
   - Border: #F59E0B
   - Icon: Ionicons "cloudy-night"
   - Layout: icon + text + dismiss X button
2. Add to Home screen between DashboardPanel and TheftAlerts section
3. Add i18n keys for es/en (weatherRainAlertTitle, weatherRainAlertSubtitle, etc.)
4. Integrate dismiss logic + data fetching

**Acceptance criteria:**
- Card renders with correct amber styling
- Card shows only when `shouldShow: true`
- Dismiss button works and respects cooldown
- Light/dark theme works correctly
- Both languages display correctly

---

## PR 2: Moto Verification (~800-1200 lines)

### Work Unit 2.1: Schema Migrations
**Complexity:** M
**Files:**
- MODIFY: `packages/backend/src/db/schema.ts`

**Tasks:**
1. Add to users table: `rut`, `verificadoClaveunica`, `identidadVerificada`, `otpAttempts`, `otpLockedUntil`
2. Add to motorcycles table: `verificada`, `verificadaEn`, `verificadaPor`, `fotoConPatente`, `rtVigente`, `encargoRobo`, `desvinculada`, `desvinculadaEn`
3. Create `verificacionesPendientes` table
4. Create `otps` table
5. Add appropriate indexes

**Acceptance criteria:**
- All new columns are nullable (backward compatible)
- New tables have proper foreign keys
- Indexes on frequently queried columns

---

### Work Unit 2.2: RUT Validation
**Complexity:** S
**Files:**
- CREATE: `packages/backend/src/services/rutValidation.ts`

**Tasks:**
1. Implement `validateRut(rut: string): boolean` with modulo 11 algorithm
2. Implement `normalizeRut(rut: string): string` (remove dots, dashes, spaces, uppercase)
3. Handle edge cases: K check digit, short RUTs, invalid formats

**Acceptance criteria:**
- Valid RUTs pass (e.g., "12345678-5", "12.345.678-5", "12345678K")
- Invalid RUTs fail (wrong check digit, letters in body, too short)
- Normalization produces clean format

---

### Work Unit 2.3: OTP Service
**Complexity:** M
**Files:**
- CREATE: `packages/backend/src/services/otp.ts`
- CREATE: `packages/backend/src/routes/otp.ts`
- MODIFY: `packages/backend/src/index.ts`

**Tasks:**
1. Implement OTP generation (6 random digits)
2. Implement `sendOtp(userId, email)`: check lockout, check cooldown, generate, store, send email
3. Implement `verifyOtp(userId, code)`: check lockout, find valid OTP, verify expiry, mark used, reset attempts
4. Create Express router with `POST /api/otp/send` and `POST /api/otp/verify`
5. Add rate limiting: max 3 attempts per 10 min, 30 sec resend cooldown

**Acceptance criteria:**
- OTP expires after 5 minutes
- Lockout after 3 failed attempts (10 min)
- Resend cooldown respected
- Email sending works (mock in tests)

---

### Work Unit 2.4: ClaveÚnica OAuth
**Complexity:** L
**Files:**
- CREATE: `packages/backend/src/services/claveUnica.ts`
- MODIFY: `packages/backend/src/routes/auth.ts`

**Tasks:**
1. Implement OAuth URL generation with client_id, redirect_uri, scopes (run, name, email)
2. Implement callback handler: exchange code for token, validate JWT signature
3. Extract RUT, name, email from token claims
4. Implement account linking: if RUT matches existing email account
5. Create user with `verificadoClaveunica = true` if new
6. Add endpoints: `GET /api/auth/claveunica`, `POST /api/auth/claveunica/callback`

**Acceptance criteria:**
- OAuth flow works with ClaveÚnica test environment
- Token signature is validated (never trust URL params)
- Account linking works when RUT matches
- Existing users are not duplicated

---

### Work Unit 2.5: Registration Update (RUT)
**Complexity:** S
**Files:**
- MODIFY: `packages/backend/src/routes/auth.ts`
- MODIFY: `packages/mobile/app/(auth)/register.tsx`
- MODIFY: `packages/mobile/src/language-context.tsx`

**Tasks:**
1. Add `rut` field to registration schema (required)
2. Validate RUT server-side before creating user
3. Check if RUT already exists (return conflict error)
4. Update registration form: add RUT input field
5. Add client-side RUT validation before submission
6. Add i18n keys for RUT fields

**Acceptance criteria:**
- Registration fails with invalid RUT
- Registration fails if RUT already exists
- RUT field displays correctly in both languages
- Form validates RUT before submitting

---

### Work Unit 2.6: Plate Validation + External Checks
**Complexity:** M
**Files:**
- CREATE: `packages/backend/src/services/plateValidation.ts`
- CREATE: `packages/backend/src/services/vehicleCheck.ts`

**Tasks:**
1. Implement plate regex validation (old + new formats)
2. Implement `checkTechnicalReview(plate)`: scrape prt.cl, parse HTML for RT status
3. Implement `checkTheftHistory(plate)`: scrape encargoporrobo, parse HTML
4. Add graceful error handling: never block registration on external service failure
5. Log scraping errors for monitoring

**Acceptance criteria:**
- Both plate formats validated correctly
- prt.cl check returns `{ vigente: boolean, error?: string }`
- encargoporrobo check returns `{ encargo: boolean, error?: string }`
- External service failures are non-blocking

---

### Work Unit 2.7: Motorcycle Verification Endpoints
**Complexity:** M
**Files:**
- MODIFY: `packages/backend/src/routes/motorcycles.ts`

**Dependencies:** 2.2, 2.6

**Tasks:**
1. Add `POST /api/motorcycles/:id/verify` endpoint
2. Validate plate format, run external checks
3. For ClaveÚnica users: require padrón only
4. For email users (first moto): require padrón + carnet + selfie
5. For email users (subsequent): require padrón only
6. Update `verificada`, `verificadaEn`, `verificadaPor` fields
7. Add `GET /api/motorcycles/:id/verification-status` endpoint
8. Add `POST /api/motorcycles/:id/unlink` endpoint

**Acceptance criteria:**
- Verification works for all user types
- State transitions are correct
- Unlink works and prevents future theft reports
- Plate photo is required

---

### Work Unit 2.8: Frontend Verification Flow
**Complexity:** L
**Files:**
- CREATE: `packages/mobile/src/components/VerificationModal.tsx`
- CREATE: `packages/mobile/src/services/verificationApi.ts`
- MODIFY: `packages/mobile/app/(app)/motos.tsx`
- MODIFY: `packages/mobile/app/(app)/index.tsx`
- MODIFY: `packages/mobile/src/language-context.tsx`

**Dependencies:** 2.7

**Tasks:**
1. Create `VerificationModal` with step-by-step flow:
   - Step 1: Choose method (ClaveÚnica vs Email)
   - Step 2a: Padrón upload (ClaveÚnica path)
   - Step 2b: Carnet + selfie + padrón (Email first moto)
   - Step 2c: Padrón only (Email subsequent)
2. Create API client for verification endpoints
3. Update motorcycle list to show verification status (green check / orange warning / gray clock)
4. Gate theft reporting: if not verified, show "Verifica esta moto primero"
5. Add i18n keys for all verification strings

**Acceptance criteria:**
- Verification flow works for all paths
- Motorcycle status displays correctly
- Theft reporting is gated correctly
- All strings are translatable

---

### Work Unit 2.9: Registration Form Updates
**Complexity:** S
**Files:**
- MODIFY: `packages/mobile/app/(auth)/register.tsx`
- MODIFY: `packages/mobile/src/language-context.tsx`

**Tasks:**
1. Add RUT input field to registration form
2. Add client-side RUT validation (show error before submit)
3. Add ClaveÚnica registration button
4. Handle ClaveÚnica OAuth redirect in mobile app
5. Add i18n keys for new fields

**Acceptance criteria:**
- RUT field validates before submission
- ClaveÚnica button opens OAuth flow
- Form works in both languages

---

## Task Summary

| PR | Work Unit | Description | Complexity | Dependencies |
|----|-----------|-------------|------------|--------------|
| 1 | 1.1 | Weather cache schema + data | S | — |
| 1 | 1.2 | Weather services | M | 1.1 |
| 1 | 1.3 | Weather endpoint | S | 1.2 |
| 1 | 1.4 | Frontend weather service + dismiss | S | — |
| 1 | 1.5 | RainAlertCard component | M | 1.4 |
| 2 | 2.1 | Schema migrations | M | — |
| 2 | 2.2 | RUT validation | S | — |
| 2 | 2.3 | OTP service | M | — |
| 2 | 2.4 | ClaveÚnica OAuth | L | — |
| 2 | 2.5 | Registration update (RUT) | S | 2.2 |
| 2 | 2.6 | Plate validation + external checks | M | — |
| 2 | 2.7 | Motorcycle verification endpoints | M | 2.2, 2.6 |
| 2 | 2.8 | Frontend verification flow | L | 2.7 |
| 2 | 2.9 | Registration form updates | S | 2.5 |

**Estimated total:**
- PR 1: ~400-500 lines (5 work units)
- PR 2: ~800-1200 lines (9 work units)

**Critical path PR 1:** 1.1 → 1.2 → 1.3 → 1.5 (with 1.4 parallel)
**Critical path PR 2:** 2.1 → 2.2 → 2.7 → 2.8 (with 2.3, 2.4, 2.5, 2.6 parallel)

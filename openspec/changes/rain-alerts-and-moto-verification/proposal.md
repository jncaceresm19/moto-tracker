# Proposal: Rain Alerts & Moto Verification

## Intent

Add two high-value safety features to moto-tracker:

1. **Rain Alert Card** — Contextual weather warning on Home screen that helps riders avoid getting caught in rain (the most dangerous condition for motorcycle riding).
2. **Moto Verification System** — Identity verification per motorcycle, restricting theft reports to verified owners only, reducing false reports while minimizing registration friction.

Both features strengthen the safety ecosystem around motorcycle ownership in Chile.

## User Stories

### Feature 1 — Rain Alert

| # | As a... | I want to... | So that... |
|---|---------|-------------|------------|
| 1.1 | Rider | See a rain warning on Home when rain is likely in the next 1-2 hours | I can decide whether to wait, take waterproof gear, or delay my trip |
| 1.2 | Rider | Dismiss the rain alert | It doesn't clutter my screen when I've acknowledged it |
| 1.3 | Rider | See the alert reappear if conditions worsen | I'm informed when a "safe" window becomes risky |
| 1.4 | System | Cache weather data by geographic zone | We don't burn API credits per user |

### Feature 2 — Moto Verification

| # | As a... | I want to... | So that... |
|---|---------|-------------|------------|
| 2.1 | New user (email) | Register with email + password + RUT | I can create an account without Google |
| 2.2 | New user (ClaveÚnica) | Register via ClaveÚnica | My identity is pre-verified, less friction |
| 2.3 | Owner | Verify my motorcycle with padrón + carnet + selfie | I unlock the ability to report thefts |
| 2.4 | ClaveÚnica user | Verify my motorcycle with padrón only | My identity is already proven by ClaveÚnica |
| 2.5 | Returning verified user | Add a new motorcycle with just padrón | I don't re-verify my identity for each bike |
| 2.6 | Owner | See verification status per motorcycle | I know which bikes can report thefts |
| 2.7 | Owner | Tap "Verify this moto" to start verification | The path to verification is clear |
| 2.8 | Owner | Register a motorcycle with plate photo | The system can validate the plate visually |
| 2.9 | System | Validate Chilean license plate format | We catch typos before submission |
| 2.10 | System | Check prt.cl for technical review status | We warn about expired RT (non-blocking) |
| 2.11 | System | Check encargoporrobovehiculos.cl | We flag stolen vehicles before registration |
| 2.12 | Owner | Unlink a sold motorcycle | I'm no longer responsible for it |
| 2.13 | Owner | Register a third-party motorcycle | With authorization letter + manual review |
| 2.14 | System | Enforce 10-moto limit per user | Free tier stays within bounds |

## Scope

### In Scope

**Feature 1:**
- Backend: weather cache table, zone-based OpenWeatherMap integration, GET /api/weather/rain-alert endpoint
- Frontend: RainAlertCard component, AsyncStorage dismiss logic, i18n keys (es/en)
- Lazy TTL refresh (no cron scheduler)

**Feature 2:**
- Backend: RUT field on users, ClaveÚnica OAuth flow, OTP email system, motorcycle verification fields, plate validation, prt.cl/encargoporrobo scraping
- Frontend: Updated registration flow (RUT), ClaveÚnica login, verification modal/screen, plate photo picker, motorcycle status indicators
- Schema migrations for users and motorcycles tables
- New verificaciones_pendientes table for manual review

### Out of Scope

- Wind/temperature/other weather conditions (Feature 1)
- SMS OTP (deferred until SMS notifications are needed)
- Full OCR on carnet/selfie (deferred to manual review)
- Appeal/re-verification flow for rejected verifications
- Premium tier for >10 motorcycles
- Real-time weather push notifications (MVP is poll-based)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Weather API | OpenWeatherMap One Call 3.0 | Open-Meteo prohibits commercial use |
| Zone granularity | By comuna (~346 points) | Simple, ~$50 USD/month, covers all Chile |
| Cache strategy | Lazy TTL (10 min) | No scheduler needed, no wasted calls |
| Dismiss behavior | 1-hour cooldown, re-appear if probability increases | Balances respect for user choice with safety |
| Rain card tap | CustomAlert modal (MVP) | Minimal effort, full screen later |
| Auth: Google | Deprecated for new users, kept for existing | Don't break existing accounts |
| Verification: first moto | Full KYC (padrão + carnet + selfie) for email users | Identity must be proven once before reporting thefts |
| Verification: subsequent | Padrón only | Identity already verified |
| ClaveÚnica verification | Padrón only | ClaveÚnica already proves identity |
| OTP | Email only (mandatory for all) | Confirms contact channel; ClaveÚnica handles identity |
| Third-party moto | Manual review | Edge case, not worth automating for MVP |
| Motos limit | 10 per user (hard cap) | Clear free tier boundary |

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| ClaveÚnica OAuth integration complexity | HIGH | Allocate 2-3 days; use test environment first |
| prt.cl / encargoporrobo scraping fragility | MEDIUM | Non-blocking warnings, graceful error handling, log for monitoring |
| SQLite for OTP storage | LOW | Table with created_at + manual TTL cleanup; Redis later if needed |
| Existing Google users without RUT | MEDIUM | Don't force migration; ask RUT only when they try to verify a moto |
| OpenWeatherMap API changes | LOW | Pin API version, monitor response format |
| Verification review backlog (manual) | MEDIUM | MVP: show "pending" state, no SLA commitment yet |

## Unknowns

1. ClaveÚnica test environment availability — need to register app before implementation
2. prt.cl response format — need to inspect actual HTML/endpoint before scraping implementation
3. encargoporrobo response format — same as above
4. Exact comuna coordinates for zone mapping — need a dataset of Chilean comuna centroids
5. ClaveÚnica token validation specifics — JWT or opaque token? Need docs review

## First Slice Recommendation

**Split into 2 PRs** (these features are independent):

**PR 1: Rain Alert** (~400-500 lines)
- Backend: weather cache + endpoint
- Frontend: RainAlertCard + dismiss logic + i18n
- Can ship and provide value immediately

**PR 2: Moto Verification** (~800-1200 lines)
- Backend: auth changes + verification + OTP + scraping
- Frontend: registration updates + verification flow + motorcycle status
- Larger, more complex, benefits from PR 1 being stable first

These are independent features with no data dependencies. PR 1 is simpler and lower risk — ship it first to build confidence.

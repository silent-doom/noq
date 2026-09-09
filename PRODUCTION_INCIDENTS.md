# noQ Production Incidents & Root Cause Analysis Log

This document serves as the persistent repository of historical production bugs, user-facing regressions, architectural fixes, and diagnostic procedures for the noQ platform.

---

## 1. Digital Pass Generation & Contract Mismatch (INC-001)
- **Date**: 2026-09-09
- **Impact**: End-users scanning business QR code saw modal *"Pass could not be generated"* / *"Failed to fetch token details"* on customer mobile devices.
- **Root Cause**:
  1. In `src/app/api/token/[tokenId]/route.ts`, the `GET` endpoint returned `{ token: {...}, queueState: {...} }` without a top-level `success: true` flag and without flattening the payload into a standard `data: {...}` object.
  2. In `src/app/t/[tokenId]/page.tsx`, `fetchTokenStatus` had a strict `if (!res.ok || !json.success)` check and read `json.data`. The missing properties caused valid token fetches to be treated as failures.
  3. Dynamic route parameter resolution on client navigation (`/scan/[streamId]` -> `/book/[streamId]`) occasionally had unpopulated `params.streamId` props without `useParams()`.
- **Resolution**:
  - Unified the `GET /api/token/[tokenId]` contract to return `{ success: true, data: {...}, token: {...}, queueState: {...} }`.
  - Added robust payload fallback parsing in `TokenPassPage`: `json.data || { ...json.token, ...json.queueState }`.
  - Used `useParams()` from `next/navigation` in all dynamic check-in routes.

---

## 2. Customer Pass Voice Announcement Autoplay Blocking & Real-time Sync (INC-002)
- **Date**: 2026-09-09
- **Impact**: When the operator called a token from the dashboard, the customer's phone did not automatically speak *"Attention please. Token number X, please proceed to..."*
- **Root Cause**:
  1. **Browser Autoplay Restrictions**: Mobile Safari and Chrome block HTML5 Audio and Web Speech API if audio context has not been explicitly unlocked via a user gesture on the page.
  2. **Missing Real-Time Ably Publish**: `PATCH /api/token/[tokenId]` updated PostgreSQL status but did not invoke `publishQueueUpdate(streamId, 'TOKEN_UPDATE', ...)` to notify visitor phones in real time via Ably WebSocket.
  3. **TTS Fallback Race Condition**: When server-side `/api/tts` experienced network latency or stalled, Web Speech API fallback was delayed past the active turn window.
- **Resolution**:
  - Implemented `unlockAudioContext()` in `src/lib/audioAnnouncement.ts` which primes `AudioContext`, HTML5 Audio, and `SpeechSynthesis` on first user touch anywhere on the page.
  - Added a prominent sound enablement banner and a dedicated *"🔊 Replay Voice Announcement"* button directly on the serving state card.
  - Added `publishQueueUpdate` to `PATCH /api/token/[tokenId]` for instantaneous Ably WebSocket propagation.
  - Added automatic client-side error telemetry reporting to `POST /api/log/issue`.

---

## 3. Payment Activation & Trial Status Leakage (INC-003)
- **Date**: 2026-09-09
- **Impact**: Unregistered / unpaid businesses showed as *"Trial Active"* or unlocked in the operator dashboard.
- **Root Cause**:
  - Client state in `src/lib/subscription.ts` fell back to a default grace period when database queries returned null.
- **Resolution**:
  - Hardened subscription checks in `src/lib/subscription.ts` to strictly require valid `subscription_payments` or verified `trial_registrations` before granting active status.

---

## 4. Superadmin Revenue Display Discrepancy (INC-004)
- **Date**: 2026-09-09
- **Impact**: Superadmin dashboard showed total row counts instead of actual verified Razorpay rupee revenue.
- **Root Cause**:
  - `src/app/superadmin/page.tsx` counted table items instead of summing `amount_paid` / `amount_inr` from completed transactions.
- **Resolution**:
  - Updated Superadmin aggregation query to sum `SUM(amount)` where `status = 'captured'` or `payment_status = 'PAID'`.

---

## 5. SMS Gateway Removal & Migration to Zero-Cost Alternatives (INC-005)
- **Date**: 2026-09-09
- **Impact**: Removing dependency on expensive, unreliable SMS telecom aggregators.
- **Resolution**:
  - Deprecated SMS references in favor of Web Audio chimes, Web Speech neural TTS, WebSockets (Ably), and Native Web Push notifications (`/sw.js`).

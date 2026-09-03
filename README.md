# noQ — Intelligent Multi-Domain Virtual Queue Engine

> **Live Production App**: [https://noq-serve.vercel.app/](https://noq-serve.vercel.app/)  
> **📖 Complete Layman User Guide & Feature Documentation**: [FEATURE_LIST.md](file:///Users/faizanchoudhary/Documents/noq/FEATURE_LIST.md)

> **noQ** is an enterprise-grade virtual queue management platform that replaces physical waiting lines with live digital passes, native lock-screen Web Push alerts, Android SIM SMS dispatch, Ably real-time Pub/Sub, multi-branch clinic linkage & transfers, TV voice announcements, and dynamic domain adaptation across Clinics, Restaurants, Salons, and Retail.

---

## ⚡ Key Features

- **🔐 Universal Operator Login & Zero Stream ID Friction (`/login`)**: Doctors and staff sign in seamlessly using either their registered Mobile Phone Number or Username alongside their 6-digit PIN or account password. Completely eliminates the need to memorize or enter 36-character Stream UUIDs.
- **🚨 Emergency STAT Clinical Call**: Dedicated operator button instantly triggers high-priority alerts across Lounge TV screens with flashing crimson modals and spoken Web Speech TTS announcements (*"Attention please: Emergency consultation in Doctor Room 1"*).
- **🏃 Patient Self-Service Pass Controls (`/t/[tokenId]`)**: Visitors can tap *"Running Late (+15m)"* to inform reception and avoid losing their turn, or self-cancel their pass to free up the queue.
- **🛡️ Brute-Force Rate Limiting**: Upstash Redis sliding-window rate limiting on `/api/auth/login`, temporarily locking out automated attacks after 5 failed attempts per 15 minutes.
- **🔒 Clinical Terminal Inactivity Auto-Lock**: 15-minute idle timer automatically obscures the Operator Dashboard with a privacy shield, requiring the 6-digit PIN to prevent unauthorized snooping at reception.
- **🛡️ Production HTTP Security Headers**: Strict security headers in `next.config.js` (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `HSTS`, `Referrer-Policy`, `Permissions-Policy`).
- **🛡️ Real-Time Password Strength Engine**: Interactive visual entropy meter (Weak → Fair → Strong → Very Strong) with live criteria chips in onboarding, preventing insecure business passwords.
- **🗄️ Database-Backed Super Admin Vault (`platform_config`)**: Cryptographic master key verification dynamically sourced from PostgreSQL rather than hardcoded fallbacks, with founder governance controls at `/superadmin`.
- **🔄 Automated Daily Queue Reset with Atomic Numbering**: Automatically resets and archives active queues daily at a safe 4:00 AM threshold. Guarantees perfect token numbering starting at #1 every day using a race-condition-free atomic stream counter.
- **🚀 Zero-Latency Dashboard Operations**: Advanced "Call Next" operations using highly optimized CTE (Common Table Expression) SQL combined with non-blocking Ably Websockets to instantly advance multi-station queues without freezing the UI.
- **📱 Responsive Mobile Operator Interface**: Mobile-first alignment and overflow-free design for the operator dashboard, including full mobile responsiveness for pending customer reschedule requests and token action controls.
- **📱 Zero-App Lock-Screen Digital Pass**: Customers scan on-site QR codes or book remotely to track live queue positions, spots ahead, dynamic ETAs, and assigned room/station in real-time (`/t/[tokenId]`).
- **🏥 Multi-Branch Clinic Linkage & Patient Transfer**: Link separately onboarded clinics of the same doctor/business (e.g. Mumbai & Navi Mumbai) using secure stream IDs and PINs. Switch active branch queues in 1 tap and transfer patients seamlessly across clinics with automatic live pass and SMS updates.
- **⚡ Parallel Multi-Doctor & Multi-Station Queueing**: Supports concurrent consultations across multiple rooms/tables in parallel without cross-cancelling active sessions.
- **🔒 Security & PII Protection**: Automatic customer phone number and PII masking on public APIs (`+91 •••••• 4512`) and cryptographic session token verification for operator controls.
- **🎛️ Tactile NumberSlider Pickers**: Interactive, smooth gradient drag sliders with quick-select preset pills and tactile stepper buttons for onboarding and pace configuration.
- **👓 Accessibility & Screen-Reader Optimization**: Complete `aria-live` queue announcements, semantic roles, High Contrast theme, and Large Typography modes.
- **📲 httpSMS Android SIM Cellular Gateway**: Dispatches real SMS text messages directly from an Android phone SIM card at local plan rates.
- **⚡ Ably Real-Time Pub/Sub Synchronization**: Zero-polling, sub-millisecond state updates across Operator Dashboards, Customer Passes, and TV Screens.
- **🔔 Native Web Push Notifications (VAPID Service Worker)**: Sends OS lock-screen push alerts to iOS (Safari 16.4+) and Android devices when a customer's turn is called.
- **🔊 Neural Multi-Language Female Voice Engine & Audio Chime (`/api/tts`)**: Synthesizes a crisp airport/clinical dual-tone bell chime (G5 → C6 via Web Audio API) followed by studio-quality neural female voice announcements in **Hindi (`🇮🇳 हिन्दी`)**, **English (`🇬🇧 English`)**, or **Bilingual (`🌐 EN+HI`)** calling out the token number and assigned room/station (*"कृपया ध्यान दें। टोकन नंबर 15, कृपया डॉक्टर रूम 2 पर जाएं"*), active across both Lounge TV Displays and the Operator Dashboard with instant test controls and mute toggles.
- **🏢 Physical Layout & Station Customization**: Configures physical rooms, beds, chairs, and counters during onboarding and extrapolates them to the Operator Dashboard.
- **🖨️ Printable QR Code Poster Generator**: Generates print-ready A4 venue posters (`/dashboard/poster`) with high-resolution venue QR codes.
- **📅 Slot-Based Advance Booking**: Supports both *"⚡ Join Live Queue"* and *"📅 Advance Time Slot"* booking (`10:00 AM`, `10:30 AM`, `11:00 AM`, etc.).
- **📥 Operations Analytics & CSV Data Export**: Downloads structured CSV queue reports, peak traffic hourly heatmaps, customer feedback scores, and channel breakdowns.
- **🏷️ Dynamic Domain Terminology Adapter**: Automatically adapts UI vocabulary based on business category:
  - **Clinics & Healthcare**: Patients, Doctor / Specialist, Consultation Pace, OPD Queue, Doctor Rooms, Exam Beds.
  - **Restaurants & Hotels**: Diners / Guests, Table / Server, Table Turn Pace, Dining Waiting List, Host Desks.
  - **Salons & Spas**: Clients, Stylist / Specialist, Service Duration, Styling Queue, Stylist Chairs, Wash Stations.
  - **Retail & Banking**: Customers, Service Counter, Service Pace, Main Queue, Service Counters.
- **🛡️ Soft-Delete Data Preservation & Instant Reactivation**: Overdue accounts undergo a non-destructive soft delete. Zero tokens, analytics, or stream records are permanently deleted, allowing businesses to reactivate seamlessly with their exact original QR links and customer history upon subscription renewal.
- **🚫 Multi-Factor Trial Abuse Prevention**: Restricts trial access via dual-factor verification (normalized phone and client network IP registry), blocking repeated trial redemptions.
- **📜 Complete Legal & Healthcare Compliance Suite (`/terms`, `/privacy`, `/mou`)**: Dedicated Terms & Conditions, Privacy Policy with public PII redaction, and an official Doctor & Polyclinic Memorandum of Understanding (MoU) with non-clinical boundary definitions and signable blocks.
- **🔤 Dynamic Singular/Plural Grammar Engine**: Real-time grammatical inflection on sliders and configuration forms (e.g. `1 Room` vs `2 Rooms`, `1 Bed` vs `2 Beds`, `1 Counter` vs `3 Counters`).
- **🛡️ Super Admin Platform Governance (`/superadmin`)**: Master dashboard for platform founders to oversee tenant lifecycle, database storage allocation per tenant, and administrative status management with strict PII security.
- **📢 Real-Time Broadcast Tickers**: Push live delay alerts or announcements across all connected customer passes and displays.
- **📺 Lounge TV Display Board**: Full-screen TV display (`/display/[streamId]`) showing active serving tokens in a Multi-Station grid, station banners, and upcoming waitlists.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router), React 19, TypeScript
- **Styling**: Vanilla CSS, Glassmorphic Dark Theme, Lucide Icons
- **Database**: PostgreSQL (Supabase / Neon) with connection pooling
- **Cache & Messaging**: Upstash Serverless Redis & Ably Realtime Pub/Sub
- **Push & SMS**: Service Worker Web Push (VAPID), httpSMS Android SIM Gateway
- **Deployment**: Vercel / Render / Netlify

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/silent-doom/noq.git
cd noq
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env.local` file in the root directory (refer to `.env.example`):

```env
# Database Connection (Supabase / Neon)
DATABASE_URL="postgresql://user:password@host:5432/postgres"

# Upstash Redis Connection
UPSTASH_REDIS_REST_URL="https://your-upstash-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Ably Realtime Key
NEXT_PUBLIC_ABLY_SUBSCRIBE_KEY="your-ably-key"

# httpSMS Android Gateway Credentials
HTTPSMS_API_KEY="your-httpsms-api-key"
HTTPSMS_FROM_NUMBER="+917827369050"

# Web Push VAPID Keypair
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"
VAPID_SUBJECT="mailto:support@noq-serve.vercel.app"

# App Base URL
NEXT_PUBLIC_APP_URL="https://noq-serve.vercel.app"
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to access the SaaS landing page and operator terminal.

---

## 📁 Project Structure

```
noq/
├── public/
│   └── sw.js                            # Background Web Push Service Worker
├── src/
│   ├── app/
│   │   ├── page.tsx                     # SaaS Landing Page & Onboarding
│   │   ├── login/                       # Business Operator Login Page (Cross-Device)
│   │   ├── signup/                      # Full Business Registration & Auth Setup
│   │   ├── dashboard/                   # Operator Terminal, Multi-Branch & Stations
│   │   │   ├── analytics/               # CSV Export & Peak Traffic Heatmaps
│   │   │   ├── poster/                  # Printable Venue QR Code Poster View
│   │   │   └── waitlist/                # Smart Waitlist & Skipped Guest Recall
│   │   ├── display/[streamId]/          # Lounge TV Screen with Voice TTS & Station Grid
│   │   ├── book/[streamId]/             # Remote Customer Booking & Time Slots
│   │   ├── scan/[streamId]/             # On-Site QR Landing & Digital Pass Issuer
│   │   ├── t/[tokenId]/                 # Live Mobile Customer Pass & Feedback
│   │   └── api/
│   │       ├── auth/login/              # Business Login & Session Issuer
│   │       ├── auth/signup/             # Business Signup with Credential Hashing
│   │       ├── admin/verify/            # PIN Verification & Session Token Generator
│   │       ├── branch/link/             # Multi-Clinic Networking API
│   │       ├── branch/transfer/         # Cross-Branch Patient Transfer API
│   │       ├── business/register/       # Business Onboarding & Station Generator
│   │       ├── queue/stream/            # Live Queue State & PII Masking
│   │       ├── queue/stream/[id]/next   # Parallel Token Calling with Counter Isolation
│   │       ├── queue/stream/[id]/reset  # Daily Queue Reset API (Opening Buffer)
│   │       ├── tts/                     # Studio Neural Female Voice Stream API (Hindi/English)
│   │       ├── token/[tokenId]/         # Token Live Pass, Status & Feedback
│   │       └── push/subscribe/          # Web Push VAPID Subscription
│   ├── components/
│   │   ├── AccessChannelBadge.tsx       # Channel Origin Badges
│   │   └── NumberSlider.tsx             # Tactile Gradient Drag Number Slider
│   └── lib/
│       ├── ably.ts                      # Ably Pub/Sub Real-Time Engine
│       ├── audioAnnouncement.ts         # Dual-Tone Chime & Multi-Language Voice Engine
│       ├── db.ts                        # PostgreSQL Connection Pool
│       ├── domain.ts                    # Dynamic Domain Lexicon, PII Masking & Auth
│       ├── httpsms.ts                   # httpSMS Android Gateway Client
│       └── push.ts                      # Web Push VAPID Payload Dispatcher
```

---

## 🔒 Security & Privacy

- **Masked PII**: Public endpoints automatically redact customer phone numbers to prevent scraping.
- **Admin Session Token**: Verified PIN authentication issues an HMAC-signed session token for privileged operations.
- **Branch Security**: Inter-clinic linking requires destination admin PIN verification.

---

## 📄 License
MIT © noQ Virtual Queue Systems

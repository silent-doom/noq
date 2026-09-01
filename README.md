# noQ — Intelligent Multi-Domain Virtual Queue Engine

> **Live Production App**: [https://noq-serve.vercel.app/](https://noq-serve.vercel.app/)  
> **📖 Complete Layman User Guide & Feature Documentation**: [FEATURE_LIST.md](file:///Users/faizanchoudhary/Documents/noq/FEATURE_LIST.md)

> **noQ** is an enterprise-grade virtual queue management platform that replaces physical waiting lines with live digital passes, native lock-screen Web Push alerts, Android SIM SMS dispatch, Ably real-time Pub/Sub, multi-branch clinic linkage & transfers, TV voice announcements, and dynamic domain adaptation across Clinics, Restaurants, Salons, and Retail.

---

## ⚡ Key Features

- **🔐 Business Account Auth & Cross-Device Operator Access (`/login` & `/signup`)**: Onboard businesses with unique usernames and encrypted passwords. Operators can securely sign in from any secondary phone, tablet, or desktop to access their dashboard without memorizing long stream UUIDs.
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
- **🔊 Text-to-Speech (TTS) Voice Announcements**: Web Speech API audio announcements on Lounge TV Displays (*"Attention please. Token #15 proceed to Doctor Room 2"*).
- **🏢 Physical Layout & Station Customization**: Configures physical rooms, beds, chairs, and counters during onboarding and extrapolates them to the Operator Dashboard.
- **🖨️ Printable QR Code Poster Generator**: Generates print-ready A4 venue posters (`/dashboard/poster`) with high-resolution venue QR codes.
- **📅 Slot-Based Advance Booking**: Supports both *"⚡ Join Live Queue"* and *"📅 Advance Time Slot"* booking (`10:00 AM`, `10:30 AM`, `11:00 AM`, etc.).
- **📥 Operations Analytics & CSV Data Export**: Downloads structured CSV queue reports, peak traffic hourly heatmaps, customer feedback scores, and channel breakdowns.
- **🏷️ Dynamic Domain Terminology Adapter**: Automatically adapts UI vocabulary based on business category:
  - **Clinics & Healthcare**: Patients, Doctor / Specialist, Consultation Pace, OPD Queue, Doctor Rooms, Exam Beds.
  - **Restaurants & Hotels**: Diners / Guests, Table / Server, Table Turn Pace, Dining Waiting List, Host Desks.
  - **Salons & Spas**: Clients, Stylist / Specialist, Service Duration, Styling Queue, Stylist Chairs, Wash Stations.
  - **Retail & Banking**: Customers, Service Counter, Service Pace, Main Queue, Service Counters.
- **💳 Subscription Monetization & Grace Lock Policy**: Automated monthly billing anchored to registration day ($X$). Features 3-day grace period, interactive terminal lock screen with instant renewal checkout, and 10-day storage data retention purges.
- **🛡️ Super Admin Platform Governance & Storage Extraction (`/superadmin`)**: Master dashboard for founders to monitor MRR, total platform revenue, tenant statuses, PostgreSQL storage consumption in KB/MB per client, and execute administrative grace extensions or storage purges with strict PII security.
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
│   │       ├── queue/stream/[id]/reset  # Daily Queue Reset API (Opening Buffer)
│   │       ├── queue/next/              # Scoped Parallel Next Token Calling
│   │       ├── token/[tokenId]/         # Token Live Pass, Status & Feedback
│   │       └── push/subscribe/          # Web Push VAPID Subscription
│   ├── components/
│   │   ├── AccessChannelBadge.tsx       # Channel Origin Badges
│   │   └── NumberSlider.tsx             # Tactile Gradient Drag Number Slider
│   └── lib/
│       ├── ably.ts                      # Ably Pub/Sub Real-Time Engine
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

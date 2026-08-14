# noQ — Intelligent Multi-Domain Virtual Queue Engine

> **noQ** is an enterprise-grade virtual queue management platform that replaces physical waiting lines with live digital passes, native lock-screen Web Push alerts, Android SIM SMS dispatch, Ably real-time Pub/Sub, TV voice announcements, and dynamic domain adaptation across Clinics, Restaurants, Salons, and Retail.

---

## ⚡ Key Features

- **📱 Zero-App Lock-Screen Digital Pass**: Customers scan on-site QR codes or book remotely to track live queue positions, spots ahead, and dynamic ETAs in real-time.
- **📲 httpSMS Android SIM Cellular Gateway**: Dispatches real SMS text messages directly from an Android phone SIM card at local plan rates.
- **⚡ Ably Real-Time Pub/Sub Synchronization**: Zero-polling, sub-millisecond state updates across Operator Dashboards, Customer Passes, and TV Screens.
- **🔔 Native Web Push Notifications (VAPID Service Worker)**: Sends OS lock-screen push alerts to iOS (Safari 16.4+) and Android devices when a customer's turn is called.
- **🔊 Text-to-Speech (TTS) Voice Announcements**: Web Speech API audio announcements on Lounge TV Displays (*"Attention please. Token #15 proceed to Counter 1"*).
- **🏢 Physical Layout & Station Customization**: Configures physical rooms, beds, chairs, and counters during onboarding and extrapolates them to the Operator Dashboard.
- **🖨️ Printable QR Code Poster Generator**: Generates print-ready A4 venue posters (`/dashboard/poster`) with high-resolution venue QR codes.
- **📅 Slot-Based Advance Booking**: Supports both *"⚡ Join Live Queue"* and *"📅 Advance Time Slot"* booking (`10:00 AM`, `10:30 AM`, `11:00 AM`, etc.).
- **📥 Operations Analytics & CSV Data Export**: Downloads structured CSV queue reports, peak traffic hourly heatmaps, customer feedback scores, and channel breakdowns.
- **🔒 Admin Security PIN Protection**: Password-protected operator terminals (`123456`) and secure verification API (`/api/admin/verify`).
- **🏷️ Dynamic Domain Terminology Adapter**: Automatically adapts UI vocabulary based on business category:
  - **Clinics & Healthcare**: Patients, Doctor / Specialist, Consultation Pace, OPD Queue, Doctor Rooms, Exam Beds.
  - **Restaurants & Hotels**: Diners / Guests, Table / Server, Table Turn Pace, Dining Waiting List, Host Desks.
  - **Salons & Spas**: Clients, Stylist / Specialist, Service Duration, Styling Queue, Stylist Chairs, Wash Stations.
  - **Retail & Banking**: Customers, Service Counter, Service Pace, Main Queue, Service Counters.
- **📢 Real-Time Broadcast Tickers**: Push live delay alerts or announcements across all connected customer passes and displays.
- **📺 Lounge TV Display Board**: Full-screen TV display (`/display/[streamId]`) showing active serving tokens, station banners, and upcoming waitlists.

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
VAPID_SUBJECT="mailto:support@noq.app"

# App Base URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
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
│   │   ├── page.tsx                     # SaaS Landing Page & Station Setup Modal
│   │   ├── dashboard/                   # Operator Terminal & Multi-Counter Controls
│   │   │   ├── analytics/               # CSV Export & Peak Traffic Heatmaps
│   │   │   ├── poster/                  # Printable Venue QR Code Poster View
│   │   │   └── waitlist/                # Skipped Guests Re-insertion Queue
│   │   ├── display/[streamId]/          # Lounge TV Display Screen with Voice TTS
│   │   ├── scan/[streamId]/             # On-Site QR Check-In Entry Page
│   │   ├── book/[streamId]/             # Remote Queueing & Slot Booking Page
│   │   ├── t/[tokenId]/                 # Customer Pass, Web Push & Audio Chime
│   │   └── api/                         # API Endpoints (Push, SMS, Queue, Tokens, Analytics)
│   ├── components/                      # UI Badges, Serving Headers, & Terminology Badges
│   └── lib/                             # DB Pool, Redis Client, Ably, httpSMS, WebPush, Domain Adapter
├── .env.example                         # Environment Variables Template
└── README.md                            # Documentation
```

---

## 🌐 Deploying to Vercel

1. Push your repository to **GitHub**.
2. Connect your repository to **[Vercel](https://vercel.com)**.
3. Configure Environment Variables (`DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_ABLY_SUBSCRIBE_KEY`, `HTTPSMS_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_APP_URL`).
4. Click **Deploy**.

---

## 📄 License

This project is licensed under the MIT License.

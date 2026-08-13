# noQ — Intelligent Multi-Domain Virtual Queue Engine

> **noQ** is an enterprise-grade virtual queue management platform that replaces physical waiting lines with live digital passes, messaging integration, and dynamic domain adaptation across Clinics, Restaurants, Salons, and Retail.

---

## ⚡ Features

- **📱 Zero App Download Digital Pass**: Customers scan on-site QR codes or use web links to track live queue positions, spots ahead, and dynamic ETAs in real-time.
- **🔒 Admin Security PIN Protection**: Password-protected operator terminals and secure authentication API (`/api/admin/verify`).
- **🏷️ Dynamic Domain Terminology Adapter**: Automatically adapts UI vocabulary based on business category:
  - **Clinics & Healthcare**: Patients, Doctor / Specialist, Consultation Pace, OPD Queue.
  - **Restaurants & Hotels**: Diners / Guests, Table / Server, Table Turn Pace, Dining Waiting List.
  - **Salons & Spas**: Clients, Stylist / Specialist, Service Duration, Styling Queue.
  - **Retail & Banking**: Customers, Service Counter, Service Pace, Main Queue.
- **💬 WhatsApp & SMS Integration**: Automated token reservation webhooks and turn notification alerts.
- **📢 Real-Time Broadcast Announcements**: Operators can push live delay alerts or announcements across Dashboard, Customer Passes, Booking pages, and TV Screens.
- **📺 Lounge TV Display Board**: Dedicated full-screen TV queue view for waiting rooms showing current serving numbers and upcoming waitlists.
- **⭐ Post-Service Ratings & Feedback**: Completed customers leave 5-star ratings and reviews directly on their pass.
- **📊 Operations Analytics & Weekly Reports**: Detailed throughput breakdown, access channel statistics, peak traffic distribution, and printable admin reports.
- **🚀 Self-Onboarding Landing Page**: SaaS pitch landing page (`/`) with domain previews and 60-second business registration.

---

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router), React 19, TypeScript
- **Styling**: TailwindCSS, Glassmorphism UI, Lucide Icons
- **Database**: PostgreSQL (Supabase / Neon) with connection pooling
- **Cache & Messaging**: Upstash Serverless Redis
- **Deployment**: Vercel / Render / Netlify

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/noq.git
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
├── src/
│   ├── app/
│   │   ├── page.tsx                     # SaaS Pitch & Self-Registration Landing Page
│   │   ├── dashboard/                   # Operator Terminal & Analytics Views
│   │   ├── display/[streamId]/          # Lounge TV Display Screen
│   │   ├── t/[tokenId]/                 # Customer Digital Pass & Rating Form
│   │   ├── book/[streamId]/             # Remote Booking Page
│   │   └── api/                         # Next.js API Routes (Tokens, Queue, Admin, Feedback)
│   ├── components/                      # Reusable UI Badges & Headers
│   └── lib/                             # DB Pool, Redis Client, Domain Adapter, Notifications
├── .env.example                         # Environment Variables Template
├── .gitignore                           # Git Exclusions File
└── README.md                            # Documentation
```

---

## 🌐 Deploying to Vercel

1. Push your repository to **GitHub**.
2. Connect your repository to **[Vercel](https://vercel.com)**.
3. Configure Environment Variables (`DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_APP_URL`).
4. Click **Deploy**.

---

## 📄 License

This project is licensed under the MIT License.

'use client';

import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#07080a] text-white font-sans selection:bg-emerald-500 selection:text-black">
      {/* Header */}
      <header className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between border-b border-zinc-900">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-3xl font-black tracking-tight text-white group-hover:text-emerald-400 transition">
            noQ
          </span>
          <span className="text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-700">
            PRIVACY
          </span>
        </Link>
        <div className="flex items-center gap-4 text-xs">
          <Link href="/terms" className="text-zinc-400 hover:text-white transition">
            Terms & Conditions
          </Link>
          <Link href="/mou" className="text-zinc-400 hover:text-white transition">
            Doctor MoU
          </Link>
          <Link href="/signup" className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-4 py-2 rounded-full transition">
            Create Account
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
            <span>Effective Date: September 2, 2026</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Privacy & Data Protection Policy</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            noQ is engineered from the ground up with a privacy-first mindset. This policy articulates our practices regarding the collection, safeguarding, masking, and retention of personally identifiable information (PII) for both venue operators and visiting customers.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">01.</span> Information We Collect
          </h2>
          <div className="space-y-3 text-xs text-zinc-400 leading-relaxed">
            <p>
              <strong className="text-zinc-200">A. Business Operator Information:</strong> When establishing an account, we collect the business name, operating category, business phone number, operating schedule, and salted cryptographic password hashes.
            </p>
            <p>
              <strong className="text-zinc-200">B. Queue Visitor Information:</strong> When a customer scans a venue QR code or books remotely, we collect their self-reported name, mobile contact number, and timestamp. <strong>We do not collect government identity cards, residential addresses, financial account details, or medical records.</strong>
            </p>
          </div>
        </section>

        {/* Section 2: PII Masking */}
        <section className="space-y-3 bg-zinc-900/40 border border-emerald-900/30 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">02.</span> Automatic PII Redaction & Public Masking
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            To prevent scraping, shoulder-surfing, or unauthorized lobby surveillance, noQ applies strict automated PII redaction across all public surfaces:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
              <span className="text-emerald-400 font-mono font-bold block text-[11px]">Phone Redaction</span>
              <p className="text-zinc-400">
                Customer mobile numbers are masked via cryptographic formatting across all public APIs and displays (e.g. <code className="text-emerald-400 bg-zinc-900 px-1.5 py-0.5 rounded">+91 •••••• 4512</code>).
              </p>
            </div>
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
              <span className="text-emerald-400 font-mono font-bold block text-[11px]">Lounge TV Display Board</span>
              <p className="text-zinc-400">
                Public waiting room TV screens and voice announcements display only the issued token number and abbreviated initials to protect patient identity.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Zero Data Selling */}
        <section className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">03.</span> Strict No-Sale & Confidentiality Guarantee
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            We operate as an administrative infrastructure provider, not a data broker. <strong>We do not sell, rent, monetize, or disclose visitor contact lists or patient check-in records to third-party advertisers, pharmaceutical companies, or data aggregators.</strong>
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Data entered into a venue&apos;s queue stream is strictly partitioned to that business and is accessible only by authorized personnel holding valid operator credentials.
          </p>
        </section>

        {/* Section 4: Operational Communications */}
        <section className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">04.</span> Operational Messaging & Notification Consent
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            By submitting a phone number to join an active queue, visitors provide explicit consent to receive transactional notifications (SMS text alerts, turn callouts, and queue progress updates) specifically relevant to that service visit. We do not dispatch unsolicited promotional broadcasts or spam marketing messages.
          </p>
        </section>

        {/* Section 5: Soft-Delete Data Retention */}
        <section className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">05.</span> Data Storage, Retention & Soft-Delete Policy
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Queue data is encrypted both in transit (TLS 1.3 / HTTPS) and at rest within secure PostgreSQL clusters. In accordance with our soft-delete policy, inactive or deactivated business queues retain their historical analytics, token counters, and stream configurations so that businesses can resume operations without losing their historical records. Operators may request complete administrative purging of their data by contacting platform governance.
          </p>
        </section>

        {/* Section 6: Contact */}
        <section className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">06.</span> Data Protection Inquiries
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            For questions regarding privacy compliance, data rights, or security architecture, please contact our security team at{' '}
            <a href="mailto:privacy@noq-serve.vercel.app" className="text-emerald-400 underline">
              privacy@noq-serve.vercel.app
            </a>
            .
          </p>
        </section>

        {/* Back Link */}
        <div className="pt-6 border-t border-zinc-900 flex justify-between items-center text-xs text-zinc-500">
          <Link href="/" className="text-emerald-400 hover:underline">
            ← Return to Homepage
          </Link>
          <span>© 2026 noQ Virtual Queue Systems</span>
        </div>
      </main>
    </div>
  );
}

'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#07080a] text-white font-sans selection:bg-emerald-500 selection:text-black">
      {/* Header */}
      <header className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between border-b border-zinc-900">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-3xl font-black tracking-tight text-white group-hover:text-emerald-400 transition">
            noQ
          </span>
          <span className="text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-700">
            LEGAL
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4 text-xs flex-wrap justify-end">
          <Link href="/privacy" className="hidden sm:inline-block text-zinc-400 hover:text-white transition">
            Privacy Policy
          </Link>
          <Link href="/mou" className="hidden sm:inline-block text-zinc-400 hover:text-white transition">
            Doctor MoU
          </Link>
          <Link href="/signup" className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[11px] sm:text-xs transition">
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
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Terms and Conditions of Service</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Please review these Terms and Conditions carefully prior to registering or utilizing the noQ Virtual Queue Platform. By registering an account, initiating a free trial, or accessing any operator or visitor interface, you acknowledge and agree to be bound by these provisions.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">01.</span> Acceptance & Scope of Service
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            noQ (&quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides a cloud-hosted, zero-hardware virtual queue orchestration software tailored for healthcare clinics, restaurants, salons, and retail counters. These Terms govern all interactions between noQ and registered businesses (&quot;Operator&quot;, &quot;Subscriber&quot;, &quot;You&quot;) as well as visiting public ticket holders (&quot;Customers&quot;, &quot;Patients&quot;, &quot;Guests&quot;).
          </p>
        </section>

        {/* Section 2: Payment, Refunds & Billing */}
        <section className="space-y-4 bg-zinc-900/40 border border-emerald-900/30 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">02.</span> Subscription, Billing & Refund Policy
          </h2>
          <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
            <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-1">
              <strong className="text-white block font-semibold">A. Non-Refundable Onboarding & Initial Setup Fee</strong>
              <p className="text-zinc-400">
                Any one-time setup, onboarding, or initial provisioning fee paid upon account creation is strictly non-refundable once your business terminal, database partition, and initial queue stream have been generated.
              </p>
            </div>

            <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-1">
              <strong className="text-white block font-semibold">B. Advance Monthly Billing & Zero Mid-Month Refunds</strong>
              <p className="text-zinc-400">
                Monthly recurring subscription fees are billed in advance on your monthly Anchor Day. Once a monthly billing cycle commences, no refunds, partial refunds, or prorated credits will be issued for the active month, regardless of system usage or downtime.
              </p>
            </div>

            <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-1">
              <strong className="text-white block font-semibold">C. Cancellation & Unsubscribing Policy</strong>
              <p className="text-zinc-400">
                You may unsubscribe or cancel your subscription at any time prior to your next monthly Anchor Day directly via your Operator Terminal or by contacting support. Cancellation takes effect at the conclusion of your current paid billing period; no future renewals will be processed thereafter.
              </p>
            </div>

            <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-1">
              <strong className="text-white block font-semibold">D. Pricing Adjustments & Plan Revisions</strong>
              <p className="text-zinc-400">
                Subscription pricing, feature allotments, and tier structures are subject to revision. noQ reserves the right to adjust rates upon reasonable advance notice (minimum 14 to 30 calendar days) communicated to your registered business email or phone number prior to your subsequent billing renewal.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Trial Fair Use */}
        <section className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">03.</span> 7-Day Free Trial & Abuse Prevention
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Eligible businesses may activate a single, 7-calendar-day free trial without submitting credit card details. Free trials are strictly limited to one redemption per business entity, phone number, and network/IP address.
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Attempting to circumvent this policy by repeatedly registering temporary businesses, cycling phone numbers, or leveraging dynamic IP addresses constitutes a material breach of these Terms. Accounts suspected of trial abuse will be immediately suspended with all automated access revoked.
          </p>
        </section>

        {/* Section 4: Soft Delete & Data Preservation */}
        <section className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">04.</span> Account Deactivation & Soft-Delete Data Retention
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            If payment is not settled within three (3) calendar days following the expiration of your trial or subscription grace period, terminal access will be deactivated.
          </p>
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-300">
            <strong>Data Preservation Commitment:</strong> In accordance with our soft-delete policy, your business records, historical tokens, customer logs, and stream configurations are <strong>never permanently purged</strong> during deactivation. Upon settling the outstanding subscription fee, your terminal, existing venue QR codes, and customer links will be instantly restored without data loss.
          </div>
        </section>

        {/* Section 5: Telephony & Cellular Gateway */}
        <section className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">05.</span> Telephony, SMS & Third-Party Gateways
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            noQ provides native web push alerts, Ably real-time synchronization, and integrations with Android SIM cellular gateways (httpSMS). Delivery of cellular SMS is subject to carrier availability, device connectivity, and active SIM balance. noQ is not liable for carrier-level SMS delivery delays or network outages.
          </p>
        </section>

        {/* Section 6: Limitation of Liability */}
        <section className="space-y-3 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400 font-mono text-sm">06.</span> Limitation of Liability & Medical Disclaimer
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            noQ is an administrative queue facilitation software. It does not provide medical triaging, clinical diagnosis, or emergency dispatch services. Healthcare operators remain exclusively responsible for patient care, emergency protocols, and medical decision-making. Under no circumstances shall noQ be liable for any indirect, incidental, or consequential damages arising from queue delays or network interruptions.
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

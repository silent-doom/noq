'use client';

import Link from 'next/link';

export default function DoctorMOUPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#07080a] text-white font-sans selection:bg-emerald-500 selection:text-black print:bg-white print:text-black">
      {/* Header - Hidden on Print */}
      <header className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between border-b border-zinc-900 print:hidden">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-3xl font-black tracking-tight text-white group-hover:text-emerald-400 transition">
            noQ
          </span>
          <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-800">
            HEALTHCARE MoU
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4 text-xs flex-wrap justify-end">
          <button
            onClick={handlePrint}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer text-[11px] sm:text-xs"
          >
            <span>🖨️ Print</span>
          </button>
          <Link href="/terms" className="hidden sm:inline-block text-zinc-400 hover:text-white transition">
            Terms & Conditions
          </Link>
          <Link href="/privacy" className="hidden sm:inline-block text-zinc-400 hover:text-white transition">
            Privacy Policy
          </Link>
        </div>
      </header>

      {/* Agreement Body */}
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8 print:py-4 print:px-0 print:space-y-6">
        {/* Title Header */}
        <div className="space-y-2 border-b border-zinc-800 pb-6 print:border-black print:pb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest print:text-emerald-700">
              Healthcare Practice Service Agreement
            </span>
            <span className="text-xs text-zinc-500 font-mono print:text-zinc-700">Ref: MOU-MED-2026</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight print:text-2xl">
            Memorandum of Understanding (MoU)
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm print:text-zinc-700">
            Between <strong>noQ Virtual Queue Systems</strong> and the <strong>Authorized Healthcare Practitioner / Medical Clinic</strong>
          </p>
        </div>

        {/* Preamble */}
        <div className="text-xs text-zinc-300 leading-relaxed space-y-3 print:text-black">
          <p>
            This Memorandum of Understanding (&quot;MoU&quot;) establishes the standard operating framework between <strong>noQ Virtual Queue Systems</strong> (&quot;Platform Provider&quot;) and the subscribing healthcare entity, doctor, polyclinic, diagnostic facility, or hospital OPD (&quot;Healthcare Practice&quot;).
          </p>
        </div>

        {/* Clause 1 */}
        <div className="space-y-2 bg-zinc-900/40 border border-zinc-800 p-5 rounded-2xl print:border print:border-zinc-300 print:bg-transparent">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 print:text-black">
            <span className="text-emerald-400 font-mono text-xs print:text-emerald-700">Clause 1.</span> Scope of Service & Non-Clinical Boundaries
          </h3>
          <div className="text-xs text-zinc-400 space-y-2 leading-relaxed print:text-zinc-800">
            <p>
              1.1. The Platform Provider delivers non-clinical crowd management, live digital token issuance, multi-station doctor room calling, waiting room TV voice announcements, and transactional turn alert SMS notifications.
            </p>
            <p>
              1.2. <strong>Zero Electronic Medical Records (EMR) Storage:</strong> The Platform explicitly does not store, request, or maintain clinical diagnostic notes, prescription files, lab specimens, pathology reports, or insurance claims. Patient check-in is limited strictly to name, phone number, and queue token number.
            </p>
          </div>
        </div>

        {/* Clause 2 */}
        <div className="space-y-2 bg-zinc-900/40 border border-zinc-800 p-5 rounded-2xl print:border print:border-zinc-300 print:bg-transparent">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 print:text-black">
            <span className="text-emerald-400 font-mono text-xs print:text-emerald-700">Clause 2.</span> Patient Relationship & Confidentiality
          </h3>
          <div className="text-xs text-zinc-400 space-y-2 leading-relaxed print:text-zinc-800">
            <p>
              2.1. <strong>Exclusive Practice Ownership:</strong> The Healthcare Practice retains 100% exclusive ownership of its patient relationships, consultations, and professional fees. The Platform Provider asserts zero proprietary claim over patient identities.
            </p>
            <p>
              2.2. <strong>Strict Non-Disclosure:</strong> The Platform Provider shall never sell, rent, commercialize, or share patient check-in records or contact numbers with external pharmaceutical companies, diagnostic marketing groups, or third-party advertisers.
            </p>
            <p>
              2.3. <strong>Public Masking:</strong> Patient mobile numbers are automatically masked (<code className="text-emerald-400 print:text-black">+91 •••••• 4512</code>) on all public-facing screens and interfaces to prevent lobby surveillance.
            </p>
          </div>
        </div>

        {/* Clause 3 */}
        <div className="space-y-2 bg-zinc-900/40 border border-zinc-800 p-5 rounded-2xl print:border print:border-zinc-300 print:bg-transparent">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 print:text-black">
            <span className="text-emerald-400 font-mono text-xs print:text-emerald-700">Clause 3.</span> Non-Medical Triaging & Emergency Disclaimer
          </h3>
          <div className="text-xs text-zinc-400 space-y-2 leading-relaxed print:text-zinc-800">
            <p>
              3.1. The Platform is an administrative workflow instrument and does not constitute a certified medical triage system. The software does not assess patient clinical acuity, severity of illness, or urgency of consultation.
            </p>
            <p>
              3.2. <strong>Emergency Protocols:</strong> In the event of an acute medical emergency, chest pain, shortness of breath, trauma, or critical deterioration, the Healthcare Practice&apos;s medical personnel must immediately override the virtual queue and execute their independent clinical protocols.
            </p>
          </div>
        </div>

        {/* Clause 4 */}
        <div className="space-y-2 bg-zinc-900/40 border border-zinc-800 p-5 rounded-2xl print:border print:border-zinc-300 print:bg-transparent">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 print:text-black">
            <span className="text-emerald-400 font-mono text-xs print:text-emerald-700">Clause 4.</span> Technical Infrastructure & Gateways
          </h3>
          <div className="text-xs text-zinc-400 space-y-2 leading-relaxed print:text-zinc-800">
            <p>
              4.1. The Healthcare Practice is responsible for maintaining reliable internet connectivity and terminal hardware (e.g. tablet, phone, PC) at the reception counter.
            </p>
            <p>
              4.2. For cellular SMS dispatch via local carrier rates, the Healthcare Practice may optionally link an on-premise Android cellular phone running the httpSMS gateway application with an active local SIM balance.
            </p>
          </div>
        </div>

        {/* Clause 5 */}
        <div className="space-y-2 bg-zinc-900/40 border border-zinc-800 p-5 rounded-2xl print:border print:border-zinc-300 print:bg-transparent">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 print:text-black">
            <span className="text-emerald-400 font-mono text-xs print:text-emerald-700">Clause 5.</span> Financial Terms, Data Soft-Delete & Continuity
          </h3>
          <div className="text-xs text-zinc-400 space-y-2 leading-relaxed print:text-zinc-800">
            <p>
              5.1. The initial setup and monthly recurring service fee cover unlimited patient ticketing, parallel calling across rooms, and TV screen streaming. All monthly fees are charged in advance and are non-refundable once the billing cycle begins.
            </p>
            <p>
              5.2. <strong>Soft-Delete Protection:</strong> In the event of account deactivation or billing delays, historical patient token logs and clinic configurations are safely preserved in our database. Settling subscription arrears instantly restores live clinic queue operations with identical QR links.
            </p>
          </div>
        </div>

        {/* Formal Signature Blocks */}
        <div className="pt-8 border-t border-zinc-800 print:border-black space-y-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 print:text-black">
            In Witness Whereof, the parties hereto have executed this Memorandum of Understanding:
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs pt-4">
            {/* Practice Block */}
            <div className="border border-zinc-800 p-4 rounded-2xl space-y-4 print:border-black">
              <span className="text-emerald-400 font-mono font-bold block text-[11px] print:text-emerald-800">
                FOR THE HEALTHCARE PRACTICE / CLINIC:
              </span>
              <div className="space-y-3 text-zinc-400 print:text-black">
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 block">Clinic / Hospital Name:</span>
                  <div className="border-b border-zinc-700 print:border-black h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 block">Doctor / Authorized Signatory Name:</span>
                  <div className="border-b border-zinc-700 print:border-black h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 block">Medical Registration / License No:</span>
                  <div className="border-b border-zinc-700 print:border-black h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 block">Signature & Official Stamp:</span>
                  <div className="border-b border-zinc-700 print:border-black h-12" />
                </div>
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 block">Date:</span>
                  <div className="border-b border-zinc-700 print:border-black h-6" />
                </div>
              </div>
            </div>

            {/* Platform Block */}
            <div className="border border-zinc-800 p-4 rounded-2xl space-y-4 print:border-black">
              <span className="text-emerald-400 font-mono font-bold block text-[11px] print:text-emerald-800">
                FOR noQ VIRTUAL QUEUE SYSTEMS:
              </span>
              <div className="space-y-3 text-zinc-400 print:text-black">
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 block">Authorized Representative:</span>
                  <p className="font-bold text-white print:text-black mt-1">noQ Operations & Legal Team</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 block">Entity:</span>
                  <p className="font-medium text-zinc-300 print:text-black mt-1">noQ Virtual Queue Engine</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 block">Digital Verification:</span>
                  <p className="font-mono text-emerald-400 print:text-emerald-800 mt-1">CRYPTOGRAPHICALLY VERIFIED</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 block">Signature:</span>
                  <div className="border-b border-zinc-700 print:border-black h-12 flex items-center">
                    <span className="font-mono text-xs text-zinc-500 italic">Signed electronically via noQ Platform Engine</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-zinc-500 block">Date:</span>
                  <p className="font-mono text-zinc-300 print:text-black mt-1">September 2, 2026</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="pt-6 border-t border-zinc-900 flex justify-between items-center text-xs text-zinc-500 print:hidden">
          <Link href="/" className="text-emerald-400 hover:underline">
            ← Return to Homepage
          </Link>
          <span>© 2026 noQ Virtual Queue Systems</span>
        </div>
      </main>
    </div>
  );
}

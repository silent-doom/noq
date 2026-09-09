'use client';

import { useState } from 'react';
import { Phone, MessageSquare, AlertCircle, HelpCircle, X, CheckCircle2, ShieldAlert, Send } from 'lucide-react';

interface SupportHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  source?: 'BUSINESS' | 'CUSTOMER' | 'OPERATOR';
  businessId?: string;
  businessName?: string;
  streamId?: string;
  tokenId?: string;
}

const FAQ_ITEMS = [
  {
    q: 'How do live voice & sound announcements work?',
    a: 'When an operator advances the queue or calls a token, noQ triggers dual-tone airport chimes and natural bilingual voice announcements (English & Hindi) on both the Lounge TV display and the visitor’s mobile device. Visitors should tap "Enable Sound" on their pass to pre-warm browser audio.',
  },
  {
    q: 'What is the pricing model for noQ?',
    a: 'Pricing is simple and transparent: ₹1,499 one-time setup fee (which includes your full first month of service), followed by ₹499/month renewal fee. There are no hidden per-token costs or per-SMS surcharges.',
  },
  {
    q: 'What happens if a customer misses their turn?',
    a: 'Operators can place the visitor on hold by clicking "Waitlist / Hold". When the visitor arrives, the operator uses "Fair Re-insertion" to place them back into the queue 2 spots behind the currently serving token, preserving queue fairness for other patients.',
  },
  {
    q: 'How do I download and print the high-resolution QR Poster?',
    a: 'Go to the Operator Dashboard, open the sidebar, and click "QR Poster Print". You can download a high-resolution 300 DPI vector poster with your clinic name and instructions for immediate reception display.',
  },
  {
    q: 'What if the internet drops at our clinic?',
    a: 'noQ features automated fallback polling (every 10s) and local state resilience. Even if WebSockets reconnect momentarily, active token counts and waitlist orders are continuously synced with PostgreSQL.',
  },
];

export default function SupportHelpModal({
  isOpen,
  onClose,
  source = 'BUSINESS',
  businessId,
  businessName,
  streamId,
  tokenId,
}: SupportHelpModalProps) {
  const [activeTab, setActiveTab] = useState<'FAQ' | 'HOTLINE' | 'REPORT'>('FAQ');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<'AUDIO_ALERT' | 'QR_SCAN' | 'BILLING' | 'HARDWARE_TV' | 'URGENT_BUG' | 'OTHER'>('URGENT_BUG');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !subject.trim() || !description.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: name.trim(),
          contactPhone: phone.trim(),
          category,
          subject: subject.trim(),
          description: description.trim(),
          source,
          businessId,
          businessName,
          streamId,
          tokenId,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSubmittedTicket(json.ticket);
      } else {
        alert(json.error || 'Failed to submit issue report');
      }
    } catch (err) {
      console.error('Error submitting support ticket:', err);
      alert('Network error submitting ticket. Please use the direct hotline numbers.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Help, FAQ & Maintainer Hotline</h2>
              <p className="text-xs text-zinc-400">Direct technical assistance for {businessName || 'noQ Queue Engine'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/30 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('FAQ')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 ${
              activeTab === 'FAQ'
                ? 'border-emerald-500 text-emerald-400 bg-zinc-900/80'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Frequently Asked Questions
          </button>
          <button
            onClick={() => setActiveTab('HOTLINE')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 ${
              activeTab === 'HOTLINE'
                ? 'border-emerald-500 text-emerald-400 bg-zinc-900/80'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Direct Maintainer Hotline
          </button>
          <button
            onClick={() => setActiveTab('REPORT')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 ${
              activeTab === 'REPORT'
                ? 'border-emerald-500 text-emerald-400 bg-zinc-900/80'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Report an Issue / Bug
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-zinc-300">
          {activeTab === 'FAQ' && (
            <div className="space-y-4">
              {FAQ_ITEMS.map((item, idx) => (
                <div key={idx} className="bg-zinc-900/60 border border-zinc-800/80 p-4 rounded-2xl space-y-1.5">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="text-emerald-400 font-mono">Q{idx + 1}.</span> {item.q}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'HOTLINE' && (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center mx-auto text-emerald-400">
                <Phone className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Emergency Engineering Hotline</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                  Encountered an urgent technical issue or system glitch? Call or message the platform engineers directly for instant resolution.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
                <a
                  href="tel:+919876543210"
                  className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 p-4 rounded-2xl flex items-center justify-center gap-3 text-emerald-300 font-bold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Maintainer Hotline</span>
                </a>

                <a
                  href="https://wa.me/919876543210?text=Hi%20noQ%20Support,%20I%20need%20urgent%20assistance%20with%20our%20queue%20system."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 p-4 rounded-2xl flex items-center justify-center gap-3 text-zinc-200 font-bold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>WhatsApp Live Chat</span>
                </a>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl max-w-lg mx-auto text-left text-xs space-y-1">
                <p className="font-bold text-white">Direct Engineering Contact:</p>
                <p className="text-zinc-400 font-mono text-[11px]">Primary Email: maintainers@noq.org.in</p>
                <p className="text-zinc-400 font-mono text-[11px]">Escalations: support@noq.org.in</p>
                <p className="text-zinc-500 text-[10px] pt-1">Response time: &lt; 15 minutes for critical queue stalls.</p>
              </div>
            </div>
          )}

          {activeTab === 'REPORT' && (
            <div>
              {submittedTicket ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Issue Dispatched to Engineering</h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Ticket Reference: <strong className="text-emerald-400 font-mono">{submittedTicket.ticket_number}</strong>
                    </p>
                    <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto">
                      Our on-call team has received your report with full diagnostics and will contact you at {submittedTicket.contact_phone} shortly.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSubmittedTicket(null);
                      setSubject('');
                      setDescription('');
                    }}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-white transition"
                  >
                    Submit Another Report
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Dr. Farhan / Receptionist"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      Issue Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="URGENT_BUG">🚨 Urgent Queue / Operation Glitch</option>
                      <option value="AUDIO_ALERT">🔊 Audio / Voice Chime Issue</option>
                      <option value="QR_SCAN">📱 QR Scan / Token Pass Issue</option>
                      <option value="BILLING">💳 Subscription / Payment Inquiry</option>
                      <option value="HARDWARE_TV">🖥️ TV Display / Lounge Sync</option>
                      <option value="OTHER">💬 General Feedback / Feature Request</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      Issue Title / Summary
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Voice announcement did not trigger when calling Token #3"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      Detailed Description
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Please share what happened, what device was used, and steps to reproduce..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{loading ? 'Submitting Issue Ticket...' : 'Dispatch Ticket to Maintainers'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

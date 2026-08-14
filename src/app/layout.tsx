import { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export const viewport: Viewport = {
  themeColor: '#090a0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://noq.vercel.app'),
  title: {
    default: 'noQ • Zero-Wait Intelligent Virtual Queue Engine',
    template: '%s | noQ Virtual Queue',
  },
  description:
    'Enterprise-grade virtual queue management platform that replaces physical waiting lines with live digital passes, lock-screen Web Push alerts, httpSMS Android integration, and Ably real-time synchronization.',
  keywords: [
    'virtual queue',
    'digital queue pass',
    'opd queue management',
    'clinic queue software',
    'salon queue app',
    'restaurant waitlist software',
    'noQ',
    'queue management system',
    'real-time waitlist',
    'zero wait queue',
  ],
  authors: [{ name: 'noQ Team' }],
  creator: 'noQ Technologies',
  publisher: 'noQ Platform',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'noQ • Zero-Wait Intelligent Virtual Queue Engine',
    description:
      'Eliminate waiting rooms and foyers with real-time digital queue passes, OS lock-screen push alerts, and automated turn notifications across Clinics, Salons, Restaurants & Retail.',
    url: 'https://noq.vercel.app',
    siteName: 'noQ',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 675,
        alt: 'noQ Virtual Queue Engine Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'noQ • Zero-Wait Intelligent Virtual Queue Engine',
    description:
      'Eliminate waiting rooms with live digital queue passes, lock-screen Web Push alerts, and real-time turn sync.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakarta.variable}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="bg-zinc-100 text-zinc-900 font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
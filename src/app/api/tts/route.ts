import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, recordRateLimitHit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// In-memory audio buffer cache to make repeated calls instantaneous & bandwidth-friendly
const audioCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const ALLOWED_LANGS = new Set(['hi', 'en', 'bilingual', 'hi-in', 'en-us', 'en-gb', 'en-in']);

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  // Rate limit TTS requests: max 120 per minute per IP
  const rateKey = `tts:${clientIp}`;
  const rateCheck = await checkRateLimit(rateKey, 120, 60);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'TTS request rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const rawText = searchParams.get('text')?.trim();
    const rawLang = (searchParams.get('lang') || 'hi').toLowerCase().trim();

    if (!rawText) {
      return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
    }

    // Input sanitization & maximum length cap (prevents SSRF / payload flooding)
    const text = rawText.slice(0, 300);
    const lang = ALLOWED_LANGS.has(rawLang) ? rawLang : 'hi';

    const cacheKey = `${lang}:${text}`;
    const cached = audioCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return new Response(new Uint8Array(cached.buffer), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    await recordRateLimitHit(rateKey, 60);

    // Google Neural TTS Voice endpoint (Female natural voice for Hindi 'hi' and English 'en')
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      text
    )}&tl=${encodeURIComponent(lang)}&client=tw-ob`;

    const res = await fetch(ttsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `TTS Provider returned status ${res.status}` },
        { status: res.status }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store in cache
    audioCache.set(cacheKey, { buffer, timestamp: Date.now() });

    // Evict oldest if cache exceeds 300 entries
    if (audioCache.size > 300) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error: any) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to synthesize voice audio' },
      { status: 500 }
    );
  }
}

import { redis } from './redis';

// In-memory fallback map if Redis is temporarily unreachable or local
const memoryCache = new Map<string, { count: number; expiresAt: number }>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SECONDS = 15 * 60; // 15 minutes

function getMemoryAttempts(key: string): number {
  const record = memoryCache.get(key);
  if (!record) return 0;
  if (Date.now() > record.expiresAt) {
    memoryCache.delete(key);
    return 0;
  }
  return record.count;
}

function incMemoryAttempts(key: string): number {
  const now = Date.now();
  const record = memoryCache.get(key);
  if (!record || now > record.expiresAt) {
    memoryCache.set(key, { count: 1, expiresAt: now + LOCKOUT_WINDOW_SECONDS * 1000 });
    return 1;
  }
  record.count += 1;
  return record.count;
}

function clearMemoryAttempts(key: string) {
  memoryCache.delete(key);
}

export async function checkLoginRateLimit(
  identifier: string,
  ip: string
): Promise<{ allowed: boolean; remainingAttempts: number; retryAfterSeconds: number }> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanIp = ip.trim();

  const ipKey = `rate:login:ip:${cleanIp}`;
  const userKey = `rate:login:user:${cleanId}`;

  let ipAttempts = 0;
  let userAttempts = 0;

  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const [ipRes, userRes] = await Promise.all([
        redis.get<number>(ipKey),
        redis.get<number>(userKey),
      ]);
      ipAttempts = Number(ipRes) || 0;
      userAttempts = Number(userRes) || 0;
    } else {
      ipAttempts = getMemoryAttempts(ipKey);
      userAttempts = getMemoryAttempts(userKey);
    }
  } catch (err) {
    console.warn('[RateLimit] Redis read failed, using memory cache fallback:', err);
    ipAttempts = getMemoryAttempts(ipKey);
    userAttempts = getMemoryAttempts(userKey);
  }

  const highestAttempts = Math.max(ipAttempts, userAttempts);

  if (highestAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: LOCKOUT_WINDOW_SECONDS,
    };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_FAILED_ATTEMPTS - highestAttempts,
    retryAfterSeconds: 0,
  };
}

export async function recordFailedLoginAttempt(identifier: string, ip: string): Promise<number> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanIp = ip.trim();

  const ipKey = `rate:login:ip:${cleanIp}`;
  const userKey = `rate:login:user:${cleanId}`;

  let currentMax = 1;

  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const [newIpCount, newUserCount] = await Promise.all([
        redis.incr(ipKey),
        redis.incr(userKey),
      ]);

      if (newIpCount === 1) await redis.expire(ipKey, LOCKOUT_WINDOW_SECONDS);
      if (newUserCount === 1) await redis.expire(userKey, LOCKOUT_WINDOW_SECONDS);

      currentMax = Math.max(newIpCount, newUserCount);
    } else {
      currentMax = Math.max(incMemoryAttempts(ipKey), incMemoryAttempts(userKey));
    }
  } catch (err) {
    console.warn('[RateLimit] Redis write failed, using memory cache fallback:', err);
    currentMax = Math.max(incMemoryAttempts(ipKey), incMemoryAttempts(userKey));
  }

  return currentMax;
}

export async function clearLoginAttempts(identifier: string, ip: string): Promise<void> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanIp = ip.trim();

  const ipKey = `rate:login:ip:${cleanIp}`;
  const userKey = `rate:login:user:${cleanId}`;

  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      await Promise.all([redis.del(ipKey), redis.del(userKey)]);
    }
  } catch (err) {
    console.warn('[RateLimit] Redis del failed:', err);
  }

  clearMemoryAttempts(ipKey);
  clearMemoryAttempts(userKey);
}

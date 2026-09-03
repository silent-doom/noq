import { redis } from './redis';

// In-memory fallback map if Redis is temporarily unreachable or local
const memoryCache = new Map<string, { count: number; expiresAt: number }>();

function getMemoryAttempts(key: string): number {
  const record = memoryCache.get(key);
  if (!record) return 0;
  if (Date.now() > record.expiresAt) {
    memoryCache.delete(key);
    return 0;
  }
  return record.count;
}

function incMemoryAttempts(key: string, windowSeconds: number): number {
  const now = Date.now();
  const record = memoryCache.get(key);
  if (!record || now > record.expiresAt) {
    memoryCache.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return 1;
  }
  record.count += 1;
  return record.count;
}

function clearMemoryAttempts(key: string) {
  memoryCache.delete(key);
}

/**
 * Universal Sliding-Window Rate Limiter
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const cleanKey = `rate:${key.trim()}`;
  let currentCount = 0;

  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const res = await redis.get<number>(cleanKey);
      currentCount = Number(res) || 0;
    } else {
      currentCount = getMemoryAttempts(cleanKey);
    }
  } catch (err) {
    currentCount = getMemoryAttempts(cleanKey);
  }

  if (currentCount >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: windowSeconds,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - currentCount),
    retryAfterSeconds: 0,
  };
}

/**
 * Increment request count on rate limit key
 */
export async function recordRateLimitHit(key: string, windowSeconds: number): Promise<number> {
  const cleanKey = `rate:${key.trim()}`;
  let count = 1;

  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      count = await redis.incr(cleanKey);
      if (count === 1) {
        await redis.expire(cleanKey, windowSeconds);
      }
    } else {
      count = incMemoryAttempts(cleanKey, windowSeconds);
    }
  } catch (err) {
    count = incMemoryAttempts(cleanKey, windowSeconds);
  }

  return count;
}

/**
 * Clear rate limit key
 */
export async function clearRateLimit(key: string): Promise<void> {
  const cleanKey = `rate:${key.trim()}`;
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      await redis.del(cleanKey);
    }
  } catch (err) {}
  clearMemoryAttempts(cleanKey);
}

// ─── Specialized Auth Login Rate Limiter (5 attempts / 15 mins) ───

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 15 * 60; // 15 minutes

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
    ipAttempts = getMemoryAttempts(ipKey);
    userAttempts = getMemoryAttempts(userKey);
  }

  const highestAttempts = Math.max(ipAttempts, userAttempts);

  if (highestAttempts >= MAX_LOGIN_ATTEMPTS) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: LOGIN_LOCKOUT_SECONDS,
    };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_LOGIN_ATTEMPTS - highestAttempts,
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

      if (newIpCount === 1) await redis.expire(ipKey, LOGIN_LOCKOUT_SECONDS);
      if (newUserCount === 1) await redis.expire(userKey, LOGIN_LOCKOUT_SECONDS);

      currentMax = Math.max(newIpCount, newUserCount);
    } else {
      currentMax = Math.max(
        incMemoryAttempts(ipKey, LOGIN_LOCKOUT_SECONDS),
        incMemoryAttempts(userKey, LOGIN_LOCKOUT_SECONDS)
      );
    }
  } catch (err) {
    currentMax = Math.max(
      incMemoryAttempts(ipKey, LOGIN_LOCKOUT_SECONDS),
      incMemoryAttempts(userKey, LOGIN_LOCKOUT_SECONDS)
    );
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
  } catch (err) {}

  clearMemoryAttempts(ipKey);
  clearMemoryAttempts(userKey);
}

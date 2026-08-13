import { Redis } from '@upstash/redis';

// Uses Upstash REST API for 100% serverless/edge compatibility
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
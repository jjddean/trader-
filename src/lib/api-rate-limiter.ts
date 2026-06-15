/** Per-key sliding-window rate limit for authenticated API routes. */
export class ApiRateLimiter {
  private timestamps = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  tryConsume(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const prior = (this.timestamps.get(key) ?? []).filter((t) => t > windowStart);
    if (prior.length >= this.maxRequests) {
      this.timestamps.set(key, prior);
      return false;
    }
    prior.push(now);
    this.timestamps.set(key, prior);
    return true;
  }
}

const aiLimitPerMinute = Number(process.env.AI_RATE_LIMIT_PER_MINUTE) || 20;

export const aiExtractLimiter = new ApiRateLimiter(aiLimitPerMinute, 60_000);
export const aiClassifyLimiter = new ApiRateLimiter(aiLimitPerMinute, 60_000);

export const AI_MAX_UPLOAD_BYTES = Number(process.env.AI_MAX_UPLOAD_BYTES) || 10 * 1024 * 1024;
export const AI_MAX_CLASSIFY_CHARS = Number(process.env.AI_MAX_CLASSIFY_CHARS) || 4_000;

/**
 * Proactive rate limiter for HMRC API calls.
 * HMRC API Platform: Max 3 requests/second per application.
 * Uses a sliding-window token bucket approach.
 */

export class HmrcRateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 3, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Wait until a request slot is available.
   * Call this before every outbound fetch() to HMRC.
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();
    // Clean old timestamps outside the window
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      // Wait until the oldest timestamp exits the window
      const waitMs = this.windowMs - (now - this.timestamps[0]) + 10; // +10ms buffer
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      // Re-clean after waiting
      this.timestamps = this.timestamps.filter((t) => Date.now() - t < this.windowMs);
    }

    this.timestamps.push(Date.now());
  }
}

/** Singleton rate limiter — shared across all HMRC API routes */
export const hmrcLimiter = new HmrcRateLimiter(
  Number(process.env.HMRC_RATE_LIMIT_RPS) || 3,
  1000,
);

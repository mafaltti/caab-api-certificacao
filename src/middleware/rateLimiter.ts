import { Request, Response, NextFunction } from "express";
import { error } from "../utils/response";

interface RateLimitData {
  count: number;
  windowStart: number;
  authFailures: number;
  authFailStart: number;
}

const requests = new Map<string, RateLimitData>();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;
const AUTH_FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_AUTH_FAILURES = 5;

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requests.entries()) {
    if (now - data.windowStart > Math.max(WINDOW_MS, AUTH_FAIL_WINDOW_MS)) {
      requests.delete(key);
    }
  }
}, 60 * 1000);

function getClientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = getClientKey(req);
  const now = Date.now();

  let data = requests.get(key);

  if (!data) {
    data = { count: 0, windowStart: now, authFailures: 0, authFailStart: now };
    requests.set(key, data);
  }

  if (now - data.windowStart > WINDOW_MS) {
    data.count = 0;
    data.windowStart = now;
  }

  data.count++;

  if (data.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil(
      (data.windowStart + WINDOW_MS - now) / 1000
    );
    res.setHeader("Retry-After", retryAfter);
    return res.status(429).json(error("Too many requests. Please try again later."));
  }

  next();
}

function trackAuthFailure(req: Request) {
  const key = getClientKey(req);
  const now = Date.now();

  let data = requests.get(key);
  if (!data) {
    data = { count: 0, windowStart: now, authFailures: 0, authFailStart: now };
    requests.set(key, data);
  }

  if (now - data.authFailStart > AUTH_FAIL_WINDOW_MS) {
    data.authFailures = 0;
    data.authFailStart = now;
  }

  data.authFailures++;
}

function isAuthBlocked(req: Request): boolean {
  const key = getClientKey(req);
  const now = Date.now();
  const data = requests.get(key);

  if (!data) return false;

  if (now - data.authFailStart > AUTH_FAIL_WINDOW_MS) {
    data.authFailures = 0;
    data.authFailStart = now;
    return false;
  }

  return data.authFailures >= MAX_AUTH_FAILURES;
}

function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  if (isAuthBlocked(req)) {
    return res
      .status(429)
      .json(error("Too many failed authentication attempts. Please try again later."));
  }
  next();
}

export { rateLimiter, trackAuthFailure, isAuthBlocked, authRateLimiter };

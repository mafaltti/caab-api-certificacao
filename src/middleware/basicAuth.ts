import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { trackAuthFailure } from "./rateLimiter.js";
import { error } from "../utils/response.js";

let cachedUsers: Record<string, string> | null = null;

function getUsers(): Record<string, string> {
  if (cachedUsers !== null) {
    return cachedUsers;
  }

  const usersEnv = process.env.API_USERS || "";
  if (!usersEnv.trim()) {
    console.warn("WARNING: API_USERS is empty - no users configured");
  }

  const users: Record<string, string> = {};

  usersEnv.split(",").forEach((pair) => {
    const [username, password] = pair.split(":");
    if (username && password) {
      users[username] = password;
    }
  });

  cachedUsers = users;
  return users;
}

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

function authError(req: Request, res: Response, message: string) {
  trackAuthFailure(req);
  res.setHeader("WWW-Authenticate", 'Basic realm="API"');
  return res.status(401).json(error(message));
}

function basicAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return authError(req, res, "Authentication required");
  }

  const base64Credentials = authHeader.split(" ")[1];

  let credentials: string;
  try {
    credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  } catch {
    return authError(req, res, "Invalid credentials format");
  }

  const colonIndex = credentials.indexOf(":");
  if (colonIndex === -1) {
    return authError(req, res, "Invalid credentials format");
  }

  const username = credentials.substring(0, colonIndex);
  const password = credentials.substring(colonIndex + 1);

  const users = getUsers();

  if (users[username] && timingSafeCompare(users[username], password)) {
    (req as Request & { user?: string }).user = username;
    return next();
  }

  return authError(req, res, "Invalid credentials");
}

export default basicAuth;

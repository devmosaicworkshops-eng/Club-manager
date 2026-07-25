import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set");
  return secret;
}

export interface AuthPayload {
  username: string;
  role: string;
  nom: string;
  categorie: string;
  paymentStatus: string;
  enrolled?: boolean;
  currentTrimesterLabel?: string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "24h" });
}

export function verifyToken(authHeader: string | undefined): AuthPayload | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    return jwt.verify(token, getSecret()) as AuthPayload;
  } catch {
    return null;
  }
}

export async function verifyPassword(input: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$") || stored.startsWith("$2y$")) {
    return bcrypt.compare(input, stored);
  }
  return false;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

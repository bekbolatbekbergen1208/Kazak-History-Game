import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Role } from "./types";
import { database } from "./supabase-server";
export const token = () => randomBytes(32).toString("hex");
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const cookieName = (roomId: string, role: Role) =>
  `tm_${role}_${roomId}`;
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 86400,
};
export function matches(value: string | undefined, stored: string) {
  if (!value) return false;
  const a = Buffer.from(hash(value)),
    b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== new URL(request.url).origin &&
    origin !== process.env.NEXT_PUBLIC_SITE_URL
  )
    throw new ApiError(403, "Сұрау көзіне рұқсат жоқ.");
}
export async function rateLimit(key: string, limit: number, seconds = 60) {
  const { data, error } = await database().rpc("classroom_rate_limit", {
    p_key: hash(key),
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error) throw new Error(error.message);
  if (!data)
    throw new ApiError(
      429,
      "Сұраулар тым жиі жіберілді. Бір минуттан кейін қайталаңыз.",
    );
}
export function requester(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  );
}

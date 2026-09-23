import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { database } from "../../../lib/supabase-server";
import {
  ApiError,
  cookieName,
  cookieOptions,
  hash,
  rateLimit,
  requester,
  sameOrigin,
  token,
} from "../../../lib/security";
import { requestSchema } from "../../../lib/validation";
import { failure } from "../../../lib/api";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new ApiError(
        400,
        "Атыңызды (2–32 таңба) және 6 цифрлық кодты тексеріңіз.",
      );
    const body = parsed.data;
    await rateLimit(
      `${body.action}:${requester(request)}`,
      body.action === "create" ? 20 : 180,
      body.action === "create" ? 3600 : 60,
    );
    const db = database();
    if (body.action === "create") {
      const teacher = token(),
        projector = hash(`projector:${teacher}`);
      for (let i = 0; i < 8; i++) {
        const code = String(randomInt(100000, 1000000));
        const { data, error } = await db
          .from("rooms")
          .insert({
            code,
            teacher_token_hash: hash(teacher),
            projector_token_hash: hash(projector),
          })
          .select("id,code")
          .single();
        if (error?.code === "23505") continue;
        if (error) throw new Error(error.message);
      const response = NextResponse.json({ roomId: data.id, code: data.code });
        response.cookies.set(
          cookieName(data.id, "teacher"),
          teacher,
          cookieOptions,
        );
        response.cookies.set(
          cookieName(data.id, "projector"),
          projector,
          cookieOptions,
        );
        return response;
      }
      throw new ApiError(
        503,
        "Сабақ кодын жасау мүмкін болмады. Қайта көріңіз.",
      );
    }
    const { data: room, error } = await db
      .from("rooms")
      .select("id,status,expires_at")
      .eq("code", body.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!room || Date.parse(room.expires_at) <= Date.now())
      throw new ApiError(404, "Код бойынша белсенді сабақ табылмады.");
    if (room.status === "ended")
      throw new ApiError(409, "Бұл сабақ аяқталған.");
    const existing = request.cookies.get(cookieName(room.id, "student"))?.value;
    if (existing) {
      const { data: p } = await db
        .from("participants")
        .select("id")
        .eq("room_id", room.id)
        .eq("token_hash", hash(existing))
        .maybeSingle();
      if (p) return NextResponse.json({ roomId: room.id, participantId: p.id });
    }
    const capability = token();
    const { data: pid, error: joinError } = await db.rpc("classroom_join", {
      p_room_id: room.id,
      p_name: body.name,
      p_token_hash: hash(capability),
    });
    if (joinError) throw new Error(joinError.message);
    const response = NextResponse.json({ roomId: room.id, participantId: pid });
    response.cookies.set(
      cookieName(room.id, "student"),
      capability,
      cookieOptions,
    );
    return response;
  } catch (error) {
    return failure(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { authorize, snapshot } from "../../../../lib/snapshot";
import {
  ApiError,
  cookieName,
  cookieOptions,
  rateLimit,
  sameOrigin,
  matches,
  requester,
  hash,
} from "../../../../lib/security";
import { roomRequestSchema } from "../../../../lib/validation";
import { database } from "../../../../lib/supabase-server";
import {
  answerFor,
  currentTask,
  findTask,
  grade,
} from "../../../../lib/catalog";
import { failure } from "../../../../lib/api";
import type { Progress, Role } from "../../../../lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const role = request.nextUrl.searchParams.get("role") as Role;
    if (!["teacher", "student", "projector"].includes(role))
      throw new ApiError(400, "Режимді таңдаңыз.");
    return NextResponse.json(await snapshot(request, id, role), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    sameOrigin(request);
    const { id } = await context.params;
    const parsed = roomRequestSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Сұрау форматы жарамсыз.");
    const body = parsed.data;
    if (body.action === "projector_enter") {
      await rateLimit(`projector:${requester(request)}`, 60);
      const { data: room, error } = await database()
        .from("rooms")
        .select("projector_token_hash,expires_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!room) throw new ApiError(404, "Сабақ табылмады.");
      if (Date.parse(room.expires_at) <= Date.now())
        throw new ApiError(410, "Сабақтың мерзімі аяқталған.");
      const existing = request.cookies.get(cookieName(id, "projector"))?.value;
      let capability = body.key || existing;
      if (!matches(capability, room.projector_token_hash)) {
        await authorize(request, id, "teacher");
        capability = hash(
          `projector:${request.cookies.get(cookieName(id, "teacher"))!.value}`,
        );
        const { error: rotateError } = await database()
          .from("rooms")
          .update({ projector_token_hash: hash(capability) })
          .eq("id", id);
        if (rotateError) throw new Error(rotateError.message);
      }
      const response = NextResponse.json({ ok: true });
      response.cookies.set(
        cookieName(id, "projector"),
        capability!,
        cookieOptions,
      );
      return response;
    }
    const role = body.action === "control" ? "teacher" : "student";
    const { db, room, participant } = await authorize(request, id, role);
    if (body.action === "control") {
      if (body.control === "launch_question") {
        const task = findTask(body.taskId || "");
        if (
          !task ||
          task.type !== "choice" ||
          task.id === "final" ||
          task.mission !== room.current_mission
        )
          throw new ApiError(400, "Қазіргі миссиядан ортақ сұрақты таңдаңыз.");
      }
      const { error } = await db.rpc("classroom_control", {
        p_room_id: id,
        p_control: body.control,
        p_task_id: body.taskId || null,
        p_version: body.version,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (!participant) throw new ApiError(403, "Оқушы рұқсаты қажет.");
    if (body.action === "heartbeat") {
      const { error } = await db
        .from("participants")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", participant.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    const task = findTask(body.taskId);
    if (!task) throw new ApiError(400, "Тапсырма табылмады.");
    const { data: state, error } = await db
      .from("progress")
      .select("*")
      .eq("participant_id", participant.id)
      .single();
    if (error) throw new Error(error.message);
    const progress = state as Progress;
    if (body.action === "skip") {
      if (room.mode !== "individual")
        throw new ApiError(409, "Ортақ тапсырманы өткізіп жіберуге болмайды.");
      if (currentTask(room, progress)?.id !== task.id)
        throw new ApiError(
          409,
          "Сабақ күйі өзгерді. Қазіргі тапсырманы қайта ашыңыз.",
        );
      const { error: skipError } = await db.rpc("classroom_skip", {
        p_room_id: id,
        p_participant_id: participant.id,
        p_task_id: task.id,
        p_task_mission: task.mission,
        p_progress_version: body.progressVersion,
      });
      if (skipError) throw new Error(skipError.message);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "draft") {
      if (room.status === "ended") throw new ApiError(409, "Сабақ аяқталды.");
      if (task.mission !== room.current_mission)
        throw new ApiError(409, "Мұғалім келесі миссияға өтті.");
      const { error: saveError } = await db.rpc("classroom_save_draft", {
        p_room_id: id,
        p_participant_id: participant.id,
        p_task_id: task.id,
        p_draft: body.draft,
      });
      if (saveError) throw new Error(saveError.message);
      return NextResponse.json({ ok: true });
    }
    await rateLimit(`answer:${participant.id}`, 120);
    // Accept a previously committed request even if the teacher has since paused/advanced.
    const { data: prior } = await db
      .from("responses")
      .select("*")
      .eq("participant_id", participant.id)
      .eq("request_id", body.requestId)
      .maybeSingle();
    if (prior)
      return NextResponse.json({
        accepted: true,
        correct:
          room.mode === "class" && !room.answer_revealed ? null : prior.correct,
        points: prior.points,
        explanation:
          prior.correct && room.mode === "individual" ? task.fact : undefined,
        correction:
          !prior.correct && room.mode === "individual"
            ? answerFor(task)
            : undefined,
      });
    if (currentTask(room, progress)?.id !== task.id)
      throw new ApiError(
        409,
        "Сабақ күйі өзгерді. Қазіргі тапсырманы қайта ашыңыз.",
      );
    const correct = grade(task, body.answer);
    const { data: response, error: submitError } = await db.rpc(
      "classroom_submit",
      {
        p_room_id: id,
        p_participant_id: participant.id,
        p_request_id: body.requestId,
        p_task_id: task.id,
        p_task_mission: task.mission,
        p_round: body.round,
        p_mode: body.mode,
        p_answer: body.answer,
        p_correct: correct,
        p_max_points: task.points,
        p_progress_version: progress.version,
      },
    );
    if (submitError) throw new Error(submitError.message);
    return NextResponse.json({
      accepted: true,
      correct: room.mode === "class" ? null : correct,
      points: response.points,
      explanation:
        correct && room.mode === "individual" ? task.fact : undefined,
      correction:
        !correct && room.mode === "individual" ? answerFor(task) : undefined,
      ...(room.answer_revealed ? { answer: answerFor(task) } : {}),
    });
  } catch (error) {
    return failure(error);
  }
}

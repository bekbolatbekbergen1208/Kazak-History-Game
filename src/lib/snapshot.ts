import "server-only";
import type { NextRequest } from "next/server";
import { database } from "./supabase-server";
import { ApiError, cookieName, hash, matches } from "./security";
import { classStats, questionStats, studentRows } from "./analytics";
import { readResponses } from "./readResponses";
import { answerFor, currentTask, findTask, publicTask } from "./catalog";
import type { Participant, Progress, Role, Room, Snapshot } from "./types";
export async function authorize(request: NextRequest, id: string, role: Role) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new ApiError(404, "Сабақ табылмады.");
  const db = database();
  const { data: record, error } = await db
    .from("rooms")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!record)
    throw new ApiError(404, "Сабақ табылмады немесе сақтау мерзімі аяқталған.");
  const { teacher_token_hash, projector_token_hash, ...safe } = record;
  const room = safe as Room;
  if (Date.parse(room.expires_at) <= Date.now())
    throw new ApiError(410, "Сабақтың сақтау мерзімі аяқталды.");
  const capability = request.cookies.get(cookieName(id, role))?.value;
  if (role === "teacher" || role === "projector") {
    if (
      !matches(
        capability,
        role === "teacher" ? teacher_token_hash : projector_token_hash,
      )
    )
      throw new ApiError(
        403,
        role === "teacher"
          ? "Мұғалім рұқсаты осы браузерде жоқ. Сабақты ашқан құрылғыны пайдаланыңыз."
          : "Проектор сілтемесі жарамсыз.",
      );
    return { db, room, participant: undefined };
  }
  if (!capability) throw new ApiError(401, "Сабаққа қайта қосылыңыз.");
  const { data: student, error: studentError } = await db
    .from("participants")
    .select("id,room_id,name,joined_at,last_seen_at")
    .eq("room_id", id)
    .eq("token_hash", hash(capability))
    .maybeSingle();
  if (studentError) throw new Error(studentError.message);
  if (!student) throw new ApiError(401, "Сабаққа қайта қосылыңыз.");
  return { db, room, participant: student as Participant };
}
export async function snapshot(
  request: NextRequest,
  id: string,
  role: Role,
): Promise<Snapshot> {
  const { db, room, participant } = await authorize(request, id, role);
  const visibleRoom = {
    ...room,
    expected_participants:
      role === "teacher"
        ? room.expected_participants
        : role === "student" && participant
          ? room.expected_participants.filter((id) => id === participant.id)
          : [],
  };
  const base = { role, room: visibleRoom, serverTime: Date.now() };
  if (role === "student" && participant) {
    const [{ data: state, error }, responses] = await Promise.all([
      db
        .from("progress")
        .select("*")
        .eq("participant_id", participant.id)
        .single(),
      readResponses(db, id, participant.id),
    ]);
    if (error) throw new Error(error.message);
    const progress = state as Progress;
    const task = currentTask(room, progress);
    const submitted =
      room.mode === "class"
        ? responses.find(
            (r) =>
              r.task_id === room.active_task &&
              r.round_id === room.round_id &&
              r.mode === "class",
          ) || null
        : null;
    const active = findTask(room.active_task || "");
    return {
      ...base,
      participant,
      progress,
      task: task ? publicTask(task) : null,
      attempts: responses.filter((r) => r.task_id === task?.id && !r.correct)
        .length,
      submitted: submitted
        ? {
            ...submitted,
            correct: room.answer_revealed ? submitted.correct : false,
            points: room.answer_revealed ? submitted.points : 0,
          }
        : null,
      ...(room.answer_revealed && active
        ? {
            revealedAnswer: {
              text: answerFor(active),
              explanation: active.fact,
            },
          }
        : {}),
    };
  }
  const [p, s, a] = await Promise.all([
    db
      .from("participants")
      .select("id,room_id,name,joined_at,last_seen_at")
      .eq("room_id", id)
      .order("joined_at"),
    db.from("progress").select("*").eq("room_id", id),
    readResponses(db, id),
  ]);
  if (p.error || s.error) throw new Error(p.error?.message || s.error?.message);
  const participants = p.data as Participant[],
    progress = s.data as Progress[],
    responses = a;
  const questions = questionStats(
    { ...room, mode: "individual" },
    participants,
    responses,
    role === "teacher",
  );
  const activeQuestion =
    questionStats(room, participants, responses, role === "teacher").find(
      (q) => q.id === room.active_task,
    ) || null;
  const active = findTask(room.active_task || "");
  return {
    ...base,
    stats: classStats(participants, progress, responses, room),
    questions,
    activeQuestion,
    ...(room.answer_revealed && active
      ? {
          revealedAnswer: { text: answerFor(active), explanation: active.fact },
        }
      : {}),
    ...(role === "teacher"
      ? {
          students: studentRows(participants, progress, responses, room),
          responses,
        }
      : {}),
  };
}

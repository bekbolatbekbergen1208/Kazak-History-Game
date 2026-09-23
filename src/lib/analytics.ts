import { allTasks, answerFor, currentTask } from "./catalog";
import type {
  ClassStats,
  Participant,
  Progress,
  QuestionStats,
  ResponseRow,
  Room,
  StudentRow,
} from "./types";
export function questionStats(
  room: Room,
  participants: Participant[],
  responses: ResponseRow[],
  includeKeys = false,
): QuestionStats[] {
  return allTasks.map((task) => {
    const inRound = room.mode === "class" && room.active_task === task.id;
    const relevant = responses.filter(
      (r) =>
        r.task_id === task.id &&
        (!inRound || (r.mode === "class" && r.round_id === room.round_id)),
    );
    const first = new Map<string, ResponseRow>();
    for (const response of relevant.sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ))
      if (!first.has(response.participant_id))
        first.set(response.participant_id, response);
    const answers = [...first.values()];
    const correct = answers.filter((r) => r.correct).length;
    const expected = inRound
      ? room.expected_participants.length
      : participants.length;
    const distribution = (task.options || []).map(
      (_, i) => answers.filter((r) => r.answer.picks?.includes(i)).length,
    );
    return {
      id: task.id,
      title: task.title,
      mission: task.mission,
      type: task.id === "final" ? "code" : task.type,
      options: task.options || [],
      answers: answers.length,
      correct,
      incorrect: answers.length - correct,
      percentage: answers.length
        ? Math.round((correct / answers.length) * 100)
        : 0,
      distribution,
      expected,
      allAnswered:
        expected > 0 &&
        (inRound
          ? room.expected_participants.every((id) => first.has(id))
          : answers.length >= expected),
      ...(includeKeys
        ? {
            answerText: answerFor(task),
            explanation: task.fact,
            correctOptions: task.correct,
          }
        : {}),
    };
  });
}
export function classStats(
  participants: Participant[],
  progress: Progress[],
  responses: ResponseRow[],
  room: Room,
  now = Date.now(),
): ClassStats {
  const questions = questionStats(
    { ...room, mode: "individual" },
    participants,
    responses,
  ).filter((q) => q.answers > 0);
  const first = questions.reduce((sum, q) => sum + q.answers, 0);
  const completed = progress.filter((p) => p.finished_at);
  const mean = (numbers: number[]) =>
    numbers.length
      ? Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length)
      : 0;
  return {
    totalStudents: participants.length,
    activeStudents: participants.filter(
      (p) => now - Date.parse(p.last_seen_at) < 45000,
    ).length,
    averageScore: mean(progress.map((p) => p.score)),
    completion: participants.length
      ? Math.round(
          (progress.reduce((s, p) => s + p.completed_tasks, 0) /
            (participants.length * allTasks.length)) *
            100,
        )
      : 0,
    correctPercentage: first
      ? Math.round(
          (questions.reduce((sum, q) => sum + q.correct, 0) / first) * 100,
        )
      : 0,
    averageTime: completed.length
      ? mean(completed.map((p) => p.elapsed_seconds || 0))
      : null,
    finished: completed.length,
    missionCompletion: [0, 1, 2].map((m) => {
      const ids = allTasks.filter((t) => t.mission === m).map((t) => t.id);
      return participants.length
        ? Math.round(
            (progress.filter((p) =>
              ids.every((id) => Object.hasOwn(p.awards, id)),
            ).length /
              participants.length) *
              100,
          )
        : 0;
    }),
    mostDifficult:
      [...questions].sort((a, b) => a.percentage - b.percentage)[0] || null,
    bestUnderstood:
      [...questions].sort((a, b) => b.percentage - a.percentage)[0] || null,
  };
}
export function studentRows(
  participants: Participant[],
  progress: Progress[],
  responses: ResponseRow[],
  room: Room,
): StudentRow[] {
  return participants.flatMap((p) => {
    const state = progress.find((row) => row.participant_id === p.id);
    if (!state) return [];
    return [
      {
        ...p,
        progress: {
          ...state,
          current_task: currentTask(room, state)?.id || state.current_task,
        },
        completion: Math.round((state.completed_tasks / allTasks.length) * 100),
        mission: room.current_mission,
        status: state.finished_at
          ? "finished"
          : room.status === "ended"
            ? "incomplete"
            : room.status === "lobby"
              ? "waiting"
              : Date.now() - Date.parse(p.last_seen_at) > 45000
                ? "offline"
                : "active",
        latestResponse:
          responses
            .filter((r) => r.participant_id === p.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ||
          null,
      },
    ];
  });
}

import { tasks, taskAnswer } from "../data/historyData";
import type { Task } from "../data/historyData";
import type { Draft } from "../gameLogic";
import { isTaskComplete } from "../gameLogic";
import type { Progress, Room } from "./types";
export const finalTask: Task = {
  id: "final",
  mission: 3,
  title: "Тарихтың құпия коды",
  subtitle: "Осы кезеңнің шешуші жылын енгізіңіз.",
  type: "choice",
  points: 10,
  options: [],
  correct: [],
  fact: "Ұлттық дағдарыс, саяси күрес және 1916 жылғы ұлт-азаттық көтеріліс арасындағы байланыс қалпына келтірілді.",
  hint: "Соңғы архив қай жылға арналды?",
};
export const allTasks = [...tasks, finalTask];
export function findTask(id: string) {
  return allTasks.find((t) => t.id === id);
}
export function currentTask(room: Room, progress: Progress): Task | null {
  if (progress.finished_at) return null;
  if (room.mode === "class") return findTask(room.active_task || "") || null;
  return (
    allTasks.find(
      (t) =>
        t.mission === room.current_mission &&
        !Object.hasOwn(progress.awards, t.id),
    ) || null
  );
}
// The browser receives a shuffled presentation, never the grading key.
export function publicTask(task: Task): Task {
  const { correct, items, sequence, fact, ...rest } = task;
  return {
    ...rest,
    fact: "",
    correct: correct?.map(() => -1),
    items: items
      ?.map((i) => ({ text: i.text, group: "" }))
      .sort((a, b) => a.text.localeCompare(b.text, "kk")),
    sequence: sequence
      ? [...sequence].sort((a, b) => a.localeCompare(b, "kk"))
      : undefined,
  };
}
export function grade(task: Task, answer: Draft & { code?: string }) {
  return task.id === "final"
    ? answer.code === "1916"
    : isTaskComplete(task, answer);
}
export function answerFor(task: Task) {
  return task.id === "final" ? "1916" : taskAnswer(task);
}

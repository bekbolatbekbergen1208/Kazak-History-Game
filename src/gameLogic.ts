import type { Task } from "./data/historyData";
export type Draft = {
  picks?: number[];
  placements?: Record<string, string>;
  order?: string[];
  visited?: string[];
  region?: string;
  reflection?: string;
  sealed?: boolean;
};
export function isTaskComplete(task: Task, draft: Draft): boolean {
  switch (task.type) {
    case "choice":
      return (
        (task.id !== "decree" || !!draft.sealed) &&
        draft.picks?.length === task.correct!.length &&
        task.correct!.every((i) => draft.picks?.includes(i))
      );
    case "sort":
      return task.items!.every((i) => draft.placements?.[i.text] === i.group);
    case "order":
      return (
        draft.order?.length === task.sequence!.length &&
        task.sequence!.every((s, i) => draft.order?.[i] === s)
      );
    case "map":
      return ["Жетісу", "Торғай"].every((region) =>
        draft.visited?.includes(region),
      );
    case "reflection":
      return (
        !!draft.picks?.every(
          (i) =>
            Number.isInteger(i) && i >= 0 && i < (task.options?.length || 0),
        ) &&
        new Set(draft.picks).size === draft.picks.length &&
        (draft.picks?.length || 0) >= 2 &&
        (draft.picks?.length || 0) <= 3 &&
        (draft.reflection?.trim().length || 0) >= 15
      );
  }
}
export function awardPoints(maximum: number, mistakes: number): number {
  return Math.max(Math.ceil(maximum / 2), maximum - Math.max(0, mistakes));
}

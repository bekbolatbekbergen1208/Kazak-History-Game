import test from "node:test";
import assert from "node:assert/strict";
import {
  tasks,
  missions,
  petitionFacts,
  dumaFacts,
  timelineEvents,
} from "../src/data/historyData.ts";
import { isTaskComplete, awardPoints } from "../src/gameLogic.ts";

test("A complete investigation awards exactly 100 points across 25/30/35/10", () => {
  let total = 10;
  missions.forEach((mission, index) => {
    const missionTasks = tasks.filter((t) => t.mission === index);
    assert.equal(
      missionTasks.reduce((sum, t) => sum + t.points, 0),
      mission.points,
    );
    total += mission.points;
  });
  assert.equal(total, 100);
  assert.equal(new Set(tasks.map((t) => t.id)).size, tasks.length);
});
test("Every task accepts its complete answer and refuses an empty response", () => {
  for (const task of tasks) {
    assert.equal(isTaskComplete(task, {}), false, task.id);
    const draft = {
      picks: task.type === "reflection" ? [0, 1] : task.correct,
      placements: Object.fromEntries(
        (task.items || []).map((i) => [i.text, i.group]),
      ),
      order: task.sequence,
      visited: ["Жетісу", "Торғай"],
      sealed: true,
      reflection: "Ортақ себептер әр аймақта халық наразылығын күшейтті.",
    };
    assert.equal(isTaskComplete(task, draft), true, task.id);
  }
});
test("Incomplete multi-choice, swapped categories, reversed chronology and duplicate map visits fail", () => {
  const choice = tasks.find((t) => t.id === "karataev")!;
  assert.equal(isTaskComplete(choice, { picks: [0] }), false);
  assert.equal(isTaskComplete(choice, { picks: [0, 1] }), false);
  const sort = tasks.find((t) => t.id === "regions")!;
  const placements = Object.fromEntries(
    sort.items!.map((i) => [i.text, i.group]),
  );
  placements["Амангелді Иманов"] = "Жетісу";
  assert.equal(isTaskComplete(sort, { placements }), false);
  assert.equal(
    isTaskComplete(
      tasks.find((t) => t.id === "timeline")!,
      { order: [...timelineEvents].reverse() },
    ),
    false,
  );
  assert.equal(
    isTaskComplete(
      tasks.find((t) => t.id === "map")!,
      { visited: ["Жетісу", "Жетісу"] },
    ),
    false,
  );
  assert.equal(
    isTaskComplete(
      tasks.find((t) => t.id === "decree")!,
      { picks: [1] },
    ),
    false,
  );
});
test("Reflection requires evidence and a personal conclusion without grading its position", () => {
  const task = tasks.find((t) => t.id === "reflection")!;
  assert.equal(
    isTaskComplete(task, { picks: [0, 1], reflection: "  " }),
    false,
  );
  assert.equal(
    isTaskComplete(task, {
      picks: [0, 1, 2, 3],
      reflection: "Көтерілістің тарихи маңызы зор болды.",
    }),
    false,
  );
  assert.equal(
    isTaskComplete(task, {
      picks: [2, 3],
      reflection: "Менің ойымша, әртүрлі тактиканы салыстыру қажет.",
    }),
    true,
  );
});
test("Retries never create negative points and every task retains at least half its points", () => {
  for (const t of tasks) {
    assert.equal(awardPoints(t.points, 0), t.points);
    assert.equal(awardPoints(t.points, 100), Math.ceil(t.points / 2));
  }
  assert.equal(awardPoints(10, 1), 9);
});
test("Unavailable source content stays empty rather than inventing petitions or deputies", () => {
  assert.equal(petitionFacts.filter((p) => p.sourceProvided).length, 1);
  assert.equal(
    petitionFacts.filter((p) => !p.sourceProvided && p.text === "").length,
    5,
  );
  assert.equal(dumaFacts.flatMap((d) => d.deputies).length, 0);
});

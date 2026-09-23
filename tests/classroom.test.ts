import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { tasks } from "../src/data/historyData.ts";
import {
  currentTask,
  publicTask,
  grade,
  allTasks,
} from "../src/lib/catalog.ts";
import { questionStats, classStats } from "../src/lib/analytics.ts";
import { draftSchema } from "../src/lib/validation.ts";
import type {
  Participant,
  Progress,
  ResponseRow,
  Room,
} from "../src/lib/types.ts";
async function setup() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema realtime;create function realtime.send(jsonb,text,text,boolean) returns void language sql as 'select';`,
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609230001_classroom.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const roomId = randomUUID();
  await db.query(
    "insert into rooms(id,code,teacher_token_hash,projector_token_hash) values($1,'123456','teacher-hash','projector-hash')",
    [roomId],
  );
  const join = async (name: string) => {
    const result = await db.query<{ id: string }>(
      "select classroom_join($1,$2,$3) as id",
      [roomId, name, randomUUID()],
    );
    return result.rows[0].id;
  };
  const control = async (command: string, taskId: string | null = null) => {
    const { rows } = await db.query<{ version: number }>(
      "select version from rooms where id=$1",
      [roomId],
    );
    return db.query("select classroom_control($1,$2,$3,$4)", [
      roomId,
      command,
      taskId,
      rows[0].version,
    ]);
  };
  const submit = async (
    pid: string,
    task: string,
    mission: number,
    correct: boolean,
    max: number,
    requestId = randomUUID(),
    mode = "individual",
    round?: number,
  ) => {
    const r = await db.query<{ round_id: number }>(
      "select round_id from rooms where id=$1",
      [roomId],
    );
    const p = await db.query<{ version: number }>(
      "select version from progress where participant_id=$1",
      [pid],
    );
    return db.query<{ result: ResponseRow }>(
      "select classroom_submit($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result",
      [
        roomId,
        pid,
        requestId,
        task,
        mission,
        round ?? r.rows[0].round_id,
        mode,
        { picks: correct ? [1] : [0] },
        correct,
        max,
        p.rows[0].version,
      ],
    );
  };
  return { db, roomId, join, control, submit };
}

test("SQL: independent participants, server grading persistence and idempotent retries", async () => {
  const { db, roomId, join, control, submit } = await setup();
  try {
    const a = await join("Айбек"),
      b = await join("Думан");
    assert.notEqual(a, b);
    await control("start");
    await submit(a, "rys", 0, false, 7);
    const requestId = randomUUID();
    await submit(a, "rys", 0, true, 7, requestId);
    await submit(a, "rys", 0, true, 7, requestId);
    const { rows } = await db.query<Progress>(
      "select * from progress where room_id=$1 order by score desc",
      [roomId],
    );
    assert.equal(rows[0].score, 6);
    assert.equal(rows[0].completed_tasks, 1);
    assert.equal(rows[1].score, 0);
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from responses",
        )
      ).rows[0].count,
      2,
    );
    await assert.rejects(
      () => submit(a, "rys", 0, true, 7),
      /ALREADY_SUBMITTED/,
    );
  } finally {
    await db.close();
  }
});

test("SQL: pause, locked answers, stale mission submissions and version conflicts are enforced", async () => {
  const { db, roomId, join, control, submit } = await setup();
  try {
    const a = await join("Аружан");
    await control("start");
    await control("pause");
    await assert.rejects(() => submit(a, "rys", 0, true, 7), /ROOM_PAUSED/);
    await db.query(
      "update rooms set paused_at=now()-interval '30 seconds' where id=$1",
      [roomId],
    );
    await control("resume");
    const { rows } = await db.query<Room>("select * from rooms where id=$1", [
      roomId,
    ]);
    assert.ok(Number(rows[0].paused_ms) >= 29999);
    await control("lock");
    await assert.rejects(() => submit(a, "rys", 0, true, 7), /ANSWERS_LOCKED/);
    await control("unlock");
    await assert.rejects(
      () =>
        db.query("select classroom_control($1,$2,null,0)", [roomId, "pause"]),
      /STALE_STATE/,
    );
    await control("next_mission");
    await assert.rejects(() => submit(a, "rys", 0, true, 7), /STALE_STATE/);
  } finally {
    await db.close();
  }
});

test("SQL: shared round freezes its roster, counts once, gates reveal and supports teacher early closure", async () => {
  const { db, roomId, join, control, submit } = await setup();
  try {
    const a = await join("Айбек"),
      b = await join("Думан");
    await control("start");
    await control("launch_question", "rys");
    const late = await join("Кеш қосылған");
    await assert.rejects(
      () => submit(late, "rys", 0, true, 7, randomUUID(), "class"),
      /NOT_EXPECTED/,
    );
    await submit(a, "rys", 0, true, 7, randomUUID(), "class");
    await assert.rejects(() => control("reveal"), /WAIT_FOR_ANSWERS/);
    await assert.rejects(
      () => submit(a, "rys", 0, true, 7, randomUUID(), "class"),
      /ALREADY_SUBMITTED/,
    );
    await submit(b, "rys", 0, false, 7, randomUUID(), "class");
    await control("reveal");
    const { rows } = await db.query<Room>("select * from rooms where id=$1", [
      roomId,
    ]);
    assert.equal(rows[0].answer_revealed, true);
    assert.equal(rows[0].answers_locked, true);
    await assert.rejects(() => control("unlock"), /INVALID_CONTROL/);
    await control("individual");
    await control("launch_question", "rys");
    await control("lock");
    await control("reveal");
    assert.equal(
      (await db.query<Room>("select * from rooms")).rows[0].answer_revealed,
      true,
    );
  } finally {
    await db.close();
  }
});

test("SQL: classroom data and privileged functions are unavailable to anonymous clients", async () => {
  const { db, join } = await setup();
  try {
    await join("Айбек");
    await db.exec("set role anon");
    await assert.rejects(
      () => db.query("select * from participants"),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query("select * from responses"),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query("select cleanup_classrooms()"),
      /permission denied/,
    );
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});

test("SQL: expiry blocks new work, cleanup cascades and rate limits survive requests", async () => {
  const { db, roomId, join, control, submit } = await setup();
  try {
    const a = await join("Айбек");
    await control("start");
    await submit(a, "rys", 0, true, 7);
    await db.query(
      "update rooms set expires_at=now()-interval '1 second' where id=$1",
      [roomId],
    );
    await assert.rejects(() => join("Думан"), /ROOM_EXPIRED/);
    await assert.rejects(() => submit(a, "stats", 0, true, 10), /ROOM_EXPIRED/);
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select cleanup_classrooms() as count",
        )
      ).rows[0].count,
      1,
    );
    for (const table of ["rooms", "participants", "responses", "progress"])
      assert.equal(
        (
          await db.query<{ count: number }>(
            `select count(*)::int as count from ${table}`,
          )
        ).rows[0].count,
        0,
      );
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select classroom_rate_limit('test',1,60) as ok",
        )
      ).rows[0].ok,
      true,
    );
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select classroom_rate_limit('test',1,60) as ok",
        )
      ).rows[0].ok,
      false,
    );
  } finally {
    await db.close();
  }
});

test("Public tasks exclude grading keys, references cannot forge a valid reflection", () => {
  for (const task of tasks) {
    const safe = publicTask(task);
    assert.equal(safe.fact, "");
    assert.ok(safe.correct?.every((i) => i === -1) ?? true);
    assert.ok(safe.items?.every((i) => i.group === "") ?? true);
  }
  const reflection = tasks.find((t) => t.id === "reflection")!;
  assert.equal(
    grade(reflection, {
      picks: [28, 29],
      reflection: "Бұл жарамсыз дәлелдер, олармен ұпай алуға болмайды.",
    }),
    false,
  );
  assert.equal(draftSchema.safeParse({ picks: [1, 1] }).success, false);
  assert.equal(
    draftSchema.safeParse({ reflection: "a".repeat(601) }).success,
    false,
  );
});

test("Analytics count unique first answers, separate rounds and do not expose answer keys publicly", () => {
  const room = {
    mode: "class",
    active_task: "rys",
    round_id: 2,
    expected_participants: ["a", "b"],
    current_mission: 0,
  } as Room;
  const participants = [
    { id: "a", last_seen_at: new Date().toISOString() },
    { id: "b", last_seen_at: new Date().toISOString() },
  ] as Participant[];
  const responses = [
    {
      id: "old",
      participant_id: "a",
      task_id: "rys",
      mode: "individual",
      round_id: 0,
      correct: false,
      answer: { picks: [0] },
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "a1",
      participant_id: "a",
      task_id: "rys",
      mode: "class",
      round_id: 2,
      correct: true,
      answer: { picks: [1] },
      created_at: "2026-01-01T00:00:01Z",
    },
    {
      id: "b1",
      participant_id: "b",
      task_id: "rys",
      mode: "class",
      round_id: 2,
      correct: false,
      answer: { picks: [0] },
      created_at: "2026-01-01T00:00:02Z",
    },
  ] as ResponseRow[];
  const q = questionStats(room, participants, responses)[0];
  assert.equal(q.answers, 2);
  assert.equal(q.correct, 1);
  assert.equal(q.percentage, 50);
  assert.deepEqual(q.distribution, [1, 1, 0, 0]);
  assert.equal(q.allAnswered, true);
  assert.equal(q.answerText, undefined);
  assert.equal(q.correctOptions, undefined);
  const individual = { ...room, mode: "individual" as const };
  assert.equal(
    questionStats(individual, participants, responses)[0].correct,
    0,
  );
  assert.equal(classStats(participants, [], [], room).averageTime, null);
  assert.equal(
    classStats(participants, [], responses, room).correctPercentage,
    0,
  );
  const progress = {
    awards: { rys: 7 },
    finished_at: null,
  } as unknown as Progress;
  assert.equal(currentTask(individual, progress)?.id, "stats");
});

test("SQL: the full classroom curriculum awards exactly 100 and records a stable completion time", async () => {
  const { db, roomId, join, control, submit } = await setup();
  try {
    const a = await join("Зерттеуші");
    await control("start");
    await db.query(
      "update rooms set started_at=now()-interval '8 minutes',paused_ms=30000 where id=$1",
      [roomId],
    );
    for (let mission = 0; mission < 4; mission++) {
      if (mission > 0) await control("next_mission");
      for (const task of allTasks.filter((t) => t.mission === mission))
        await submit(a, task.id, mission, true, task.points);
    }
    const { rows } = await db.query<Progress>(
      "select * from progress where participant_id=$1",
      [a],
    );
    assert.equal(rows[0].score, 100);
    assert.equal(rows[0].completed_tasks, 18);
    assert.ok(rows[0].finished_at);
    assert.ok(
      rows[0].elapsed_seconds! >= 449 && rows[0].elapsed_seconds! < 455,
    );
    await control("end");
    assert.equal(
      (
        await db.query<Progress>(
          "select * from progress where participant_id=$1",
          [a],
        )
      ).rows[0].score,
      100,
    );
  } finally {
    await db.close();
  }
});

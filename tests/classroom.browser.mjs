import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { startFixture } from "./support/supabase-fixture.mjs";
const fixture = await startFixture();
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ],
  {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_classroom_test",
      SUPABASE_SECRET_KEY: "sb_secret_classroom_test",
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3001",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let serverOutput = "";
child.stdout.on("data", (d) => {
  serverOutput += d;
});
child.stderr.on("data", (d) => {
  serverOutput += d;
});
const base = "http://127.0.0.1:3001";
let browser;
async function until(fn) {
  for (let i = 0; i < 100; i++) {
    try {
      if (await fn()) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error("Timed out waiting for condition");
}
try {
  await until(async () => {
    try {
      return (await fetch(base)).ok;
    } catch {
      return false;
    }
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const errors = [];
  const teacherContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const teacher = await teacherContext.newPage();
  teacher.on("pageerror", (e) => errors.push(e.message));
  await teacher.goto(base);
  await teacher.getByRole("button", { name: "САБАҚ АШУ", exact: true }).click();
  await teacher.waitForURL("**/teacher/**");
  const roomId = teacher.url().split("/").pop();
  const code = (await teacher.locator(".large-room-code").innerText()).trim();
  assert.match(code, /^\d{6}$/);
  assert.equal(await teacher.locator(".qr-frame svg").count(), 1);
  const aContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const bContext = await browser.newContext({
    viewport: { width: 430, height: 900 },
    isMobile: true,
    hasTouch: true,
  });
  const a = await aContext.newPage(),
    b = await bContext.newPage();
  for (const page of [a, b])
    page.on("pageerror", (e) => errors.push(e.message));
  async function join(page, name) {
    await page.goto(`${base}/join?code=${code}`);
    await page.getByLabel("Атыңыз", { exact: true }).fill(name);
    await page.getByRole("button", { name: "СЫНЫПҚА ҚОСЫЛУ" }).click();
    await page.waitForURL("**/student/**");
    await page.locator(".student-pass").waitFor();
  }
  await join(a, "Айбек");
  await join(b, "Аружан");
  await until(
    async () => (await teacher.locator(".name-chips>span").count()) === 2,
  );
  const projector = await teacherContext.newPage();
  projector.on("pageerror", (e) => errors.push(e.message));
  await projector.goto(`${base}/projector/${roomId}`);
  await projector.locator(".projector-count").waitFor();
  assert.match(await projector.locator(".projector-count").innerText(), /2/);
  const outsider = await browser.newContext();
  let forbidden = await outsider.request.get(
    `${base}/api/rooms/${roomId}?role=teacher`,
  );
  assert.equal(forbidden.status(), 403);
  forbidden = await aContext.request.get(
    `${base}/api/rooms/${roomId}?role=teacher`,
  );
  assert.equal(forbidden.status(), 403);
  await mkdir("/tmp/tarihi-classroom-shots", { recursive: true });
  await teacher.screenshot({
    path: "/tmp/tarihi-classroom-shots/lobby.png",
    fullPage: true,
  });
  await projector.screenshot({
    path: "/tmp/tarihi-classroom-shots/projector-lobby.png",
    fullPage: true,
  });
  await teacher
    .getByRole("button", { name: "ОЙЫНДЫ БАСТАУ", exact: true })
    .click();
  await a.locator(".task-panel").waitFor();
  await b.locator(".task-panel").waitFor();
  // Pause is enforced in both UI and server; students cannot forge teacher commands.
  await teacher.getByRole("button", { name: "ҮЗІЛІС", exact: true }).click();
  await a
    .getByRole("heading", { name: "Мұғалім ойынды уақытша тоқтатты" })
    .waitFor();
  await b
    .getByRole("heading", { name: "Мұғалім ойынды уақытша тоқтатты" })
    .waitFor();
  let snap = await (
    await aContext.request.get(`${base}/api/rooms/${roomId}?role=student`)
  ).json();
  const forged = await aContext.request.post(`${base}/api/rooms/${roomId}`, {
    data: { action: "control", control: "resume", version: snap.room.version },
  });
  assert.equal(forged.status(), 403);
  const pausedAnswer = await aContext.request.post(
    `${base}/api/rooms/${roomId}`,
    {
      data: {
        action: "submit",
        requestId: crypto.randomUUID(),
        taskId: "rys",
        round: snap.room.round_id,
        mode: "individual",
        answer: { picks: [1] },
      },
    },
  );
  assert.equal(pausedAnswer.status(), 409);
  await teacher
    .getByRole("button", { name: "ЖАЛҒАСТЫРУ", exact: true })
    .click();
  await a.locator(".task-panel").waitFor();
  await teacher
    .getByLabel("Қазіргі миссияның ортақ сұрағы")
    .selectOption("rys");
  await teacher.getByRole("button", { name: "СЫНЫПҚА КӨРСЕТУ" }).click();
  await until(async () =>
    (await a.locator(".task-meta").innerText()).includes(
      "БҮКІЛ СЫНЫППЕН БІРГЕ",
    ),
  );
  await a.locator(".choice").nth(1).tap();
  await a.getByRole("button", { name: "ЖАУАПТЫ ЖІБЕРУ" }).tap();
  await a.getByText("ЖАУАБЫҢЫЗ ҚАБЫЛДАНДЫ", { exact: true }).waitFor();
  assert.equal(
    await teacher
      .getByRole("button", { name: "ДҰРЫС ЖАУАПТЫ КӨРСЕТУ" })
      .isDisabled(),
    true,
  );
  await b.locator(".choice").nth(0).tap();
  await b.getByRole("button", { name: "ЖАУАПТЫ ЖІБЕРУ" }).tap();
  await until(
    async () =>
      !(await teacher
        .getByRole("button", { name: "ДҰРЫС ЖАУАПТЫ КӨРСЕТУ" })
        .isDisabled()),
  );
  await until(async () =>
    (await projector.locator(".distribution-heading").innerText()).includes(
      "2 / 2",
    ),
  );
  const publicResponse = await (
    await teacherContext.request.get(
      `${base}/api/rooms/${roomId}?role=projector`,
    )
  ).json();
  assert.equal(publicResponse.students, undefined);
  assert.equal(publicResponse.responses, undefined);
  assert.equal(publicResponse.activeQuestion.answers, 2);
  assert.equal(publicResponse.activeQuestion.correct, 1);
  assert.equal(publicResponse.activeQuestion.answerText, undefined);
  assert.ok(!JSON.stringify(publicResponse).includes("Аружан"));
  assert.ok(!JSON.stringify(publicResponse).includes(snap.participant.id));
  assert.deepEqual(publicResponse.room.expected_participants, []);
  await teacher.getByRole("button", { name: "ДҰРЫС ЖАУАПТЫ КӨРСЕТУ" }).click();
  await projector.locator(".projector-explanation").waitFor();
  await b
    .getByText("Архив деректерін бірге қарастырайық.", { exact: true })
    .waitFor();
  await teacher.screenshot({
    path: "/tmp/tarihi-classroom-shots/dashboard.png",
    fullPage: true,
  });
  await projector.screenshot({
    path: "/tmp/tarihi-classroom-shots/projector-question.png",
    fullPage: true,
  });
  await teacher.getByRole("button", { name: "ЖЕКЕ ЗЕРТТЕУГЕ ОРАЛУ" }).click();
  await a
    .getByRole("heading", { name: "Сандар сөйлегенде", exact: true })
    .waitFor();
  await a.locator(".drag-card").filter({ hasText: "40 млн десятина" }).tap();
  await a
    .locator(".drop-zone")
    .filter({ has: a.locator("strong", { hasText: "Жер" }) })
    .tap();
  await a.reload();
  await a
    .getByRole("heading", { name: "Сандар сөйлегенде", exact: true })
    .waitFor();
  assert.equal(await a.locator(".placed").count(), 1);
  assert.match(await a.locator(".score").innerText(), /7/);
  // Offline answer survives the disconnect and is retried with one idempotency key.
  await b
    .getByRole("heading", { name: "Газет қиындысындағы құпия", exact: true })
    .waitFor();
  await b.locator(".choice").nth(1).tap();
  await bContext.setOffline(true);
  await b.getByRole("button", { name: "ТЕКСЕРУ", exact: true }).tap();
  await b
    .getByText("Жауап құрылғыда сақталды. Байланыс орнағанда жіберіледі.", {
      exact: true,
    })
    .waitFor();
  await bContext.setOffline(false);
  await b.locator(".student-feedback").waitFor();
  await b.getByRole("button", { name: "ЗЕРТТЕУДІ ЖАЛҒАСТЫРУ" }).tap();
  await b
    .getByRole("heading", { name: "Сандар сөйлегенде", exact: true })
    .waitFor();
  assert.match(await b.locator(".score").innerText(), /6/);
  assert.equal(
    await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  await a.screenshot({
    path: "/tmp/tarihi-classroom-shots/student-mobile.png",
    fullPage: true,
  });
  await teacher
    .getByRole("button", { name: "ЖАУАПТАРДЫ ЖАБУ", exact: true })
    .click();
  await until(
    async () =>
      await a
        .getByRole("button", { name: "ТЕКСЕРУ", exact: true })
        .isDisabled(),
  );
  await teacher
    .getByRole("button", { name: "ЖАУАПТАРДЫ АШУ", exact: true })
    .click();
  await until(
    async () =>
      !(await a
        .getByRole("button", { name: "ТЕКСЕРУ", exact: true })
        .isDisabled()),
  );
  await teacher
    .getByRole("button", { name: "КЕЛЕСІ МИССИЯ", exact: true })
    .click();
  await teacher.getByRole("button", { name: "РАСТАУ", exact: true }).click();
  await a
    .getByRole("heading", { name: "Талаптар қабырғасы", exact: true })
    .waitFor();
  await b
    .getByRole("heading", { name: "Талаптар қабырғасы", exact: true })
    .waitFor();
  await teacher
    .getByRole("button", { name: "САБАҚТЫ АЯҚТАУ", exact: true })
    .click();
  await teacher.getByRole("button", { name: "РАСТАУ", exact: true }).click();
  await teacher
    .getByRole("heading", { name: "Сабақ қорытындысы.", exact: true })
    .waitFor();
  await a.locator(".student-result").waitFor();
  await b.locator(".student-result").waitFor();
  await projector.locator(".class-summary").waitFor();
  await a.reload();
  await a.locator(".student-result").waitFor();
  assert.match(await a.locator(".result-score").innerText(), /7/);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result: "PASS",
      checks: [
        "room code and QR",
        "two isolated students",
        "realtime lobby",
        "synchronized start/pause/resume",
        "server pause enforcement",
        "teacher authorization",
        "class round distribution",
        "show-answer gating",
        "projector privacy",
        "individual drag/tap",
        "refresh persistence",
        "offline reconnect retry",
        "answer lock/unlock",
        "next mission",
        "end for all clients",
        "persisted personal results",
        "mobile overflow",
        "zero browser errors",
      ],
      backend:
        "Real migration in PGlite with a TEST-ONLY PostgREST/Phoenix adapter; hosted Supabase not tested",
    }),
  );
} catch (e) {
  console.error(serverOutput.slice(-8000));
  throw e;
} finally {
  if (browser) await browser.close();
  child.kill("SIGTERM");
  await fixture.close();
}

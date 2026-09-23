"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  Flag,
  GraduationCap,
  LockKeyhole,
  Monitor,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  UnlockKeyhole,
  Users,
} from "lucide-react";
import { missions } from "../data/historyData";
import { Header, Footer, Loading, RoomTimer } from "./ClassroomShared";
import { Metrics, Distribution, FinalClassStats } from "./Analytics";
import { send, useClassroom } from "../lib/useClassroom";
import type { Control, ResponseRow, QuestionStats } from "../lib/types";
function responseText(response: ResponseRow, questions: QuestionStats[]) {
  const a = response.answer;
  const task = questions.find((q) => q.id === response.task_id);
  return [
    a.picks?.map((i) => task?.options[i] || String(i)).join("; "),
    a.placements &&
      Object.entries(a.placements)
        .map(([text, group]) => `${text} → ${group}`)
        .join("; "),
    a.order?.join(" → "),
    a.visited?.join(", "),
    a.reflection,
    a.code,
  ]
    .filter(Boolean)
    .join(" · ");
}
export default function Teacher({ id }: { id: string }) {
  const { data, error, connected, channelReady, refresh } = useClassroom(
    id,
    "teacher",
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [tab, setTab] = useState<"students" | "questions">("students");
  const [confirm, setConfirm] = useState<Control | null>(null);
  useEffect(() => {
    if (data) {
      const configured = process.env.NEXT_PUBLIC_SITE_URL;
      const origin =
        configured && !configured.includes("localhost")
          ? configured
          : window.location.origin;
      setLink(`${origin.replace(/\/$/, "")}/join?code=${data.room.code}`);
    }
  }, [data?.room.code]);
  async function control(command: Control) {
    if (!data) return;
    setBusy(true);
    setActionError("");
    setConfirm(null);
    try {
      await send(`/api/rooms/${id}`, {
        action: "control",
        control: command,
        taskId: selected || undefined,
        version: data.room.version,
      });
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Әрекет орындалмады.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError("Төмендегі қосылу сілтемесін қолмен көшіріңіз.");
    }
  }
  if (!data)
    return (
      <div className="app-shell">
        <Header role="МҰҒАЛІМ" connected={connected} />
        <Loading error={error} onRetry={() => void refresh()} />
      </div>
    );
  const { room, stats, students = [], questions = [], responses = [] } = data;
  const active = data.activeQuestion;
  const classQuestions = questions.filter(
    (q) => q.mission === room.current_mission && q.type === "choice",
  );
  const member = students.find((s) => s.id === selectedStudent);
  const title =
    room.current_mission === 3
      ? "Құпия код"
      : missions[room.current_mission].short;
  return (
    <div className="app-shell">
      <Header
        role="МҰҒАЛІМНІҢ ЖЕКЕ ПАНЕЛІ"
        code={room.code}
        connected={connected}
        channelReady={channelReady}
      >
        <RoomTimer room={room} serverTime={data.serverTime} />
      </Header>
      <main className="teacher-page">
        <div className="teacher-top">
          <div>
            <span className="eyebrow">СЫНЫПТЫҚ ЗЕРТТЕУ · БАСҚАРУ ҮСТЕЛІ</span>
            <h1>
              {room.status === "lobby"
                ? "Зерттеушілерді жинаңыз."
                : room.status === "ended"
                  ? "Сабақ қорытындысы."
                  : title}
            </h1>
            <p>
              {room.status === "lobby"
                ? "Кодты немесе QR-ды көрсетіңіз. Оқушылар қосылған сайын тізім жаңарады."
                : "Жеке жауаптар осы панельде ғана көрінеді. Үлкен экранға проектор режимін ашыңыз."}
            </p>
          </div>
          <a
            href={`/projector/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="secondary"
          >
            <Monitor size={18} /> ПРОЕКТОР ЭКРАНЫ <ArrowRight size={16} />
          </a>
        </div>
        {(!connected || actionError) && (
          <div className="feedback retry" role="alert">
            {actionError || error || "Қайта қосылуда…"}
          </div>
        )}
        {room.status === "lobby" ? (
          <section className="teacher-lobby">
            <div className="room-invite">
              <div className="invite-copy">
                <span className="eyebrow">САБАҚҚА ҚОСЫЛУ КОДЫ</span>
                <div className="large-room-code">{room.code}</div>
                <p>
                  QR-кодты сканерлеңіз немесе
                  <br />
                  <strong>атыңыз + сабақ коды</strong> арқылы қосылыңыз.
                </p>
                <div className="copy-link">
                  <input
                    aria-label="Сабаққа қосылу сілтемесі"
                    readOnly
                    value={link}
                  />
                  <button
                    onClick={copy}
                    className="icon-btn"
                    aria-label="Сілтемені көшіру"
                  >
                    {copied ? <Check size={19} /> : <Copy size={19} />}
                  </button>
                </div>
              </div>
              <div className="qr-frame">
                {link && (
                  <QRCodeSVG
                    value={link}
                    size={176}
                    level="M"
                    title="Сабаққа қосылу QR-коды"
                  />
                )}
                <span>СКАНЕРЛЕ. ҚОСЫЛ. ЗЕРТТЕ.</span>
              </div>
            </div>
            <div className="lobby-list">
              <div className="lobby-list-heading">
                <h2>
                  <Users size={22} /> Сыныпқа қосылды: <b>{students.length}</b>
                </h2>
                <span className="live-dot">ТІКЕЛЕЙ</span>
              </div>
              {students.length ? (
                <div className="name-chips">
                  {students.map((s, i) => (
                    <span key={s.id}>
                      <i>{String(i + 1).padStart(2, "0")}</i>
                      {s.name}
                      <CheckCircle2 size={15} />
                    </span>
                  ))}
                </div>
              ) : (
                <div className="waiting-students">
                  <GraduationCap size={36} />
                  <p>Алғашқы зерттеушіні күтіп отырмыз.</p>
                </div>
              )}
              <button
                className="primary start-class"
                disabled={busy || !connected || !students.length}
                onClick={() => void control("start")}
              >
                <Play size={18} />
                {busy ? "БАСТАЛУДА…" : "ОЙЫНДЫ БАСТАУ"}
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
        ) : (
          <>
            {room.status === "ended" ? (
              <FinalClassStats stats={stats!} />
            ) : (
              <>
                <Metrics stats={stats!} />
                <section className="teacher-controls">
                  <div className="control-status">
                    <span
                      className={`status-dot ${room.status === "paused" ? "paused" : ""}`}
                    />
                    <strong>
                      {room.status === "paused"
                        ? "ҮЗІЛІС"
                        : room.mode === "class"
                          ? "ОРТАҚ ТАПСЫРМА"
                          : "ЖЕКЕ ЗЕРТТЕУ"}
                    </strong>
                    <span>
                      {room.current_mission < 3
                        ? `МИССИЯ ${room.current_mission + 1} / 3 · ${stats!.missionCompletion[room.current_mission]}% АЯҚТАДЫ`
                        : `ФИНАЛ · ${stats!.finished} ОҚУШЫ АЯҚТАДЫ`}
                    </span>
                  </div>
                  <div className="controls-row">
                    <button
                      className="secondary"
                      disabled={busy || !connected}
                      onClick={() =>
                        void control(
                          room.status === "paused" ? "resume" : "pause",
                        )
                      }
                    >
                      {room.status === "paused" ? (
                        <Play size={17} />
                      ) : (
                        <Pause size={17} />
                      )}{" "}
                      {room.status === "paused" ? "ЖАЛҒАСТЫРУ" : "ҮЗІЛІС"}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || !connected || room.answer_revealed}
                      onClick={() =>
                        void control(room.answers_locked ? "unlock" : "lock")
                      }
                    >
                      {room.answers_locked ? (
                        <UnlockKeyhole size={16} />
                      ) : (
                        <LockKeyhole size={16} />
                      )}{" "}
                      {room.answers_locked
                        ? "ЖАУАПТАРДЫ АШУ"
                        : "ЖАУАПТАРДЫ ЖАБУ"}
                    </button>
                    <button
                      className="secondary"
                      disabled={
                        busy || !connected || room.current_mission === 3
                      }
                      onClick={() => setConfirm("next_mission")}
                    >
                      КЕЛЕСІ МИССИЯ <ArrowRight size={17} />
                    </button>
                    <button
                      className="end-button"
                      disabled={busy || !connected}
                      onClick={() => setConfirm("end")}
                    >
                      <Flag size={16} /> САБАҚТЫ АЯҚТАУ
                    </button>
                  </div>
                </section>
                <section className="class-question-control">
                  <div>
                    <span className="eyebrow">БҮКІЛ СЫНЫППЕН ЗЕРТТЕУ</span>
                    <h2>Бір сұрақ. Әртүрлі көзқарас.</h2>
                    <p>
                      Ортақ сұрақ басталғанда жеке тапсырмалар уақытша күте
                      тұрады.
                    </p>
                  </div>
                  <div className="launch-question">
                    <label htmlFor="class-question">
                      Қазіргі миссияның ортақ сұрағы
                    </label>
                    <select
                      id="class-question"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                      disabled={busy || room.status !== "running"}
                    >
                      <option value="">Сұрақты таңдаңыз</option>
                      {classQuestions.map((q) => (
                        <option value={q.id} key={q.id}>
                          {q.title}
                        </option>
                      ))}
                    </select>
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        !connected ||
                        room.status !== "running" ||
                        !classQuestions.some((q) => q.id === selected)
                      }
                      onClick={() => void control("launch_question")}
                    >
                      <Radio size={17} /> СЫНЫПҚА КӨРСЕТУ
                    </button>
                  </div>
                </section>
                {room.mode === "class" && active && (
                  <section className="live-question">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">
                          ОРТАҚ СҰРАҚ · {room.round_id} АЙНАЛЫМ
                        </span>
                        <h2>{active.title}</h2>
                      </div>
                      <span className="points-tag">
                        {active.percentage}% дұрыс
                      </span>
                    </div>
                    <Distribution
                      question={active}
                      showCorrect={room.answer_revealed}
                    />
                    <div className="question-actions">
                      <button
                        className="primary"
                        disabled={
                          busy ||
                          !connected ||
                          room.answer_revealed ||
                          (!active.allAnswered && !room.answers_locked)
                        }
                        onClick={() => void control("reveal")}
                      >
                        <Eye size={17} /> ДҰРЫС ЖАУАПТЫ КӨРСЕТУ
                      </button>
                      <button
                        className="secondary"
                        disabled={busy || !connected}
                        onClick={() => void control("individual")}
                      >
                        ЖЕКЕ ЗЕРТТЕУГЕ ОРАЛУ <ArrowRight size={16} />
                      </button>
                    </div>
                    {!active.allAnswered && !room.answers_locked && (
                      <small className="muted">
                        Барлық жауап түскенде ашылады. Күту қажет болмаса,
                        алдымен жауаптарды жабыңыз.
                      </small>
                    )}
                    {data.revealedAnswer && (
                      <div className="feedback success">
                        <ShieldCheck size={26} />
                        <div>
                          <strong>{data.revealedAnswer.text}</strong>
                          <p>{data.revealedAnswer.explanation}</p>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
            <section className="private-monitor">
              <div className="monitor-tabs">
                <button
                  className={tab === "students" ? "active" : ""}
                  onClick={() => setTab("students")}
                >
                  <Users size={17} /> Оқушылар ({students.length})
                </button>
                <button
                  className={tab === "questions" ? "active" : ""}
                  onClick={() => setTab("questions")}
                >
                  <LayersIcon /> Сұрақтар статистикасы
                </button>
                <span>
                  <LockKeyhole size={13} /> Тек мұғалімге
                </span>
              </div>
              {tab === "students" ? (
                <div className="table-scroll">
                  <table className="student-table">
                    <thead>
                      <tr>
                        <th>Оқушы</th>
                        <th>Ұпай</th>
                        <th>Миссия</th>
                        <th>Қазіргі тапсырма</th>
                        <th>Прогресс</th>
                        <th>Күйі</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <button
                              className="student-name"
                              onClick={() =>
                                setSelectedStudent(
                                  selectedStudent === s.id ? null : s.id,
                                )
                              }
                            >
                              {s.name}
                              <ArrowRight size={13} />
                            </button>
                          </td>
                          <td>
                            <b>{s.progress.score}</b>
                            <small> / 100</small>
                          </td>
                          <td>0{s.mission + 1}</td>
                          <td>
                            {questions.find(
                              (q) => q.id === s.progress.current_task,
                            )?.title || "Архивті ашуда"}
                          </td>
                          <td>
                            <div className="table-progress">
                              <span>{s.completion}%</span>
                              <i>
                                <b style={{ width: `${s.completion}%` }} />
                              </i>
                            </div>
                          </td>
                          <td>
                            <span className={`student-status ${s.status}`}>
                              {s.status === "finished"
                                ? "Аяқтады"
                                : s.status === "incomplete"
                                  ? "Аяқталмаған"
                                  : s.status === "offline"
                                    ? "Байланыс жоқ"
                                    : s.status === "waiting"
                                      ? "Күтуде"
                                      : "Белсенді"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!students.length && (
                    <p className="empty-table">Оқушылар әлі қосылған жоқ.</p>
                  )}
                </div>
              ) : (
                <div className="question-list">
                  {questions.map((q) => (
                    <details key={q.id} className="question-stat">
                      <summary>
                        <span>
                          <i>0{q.mission + 1}</i>
                          {q.title}
                        </span>
                        <b>{q.answers} жауап</b>
                        <span>
                          {q.correct} дұрыс · {q.incorrect} қате
                        </span>
                        <strong>{q.percentage}%</strong>
                      </summary>
                      <Distribution question={q} />
                      <div className="answer-key">
                        <strong>Мұғалімге арналған жауап</strong>
                        <p>{q.answerText}</p>
                        <small>{q.explanation}</small>
                      </div>
                    </details>
                  ))}
                </div>
              )}
              {member && tab === "students" && (
                <section className="private-responses">
                  <div className="section-heading">
                    <h3>{member.name} · Жеке жауаптар</h3>
                    <button
                      className="text-btn"
                      onClick={() => setSelectedStudent(null)}
                    >
                      Жабу
                    </button>
                  </div>
                  {responses
                    .filter((r) => r.participant_id === member.id)
                    .map((r) => (
                      <article key={r.id}>
                        <div>
                          <strong>
                            {questions.find((q) => q.id === r.task_id)?.title}
                          </strong>
                          <span
                            className={r.correct ? "positive" : "needs-review"}
                          >
                            {r.correct ? "Дұрыс" : "Қайта қарау"} · +{r.points}
                          </span>
                        </div>
                        <p>{responseText(r, questions)}</p>
                      </article>
                    ))}
                  {!responses.some((r) => r.participant_id === member.id) && (
                    <p>Әзірге жауап берілген жоқ.</p>
                  )}
                </section>
              )}
            </section>
          </>
        )}
        {confirm && (
          <div className="confirm-panel" role="alert">
            <div>
              <strong>
                {confirm === "end"
                  ? "Сабақты аяқтайсыз ба?"
                  : "Келесі миссияны ашасыз ба?"}
              </strong>
              <p>
                {confirm === "end"
                  ? "Жауап қабылдау тоқтап, әр оқушы өз нәтижесін көреді. Бұл әрекет қайтарылмайды."
                  : "Барлық оқушы келесі архивке өтеді. Орындалмаған тапсырмаларға ұпай берілмейді."}
              </p>
            </div>
            <button className="secondary" onClick={() => setConfirm(null)}>
              БАС ТАРТУ
            </button>
            <button className="primary" onClick={() => void control(confirm)}>
              РАСТАУ <ArrowRight size={16} />
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
function LayersIcon() {
  return <CheckCircle2 size={17} />;
}

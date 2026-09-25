"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Compass,
  Fingerprint,
  HelpCircle,
  KeyRound,
  LockKeyhole,
  Pause,
  ShieldCheck,
  Star,
  Volume2,
  VolumeX,
  WifiOff,
  SkipForward,
} from "lucide-react";
import { missions, studiedTopics, topicTaskIds } from "../data/historyData";
import type { Draft } from "../gameLogic";
import { Header, Footer, Loading, RoomTimer } from "./ClassroomShared";
import TaskView from "./TaskView";
import { RequestError, send, useClassroom } from "../lib/useClassroom";
import type { Task } from "../data/historyData";
import { newRequestId } from "../lib/requestId";
type Pending = {
  action: "submit";
  requestId: string;
  taskId: string;
  round: number;
  mode: "class" | "individual";
  answer: Draft & { code?: string };
};
type Feedback = {
  correct: boolean;
  points: number;
  explanation?: string;
  task: Task;
};
function store(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Server state remains the source of truth if local persistence is blocked. */
  }
}
function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") as T | null;
  } catch {
    return null;
  }
}
export default function Student({ id }: { id: string }) {
  const { data, error, connected, channelReady, refresh } = useClassroom(
    id,
    "student",
  );
  const [drafts, setDrafts] = useState<
    Record<string, Draft & { code?: string }>
  >({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hint, setHint] = useState(false);
  const [sound, setSound] = useState(false);
  const [topics, setTopics] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const sending = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const taskRef = useRef<Task | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const participantId = data?.participant?.id;
  const key = `tm-drafts:${id}:${participantId || ""}`,
    queueKey = `tm-pending:${id}:${participantId || ""}`;
  const task = data?.task || null;
  taskRef.current = task;
  useEffect(() => {
    if (!participantId) return;
    setDrafts(read<Record<string, Draft>>(key) || {});
    const queued = read<Pending>(queueKey);
    setPending(queued);
    pendingRef.current = queued;
    setHydrated(true);
  }, [participantId, key, queueKey]);
  useEffect(() => {
    setHint(false);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [task?.id, data?.room.round_id]);
  useEffect(() => {
    setFeedback(null);
  }, [data?.room.round_id, data?.room.current_mission]);
  const ping = useCallback(
    (correct: boolean) => {
      if (!sound) return;
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
        const osc = audio.current.createOscillator(),
          gain = audio.current.createGain();
        osc.connect(gain);
        gain.connect(audio.current.destination);
        osc.frequency.value = correct ? 620 : 230;
        gain.gain.setValueAtTime(0.035, audio.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audio.current.currentTime + 0.2,
        );
        osc.start();
        osc.stop(audio.current.currentTime + 0.2);
      } catch {
        /* Sound is optional. */
      }
    },
    [sound],
  );
  const flush = useCallback(async () => {
    const queued = pendingRef.current;
    if (!queued || sending.current || !navigator.onLine) return;
    sending.current = true;
    setBusy(true);
    try {
      const result = await send(`/api/rooms/${id}`, queued);
      pendingRef.current = null;
      setPending(null);
      store(queueKey, null);
      setMessage("");
      const current = taskRef.current;
      if (result.correct !== null && current?.id === queued.taskId) {
        ping(result.correct);
        if (result.correct)
          setFeedback({
            correct: true,
            points: result.points,
            explanation: result.explanation,
            task: current,
          });
        else
          setMessage(
            result.correction
              ? `Қате жауап. Дұрыс жауап: ${result.correction}`
              : "Қате жауап. Архив деректеріне назар аударыңыз.",
          );
      }
      await refresh();
    } catch (e) {
      if (e instanceof RequestError && e.status >= 400 && e.status < 500) {
        pendingRef.current = null;
        setPending(null);
        store(queueKey, null);
        setMessage(e.message);
        await refresh();
      } else setMessage("Қайта қосылуда… Жауабыңыз осы құрылғыда сақталды.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }, [id, queueKey, refresh, ping]);
  useEffect(() => {
    if (!hydrated) return;
    void flush();
    const retry = () => void flush();
    window.addEventListener("online", retry);
    const timer = setInterval(retry, 5000);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(timer);
    };
  }, [hydrated, flush]);
  const update = (part: Partial<Draft> & { code?: string }) => {
    if (!task || !data) return;
    setDrafts((current) => {
      const next = {
        ...current,
        [task.id]: {
          ...(current[task.id] || data.progress?.drafts[task.id] || {}),
          ...part,
        },
      };
      store(key, next);
      return next;
    });
  };
  const draft = task
    ? drafts[task.id] || data?.progress?.drafts[task.id] || {}
    : {};
  const serialized = JSON.stringify(draft);
  useEffect(() => {
    if (
      !hydrated ||
      !task ||
      !drafts[task.id] ||
      !connected ||
      pendingRef.current
    )
      return;
    const taskId = task.id;
    const timer = setTimeout(() => {
      void send(`/api/rooms/${id}`, {
        action: "draft",
        taskId,
        draft: JSON.parse(serialized),
      }).catch(() => {});
    }, 650);
    return () => clearTimeout(timer);
  }, [serialized, hydrated, task?.id, connected, id]);
  const submit = () => {
    if (!task || !data || pendingRef.current || busy) return;
    const request: Pending = {
      action: "submit",
      requestId: newRequestId(),
      taskId: task.id,
      round: data.room.round_id,
      mode: data.room.mode,
      answer: draft,
    };
    pendingRef.current = request;
    setPending(request);
    store(queueKey, request);
    setMessage(
      navigator.onLine ? "" : "Қайта қосылуда… Жауабыңыз құрылғыда сақталды.",
    );
    void flush();
  };
  const skip = async () => {
    if (!task || !data || blocked || room.mode !== "individual") return;
    if (!window.confirm("Бұл тапсырманы 0 ұпаймен өткізіп жібересіз бе?"))
      return;
    setBusy(true);
    setMessage("");
    try {
      await send(`/api/rooms/${id}`, {
        action: "skip",
        taskId: task.id,
        progressVersion: data.progress!.version,
      });
      setFeedback(null);
      await refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Тапсырманы өткізу мүмкін болмады.",
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return (
      <div className="app-shell">
        <Header role="ОҚУШЫ" connected={connected} />
        <Loading error={error} onRetry={() => void refresh()} />
      </div>
    );
  const { room, participant, progress } = data;
  if (!participant || !progress)
    return <Loading error="Оқушы деректері табылмады." />;
  const paused = room.status === "paused",
    ended = room.status === "ended" || !!progress.finished_at;
  const blocked =
    paused || room.answers_locked || busy || !!pending || !hydrated;
  const score = progress.score;
  const rank =
    score >= 90
      ? "Тарих шебері"
      : score >= 70
        ? "Тарих зерттеушісі"
        : score >= 50
          ? "Архив зерттеушісі"
          : "Тарихи ізденісті жалғастыр";
  const isLate =
    room.mode === "class" &&
    !room.expected_participants.includes(participant.id);
  return (
    <div className="app-shell">
      <Header
        role={participant.name}
        code={room.code}
        connected={connected}
        channelReady={channelReady}
      >
        <RoomTimer room={room} serverTime={data.serverTime} />
        <span className="score">
          <Star size={16} />
          {score}
          <small>/100</small>
        </span>
        <button
          className="sound-btn"
          aria-label={sound ? "Дыбысты өшіру" : "Дыбысты қосу"}
          aria-pressed={sound}
          onClick={() => setSound(!sound)}
        >
          {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
      </Header>
      {!connected && (
        <div className="notice" role="status">
          <WifiOff size={17} /> Қайта қосылуда… Ұпай мен прогресс серверде
          сақталған.
        </div>
      )}
      {room.status === "lobby" ? (
        <main className="student-lobby">
          <div className="student-pass">
            <span className="eyebrow">ЗЕРТТЕУШІ КУӘЛІГІ</span>
            <div className="pass-seal">
              <Fingerprint size={55} strokeWidth={1} />
            </div>
            <h1>
              {participant.name},<br />
              сіз қосылдыңыз.
            </h1>
            <p>Мұғалім ойынды бастағанша күтіңіз.</p>
            <div className="pass-code">
              <span>СЫНЫП КОДЫ</span>
              <strong>{room.code}</strong>
              <CheckCircle2 size={23} />
            </div>
            <div className="waiting-pulse">
              <i />
              <i />
              <i />
            </div>
            <small>Ойын осы экранда автоматты түрде басталады.</small>
          </div>
        </main>
      ) : ended ? (
        <main className="result student-result">
          <span className="eyebrow">
            {progress.finished_at
              ? "МИССИЯ ОРЫНДАЛДЫ"
              : "МҰҒАЛІМ САБАҚТЫ АЯҚТАДЫ"}
          </span>
          <div className="result-medal">
            <ShieldCheck size={43} strokeWidth={1.2} />
          </div>
          <h1>{participant.name}, зерттеуіңіз сақталды.</h1>
          <p>
            Бұл — сіздің жеке нәтижеңіз. Сынып экранында тек ортақ статистика
            көрсетіледі.
          </p>
          <div className="result-score">
            {score}
            <span>/ 100</span>
          </div>
          <h2>{rank}</h2>
          <p>{progress.completed_tasks} / 18 тапсырма орындалды</p>
          <div className="score-breakdown">
            {[
              ...missions.map((m) => ({ title: m.short, points: m.points })),
              { title: "Құпия код", points: 10 },
            ].map((m, i) => (
              <div key={m.title}>
                <span>{m.title}</span>
                <strong>
                  {i === 3
                    ? progress.awards.final || 0
                    : Object.entries(progress.awards)
                        .filter(
                          ([taskId]) =>
                            (
                              ({
                                rys: 0,
                                stats: 0,
                                pyramid: 0,
                                petition: 1,
                                concept: 1,
                                karataev: 1,
                                results: 1,
                                law: 1,
                                decree: 2,
                                "decree-link": 2,
                                source: 2,
                                causes: 2,
                                groups: 2,
                                map: 2,
                                regions: 2,
                                timeline: 2,
                                reflection: 2,
                              }) as Record<string, number>
                            )[taskId] === i,
                        )
                        .reduce((sum, [, points]) => sum + points, 0)}
                  <small> / {m.points}</small>
                </strong>
              </div>
            ))}
          </div>
          <button
            className="primary result-topics"
            onClick={() => setTopics(!topics)}
          >
            <BookOpen size={17} />{" "}
            {topics ? "ТАҚЫРЫПТАРДЫ ЖАСЫРУ" : "ЗЕРТТЕУ ТАҚЫРЫПТАРЫ"}
          </button>
          {topics && (
            <div className="result-details">
              <h3>Сабақтың тарихи тізбегі</h3>
              <div>
                {studiedTopics.map((t, i) => (
                  <p
                    key={t}
                    className={
                      Object.hasOwn(progress.awards, topicTaskIds[i])
                        ? "topic-done"
                        : "topic-pending"
                    }
                  >
                    {Object.hasOwn(progress.awards, topicTaskIds[i]) ? (
                      <Check size={15} />
                    ) : (
                      <LockKeyhole size={15} />
                    )}{" "}
                    {t}
                  </p>
                ))}
              </div>
              {progress.drafts.reflection?.reflection && (
                <blockquote>{progress.drafts.reflection.reflection}</blockquote>
              )}
            </div>
          )}
        </main>
      ) : (
        <main className="student-workspace">
          <nav
            className="student-missions"
            aria-label="Сыныптың қазіргі миссиясы"
          >
            {[...missions.map((m) => m.short), "Құпия код"].map((m, i) => (
              <span
                key={m}
                className={
                  room.current_mission === i
                    ? "active"
                    : room.current_mission > i
                      ? "passed"
                      : ""
                }
              >
                <b>{String(i + 1).padStart(2, "0")}</b>
                <span>{m}</span>
              </span>
            ))}
          </nav>
          {paused ? (
            <section className="student-wait">
              <Pause size={47} strokeWidth={1} />
              <h1>Мұғалім ойынды уақытша тоқтатты</h1>
              <p>
                Жауаптарыңыз сақталды. Зерттеу мұғалім жалғастырғанда ашылады.
              </p>
            </section>
          ) : feedback ? (
            <section className="student-feedback">
              <div className="transition-stamp">
                <ShieldCheck size={38} />
                <span>ДЕРЕК АШЫЛДЫ</span>
              </div>
              <h1>{feedback.task.title}</h1>
              <div className="earned-score">+{feedback.points} ұпай</div>
              <p>{feedback.explanation}</p>
              <button className="primary" onClick={() => setFeedback(null)}>
                ЗЕРТТЕУДІ ЖАЛҒАСТЫРУ <ArrowRight size={18} />
              </button>
            </section>
          ) : isLate ? (
            <section className="student-wait">
              <Compass size={45} />
              <h1>Ортақ зерттеуді бақылаңыз.</h1>
              <p>
                Бұл сұрақ сіз қосылғанға дейін ашылған. Мұғалім жеке зерттеуді
                немесе келесі сұрақты ашқанда қатыса аласыз.
              </p>
            </section>
          ) : room.mode === "class" && data.submitted ? (
            <section className="student-feedback">
              <CheckCircle2 size={47} strokeWidth={1} />
              <span className="eyebrow">ЖАУАБЫҢЫЗ ҚАБЫЛДАНДЫ</span>
              <h1>{task?.title}</h1>
              {data.revealedAnswer ? (
                <>
                  <div
                    className={`feedback ${data.submitted.correct ? "success" : "retry"}`}
                  >
                    <ShieldCheck size={24} />
                    <div>
                      <strong>
                        {data.submitted.correct
                          ? "Дұрыс байланыс таптыңыз."
                          : "Архив деректерін бірге қарастырайық."}
                      </strong>
                      <p>{data.revealedAnswer.text}</p>
                      <p>{data.revealedAnswer.explanation}</p>
                    </div>
                  </div>
                  <p>Мұғалім келесі тапсырманы ашқанша күтіңіз.</p>
                </>
              ) : (
                <p>
                  Сыныптың жауабын күтеміз. Мұғалім тарихи түсіндірмені ортақ
                  экранда ашады.
                </p>
              )}
            </section>
          ) : !task ? (
            <section className="student-wait">
              <ShieldCheck size={48} strokeWidth={1} />
              <span className="eyebrow">
                АРХИВ № 0{room.current_mission + 1} ЗЕРТТЕЛДІ
              </span>
              <h1>Келесі архивті күтеміз.</h1>
              <p>{missions[room.current_mission]?.summary}</p>
              <small>Мұғалім келесі миссияны бүкіл сыныпқа ашады.</small>
            </section>
          ) : (
            <section className="task-panel">
              <div className="task-meta">
                <span className="eyebrow">
                  {room.mode === "class"
                    ? "БҮКІЛ СЫНЫППЕН БІРГЕ"
                    : "ЖЕКЕ АРХИВТІК ЗЕРТТЕУ"}{" "}
                  · МИССИЯ 0{room.current_mission + 1}
                </span>
                <span className="points-tag">
                  <Star size={14} />
                  {task.points} ұпай
                </span>
              </div>
              <h1>{task.title}</h1>
              <p className="task-subtitle">{task.subtitle}</p>
              {room.answers_locked && (
                <div className="notice">
                  <LockKeyhole size={16} /> Мұғалім жауап қабылдауды жапты.
                  {data.revealedAnswer && (
                    <span> Дұрыс жауап: {data.revealedAnswer.text}</span>
                  )}
                </div>
              )}
              {task.id === "final" ? (
                <form
                  className="student-code-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                >
                  <div className="vault-icon">
                    <LockKeyhole size={53} strokeWidth={1} />
                  </div>
                  <label htmlFor="final-code">ТӨРТ ТАҢБАЛЫ ҚҰПИЯ КОД</label>
                  <input
                    id="final-code"
                    className="code-input"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    value={(draft as Draft & { code?: string }).code || ""}
                    onChange={(e) =>
                      update({ code: e.target.value.replace(/\D/g, "") })
                    }
                    disabled={blocked}
                    placeholder="– – – –"
                    required
                  />
                  <button className="primary" disabled={blocked}>
                    <KeyRound size={17} /> АРХИВТІ АШУ
                  </button>
                </form>
              ) : (
                <TaskView
                  key={`${task.id}:${room.round_id}`}
                  task={task}
                  draft={draft}
                  update={update}
                  disabled={blocked}
                />
              )}
              <div role="status" aria-live="polite">
                {message && (
                  <div className="feedback retry">
                    <HelpCircle size={18} />
                    {message}
                  </div>
                )}
                {pending && (
                  <div className="notice">
                    {busy
                      ? "Жауап серверге жіберілуде…"
                      : "Жауап құрылғыда сақталды. Байланыс орнағанда жіберіледі."}
                  </div>
                )}
              </div>
              {(hint || (data.attempts || 0) >= 2) && (
                <div className="hint">
                  <HelpCircle size={17} />
                  {task.hint}
                </div>
              )}
              {task.id !== "final" && (
                <div className="task-actions">
                  <div className="task-secondary-actions">
                    <button className="text-btn" onClick={() => setHint(!hint)}>
                      <HelpCircle size={17} /> Көмек
                    </button>
                    {room.mode === "individual" && (
                      <button
                        className="text-btn"
                        disabled={blocked}
                        onClick={() => void skip()}
                      >
                        <SkipForward size={17} /> ӨТКІЗІП ЖІБЕРУ
                      </button>
                    )}
                  </div>
                  <button
                    className="primary"
                    disabled={blocked}
                    onClick={submit}
                  >
                    {busy
                      ? "ЖІБЕРІЛУДЕ…"
                      : room.mode === "class"
                        ? "ЖАУАПТЫ ЖІБЕРУ"
                        : "ТЕКСЕРУ"}
                    <ArrowRight size={17} />
                  </button>
                </div>
              )}
              {task.id === "final" && room.mode === "individual" && (
                <button
                  className="text-btn skip-final"
                  disabled={blocked}
                  onClick={() => void skip()}
                >
                  <SkipForward size={17} /> ӨТКІЗІП ЖІБЕРУ
                </button>
              )}
            </section>
          )}
        </main>
      )}
      <Footer />
    </div>
  );
}

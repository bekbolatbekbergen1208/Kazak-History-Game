"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Compass, Pause, ShieldCheck, Users } from "lucide-react";
import { missions } from "../data/historyData";
import { ArchiveMap } from "../ArchiveMap";
import { Header, Footer, Loading, RoomTimer } from "./ClassroomShared";
import { Distribution, FinalClassStats, Metrics } from "./Analytics";
import { send, useClassroom } from "../lib/useClassroom";
export default function Projector({
  id,
  accessKey,
}: {
  id: string;
  accessKey?: string;
}) {
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [link, setLink] = useState("");
  const { data, error, connected, channelReady, refresh } = useClassroom(
    id,
    "projector",
    ready,
  );
  useEffect(() => {
    let alive = true;
    send(`/api/rooms/${id}`, { action: "projector_enter", key: accessKey })
      .then(() => {
        if (alive) {
          setReady(true);
          window.history.replaceState(null, "", `/projector/${id}`);
        }
      })
      .catch((e) => {
        if (alive) setAuthError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [id, accessKey]);
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
  if (!data)
    return (
      <div className="app-shell">
        <Header role="ПРОЕКТОР · АНОНИМДІ ЭКРАН" />
        <Loading
          error={authError || error}
          onRetry={() => {
            if (ready) void refresh();
            else window.location.reload();
          }}
        />
      </div>
    );
  const { room, stats, activeQuestion } = data;
  return (
    <div className="app-shell projector">
      <Header
        role="СЫНЫПТЫҢ ОРТАҚ ЭКРАНЫ"
        code={room.code}
        connected={connected}
        channelReady={channelReady}
      >
        <RoomTimer room={room} serverTime={data.serverTime} />
      </Header>
      <main className="projector-page">
        {room.status === "lobby" ? (
          <section className="projector-lobby">
            <div>
              <span className="eyebrow">ТАРИХИ ЗЕРТТЕУГЕ ҚОШ КЕЛДІҢІЗ</span>
              <h1>
                Бірге тарихты
                <br />
                <em>ашайық.</em>
              </h1>
              <p>
                Телефоннан QR-ды сканерлеңіз.
                <br />
                Атыңызды жазыңыз. Зерттеуге қосылыңыз.
              </p>
              <span className="eyebrow">САБАҚ КОДЫ</span>
              <div className="large-room-code">{room.code}</div>
              <div className="projector-count">
                <Users size={26} />
                <b>{stats!.totalStudents}</b> зерттеуші қосылды{" "}
                <span className="live-dot">ТІКЕЛЕЙ</span>
              </div>
            </div>
            <div className="projector-qr">
              <div className="qr-frame">
                {link && (
                  <QRCodeSVG
                    value={link}
                    size={270}
                    level="M"
                    title="Сабаққа қосылу QR-коды"
                  />
                )}
              </div>
              <p>{link}</p>
              <span>
                <Compass size={17} /> МҰҒАЛІМНІҢ БЕЛГІСІН КҮТІҢІЗ
              </span>
            </div>
          </section>
        ) : room.status === "ended" ? (
          <FinalClassStats stats={stats!} />
        ) : (
          <>
            <div className="projector-heading">
              <span className="eyebrow">
                АРХИВ № 0{room.current_mission + 1} · СЫНЫПТЫҚ ЗЕРТТЕУ
              </span>
              <h1>
                {room.mode === "class"
                  ? activeQuestion?.title
                  : room.current_mission === 3
                    ? "Тарихтың құпия коды"
                    : missions[room.current_mission].title}
              </h1>
              <p>
                {room.mode === "class"
                  ? "Жауабыңызды телефоныңыздан беріңіз. Нәтижелер анонимді көрсетіледі."
                  : "Әр зерттеуші өз архивін ашады. Бірге тарихи тізбекті қалпына келтіреміз."}
              </p>
            </div>
            {room.mode === "class" && activeQuestion ? (
              <section className="projector-question">
                <Distribution question={activeQuestion} />
                {data.revealedAnswer && (
                  <div className="projector-explanation">
                    <ShieldCheck size={34} />
                    <div>
                      <span className="eyebrow">ТАРИХИ ДЕРЕК</span>
                      <h2>{data.revealedAnswer.text}</h2>
                      <p>{data.revealedAnswer.explanation}</p>
                    </div>
                  </div>
                )}
                {room.answers_locked && !room.answer_revealed && (
                  <p className="projector-wait">
                    Жауаптар қабылданды. Тарихи деректі бірге талқылаймыз.
                  </p>
                )}
              </section>
            ) : (
              <div className="projector-individual">
                <ArchiveMap />
                <div>
                  <Metrics stats={stats!} />
                  <div className="projector-progress">
                    <span>СЫНЫПТЫҢ ОРТАҚ ПРОГРЕСІ</span>
                    <strong>{stats!.completion}%</strong>
                    <div className="distribution-track">
                      <i style={{ width: `${stats!.completion}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {room.status === "paused" && (
              <div className="projector-pause">
                <Pause size={35} />
                <h2>Зерттеуге қысқа үзіліс</h2>
                <p>Мұғалім ойынды уақытша тоқтатты.</p>
              </div>
            )}
          </>
        )}
        <div className="projector-privacy">
          <ShieldCheck size={15} /> Жеке жауаптар мен оқушылардың ұпайлары бұл
          экранда көрсетілмейді.
        </div>
      </main>
      <Footer />
    </div>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Compass, Wifi, WifiOff, Clock3, ArrowLeft } from "lucide-react";
import type { Room } from "../lib/types";
export function Header({
  role,
  code,
  connected = true,
  channelReady = true,
  children,
}: {
  role: string;
  code?: string;
  connected?: boolean;
  channelReady?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="site-header classroom-header">
      <Link href="/" className="brand">
        <span className="brand-symbol">
          <Compass size={27} />
        </span>
        <span>
          ТАРИХИ МИССИЯ<small>СЫНЫПТЫҚ ТАРИХИ ЗЕРТТЕУ</small>
        </span>
      </Link>
      <span className="role-label">{role}</span>
      {code && (
        <span className="header-room">
          КОД <b>{code}</b>
        </span>
      )}
      <div className="header-tools">
        {children}
        <span
          className={`connection ${!connected ? "offline" : ""}`}
          title={
            !connected
              ? "Қайта қосылуда…"
              : channelReady
                ? "Тікелей байланыс"
                : "Байланыс қалпына келуде; автоматты жаңарту қосулы"
          }
        >
          {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>
            {!connected
              ? "Қайта қосылуда…"
              : channelReady
                ? "LIVE"
                : "СИНХРОНДАУ"}
          </span>
        </span>
      </div>
    </header>
  );
}
export function RoomTimer({
  room,
  serverTime,
}: {
  room: Room;
  serverTime: number;
}) {
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    setOffset(serverTime - Date.now());
  }, [serverTime]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const base =
    room.status === "paused" && room.paused_at
      ? Date.parse(room.paused_at)
      : room.status === "ended" && room.ended_at
        ? Date.parse(room.ended_at)
        : now + offset;
  const remaining = room.deadline_at
    ? Math.max(0, Math.ceil((Date.parse(room.deadline_at) - base) / 1000))
    : 720;
  return (
    <span
      className={`timer ${remaining < 60 ? "low" : ""}`}
      title={
        remaining === 0
          ? "Уақыт аяқталды. Сабақ мұғалім аяқтағанша жалғасады."
          : "Сыныптың ортақ уақыты"
      }
    >
      <Clock3 size={16} />
      {String(Math.floor(remaining / 60)).padStart(2, "0")}:
      {String(remaining % 60).padStart(2, "0")}
      {remaining === 0 && room.status !== "ended" && (
        <span className="time-over-note" role="status">
          Уақыт аяқталды, бірақ миссияны аяқтай аласыз.
        </span>
      )}
    </span>
  );
}
export function Loading({
  error,
  onRetry,
}: {
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <main className="class-empty">
      <Compass size={48} strokeWidth={1} />
      <h1>{error ? "Архивке қосылу" : "Сыныппен байланыс орнатылуда…"}</h1>
      <p>{error || "Сабақтың соңғы күйін жүктеп жатырмыз."}</p>
      {onRetry && (
        <button className="primary" onClick={onRetry}>
          ҚАЙТА ҚОСЫЛУ
        </button>
      )}
      <Link href="/" className="text-btn">
        <ArrowLeft size={16} /> Басты бетке
      </Link>
    </main>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <span>
        <Compass size={16} />
        ТАРИХИ МИССИЯ
      </span>
      <p>Өткенді түсін. Бірге зертте.</p>
      <span>Қазақстан · 1900–1916</span>
    </footer>
  );
}
export function percent(value: number) {
  return Math.max(0, Math.min(100, value));
}

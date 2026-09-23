"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Fingerprint, Users } from "lucide-react";
import { send } from "../lib/useClassroom";
import { Header, Footer } from "./ClassroomShared";
export default function Join({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode.replace(/\D/g, "").slice(0, 6));
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await send("/api/classroom", {
        action: "join",
        code,
        name,
      });
      router.push(`/student/${result.roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Қосылу мүмкін болмады.");
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <Header role="ОҚУШЫ РЕЖИМІ" />
      <main className="join-page">
        <section className="join-card">
          <span className="eyebrow">АРХИВКЕ КІРУ РҰҚСАТЫ</span>
          <Fingerprint
            size={49}
            strokeWidth={1.2}
            className="join-fingerprint"
          />
          <h1>Зерттеуге қосылыңыз.</h1>
          <p>Атыңызды және мұғалім көрсеткен кодты енгізіңіз.</p>
          <form onSubmit={join}>
            <label htmlFor="student-name">Атыңыз</label>
            <input
              id="student-name"
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={32}
              placeholder="Мысалы, Айбек"
              required
              disabled={busy}
            />
            <label htmlFor="room-code">Room Code · Сабақ коды</label>
            <input
              id="room-code"
              className="join-code"
              autoComplete="off"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              required
              disabled={busy}
            />
            {error && (
              <div className="feedback retry" role="alert">
                {error}
              </div>
            )}
            <button className="primary full" disabled={busy}>
              <Users size={18} />
              {busy ? "ҚОСЫЛУДА…" : "СЫНЫПҚА ҚОСЫЛУ"}
              <ArrowRight size={18} />
            </button>
          </form>
          <small>Тіркелу қажет емес. Жауабыңыз тек мұғалімге көрінеді.</small>
        </section>
      </main>
      <Footer />
    </div>
  );
}

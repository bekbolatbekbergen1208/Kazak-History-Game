"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Fingerprint,
  FolderOpen,
  GraduationCap,
  KeyRound,
  Layers,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { ArchiveMap } from "../ArchiveMap";
import { missions } from "../data/historyData";
import { Header, Footer } from "./ClassroomShared";
import { send } from "../lib/useClassroom";
export default function Home({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await send("/api/classroom", { action: "create" });
      router.push(`/teacher/${result.roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сабақ ашылмады.");
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <Header role="СЫНЫППЕН БІРГЕ" />
      <main className="landing">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow hero-eyebrow">
              <span /> БІР СЫНЫП. ҮШ АРХИВ. ОРТАҚ ТАРИХ.
            </div>
            <h1>
              Тарихты оқыма.
              <br />
              Бірге <em>зертте.</em>
            </h1>
            <div className="hero-period">
              <span />
              ҚАЗАҚСТАН <b>1900–1916</b>
            </div>
            <p className="hero-description">
              Мұғалім архивті ашады. Сынып зерттеуге қосылады.
              <br />
              Құжаттар, тарихи карта және бір құпия код —<br />
              әр оқушының телефонында, бір ортақ сабақта.
            </p>
            <div className="role-actions">
              <button
                className="primary hero-cta"
                onClick={create}
                disabled={busy}
              >
                <GraduationCap size={20} />
                {busy ? "САБАҚ АШЫЛУДА…" : "САБАҚ АШУ"}
                <ArrowUpRight size={18} />
              </button>
              <Link href="/join" className="secondary">
                <Users size={18} /> ОҚУШЫ РЕТІНДЕ ҚОСЫЛУ
              </Link>
            </div>
            <div className="hero-stats">
              <span>
                <Clock3 size={15} />
                12 минут
              </span>
              <i />
              <span>
                <Layers size={15} />3 миссия
              </span>
              <i />
              <span>
                <Star size={15} />
                100 ұпай
              </span>
              <i />
              <span>
                <KeyRound size={15} />1 код
              </span>
            </div>
            {error && (
              <div className="feedback retry" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="hero-art">
            <div className="file-tab">СЫНЫПТЫҚ АРХИВ · № 1916</div>
            <div className="hero-map-sheet">
              <ArchiveMap />
              <div className="map-stamp">
                ОРТАҚ
                <br />
                МИССИЯ<span>1900 — 1916</span>
              </div>
            </div>
            <div className="archive-note">
              <div>
                <span>ЗЕРТТЕУШІЛЕРГЕ ХАТ</span>
                <span>⌁</span>
              </div>
              <h3>
                Бәрі бір-бірімен
                <br />
                байланысты.
              </h3>
              <p>
                Телефоннан қосыл.
                <br />
                Сыныппен бірге тарихты аш.
              </p>
              <div className="note-rule" />
              <small>Бір архив. Көптеген ашылым.</small>
            </div>
            <div className="round-seal">
              <Fingerprint size={34} />
              <span>СЫНЫПТЫҚ ЗЕРТТЕУ</span>
            </div>
          </div>
        </section>
        <section className="class-how">
          <div>
            <span>01</span>
            <h3>Сабақты ашыңыз</h3>
            <p>Мұғалімге 6 цифрлық код, QR және қосылу сілтемесі беріледі.</p>
          </div>
          <div>
            <span>02</span>
            <h3>Сыныппен қосылыңыз</h3>
            <p>Оқушыға тек аты мен сабақ коды қажет. Тіркелу жоқ.</p>
          </div>
          <div>
            <span>03</span>
            <h3>Тарихты бірге ашыңыз</h3>
            <p>
              Ортақ сұрақтар, жеке архивтер және тікелей сынып статистикасы.
            </p>
          </div>
        </section>
        <section className="mission-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ЗЕРТТЕУ БАҒЫТТАРЫ</span>
              <h2>Үш архив. Бір тарихи тізбек.</h2>
            </div>
            <span className="section-aside">
              МҰҒАЛІМ БАСҚАРАТЫН МИССИЯ <ArrowRight size={16} />
            </span>
          </div>
          <div className="mission-cards">
            {missions.map((m, i) => (
              <article className="mission-card" key={m.title}>
                <div className="mission-card-top">
                  <span>АРХИВ № 0{i + 1}</span>
                  <FolderOpen size={19} />
                </div>
                <h3>{m.title}</h3>
                <p>{m.description}</p>
                <div className="mission-card-bottom">
                  <span>
                    <Star size={14} />
                    {m.points} ұпай
                  </span>
                  <span>{m.years}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-bottom">
          <ShieldCheck size={32} />
          <p>
            Әр оқушының өз зерттеуі.
            <br />
            <strong>Бүкіл сыныптың ортақ ашылымы.</strong>
          </p>
          <div className="bottom-detail">
            <span>
              АТТАР МЕН ЖЕКЕ ЖАУАПТАР ҚОРҒАЛҒАН
              <small>Проекторда тек анонимді статистика көрсетіледі.</small>
            </span>
          </div>
        </section>
        {!configured && (
          <details className="setup-note">
            <summary>Ұйымдастырушыға: Supabase байланысын баптау қажет</summary>
            <p>
              Сабақты ашу үшін .env.example үлгісі бойынша .env.local файлын
              толтырып, supabase/migrations ішіндегі SQL миграциясын іске
              қосыңыз. Толық нұсқаулық README.md ішінде. Қосылмаған сервер
              жалған сынып немесе жасанды нәтижелер көрсетпейді.
            </p>
          </details>
        )}
      </main>
      <Footer />
    </div>
  );
}

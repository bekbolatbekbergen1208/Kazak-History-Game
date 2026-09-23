"use client";
import { CheckCircle2, Clock3, Layers, Star, Users } from "lucide-react";
import { missions } from "../data/historyData";
import type { ClassStats, QuestionStats } from "../lib/types";
export function Metrics({ stats }: { stats: ClassStats }) {
  return (
    <div className="metrics">
      {[
        [
          Users,
          "Оқушы саны",
          stats.totalStudents,
          `${stats.activeStudents} байланыста`,
        ],
        [
          Star,
          "Орташа ұпай",
          `${stats.averageScore} / 100`,
          "Сыныптың ортақ нәтижесі",
        ],
        [
          Layers,
          "Жалпы прогресс",
          `${stats.completion}%`,
          `${stats.finished} оқушы аяқтады`,
        ],
        [
          CheckCircle2,
          "Дұрыс жауаптар",
          `${stats.correctPercentage}%`,
          "Алғашқы әрекеттер бойынша",
        ],
      ].map(([Icon, label, value, note]) => {
        const I = Icon as typeof Users;
        return (
          <div className="metric" key={String(label)}>
            <span>
              <I size={17} />
              {String(label)}
            </span>
            <strong>{String(value)}</strong>
            <small>{String(note)}</small>
          </div>
        );
      })}
    </div>
  );
}
export function Distribution({
  question,
  showCorrect = false,
}: {
  question: QuestionStats;
  showCorrect?: boolean;
}) {
  return (
    <div className="distribution">
      <div className="distribution-heading">
        <span>АНОНИМДІ ЖАУАПТАР</span>
        <b>
          {question.answers} / {question.expected} жауап
        </b>
      </div>
      {question.options.map((option, i) => {
        const percent = question.answers
          ? Math.round(
              ((question.distribution[i] || 0) / question.answers) * 100,
            )
          : 0;
        return (
          <div
            className={`distribution-row ${showCorrect && question.correctOptions?.includes(i) ? "correct-option" : ""}`}
            key={option}
          >
            <div>
              <span className="option-label">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{option}</span>
              <b>{percent}%</b>
            </div>
            <div className="distribution-track">
              <i style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
      {!question.options.length && (
        <div className="aggregate-correct">
          <span>{question.correct} дұрыс</span>
          <span>{question.incorrect} қайта қарауды қажет етеді</span>
        </div>
      )}
      <small>
        Әр баған — осы нұсқаны таңдаған оқушылар үлесі. Бірнеше жауап таңдалса,
        қосынды 100%-дан асуы мүмкін.
      </small>
    </div>
  );
}
export function FinalClassStats({ stats }: { stats: ClassStats }) {
  return (
    <section className="class-summary">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ОРТАҚ ЗЕРТТЕУДІҢ ҚОРЫТЫНДЫСЫ</span>
          <h2>Сынып архиві зерттелді.</h2>
        </div>
      </div>
      <Metrics stats={stats} />
      <div className="summary-insights">
        <article>
          <Clock3 size={23} />
          <span>Орташа аяқтау уақыты</span>
          <h3>
            {stats.averageTime === null
              ? "Әлі аяқталған жұмыс жоқ"
              : `${Math.floor(stats.averageTime / 60)} мин ${stats.averageTime % 60} сек`}
          </h3>
          <small>Жеке финалға жеткен оқушылар; үзілістер есептелмейді.</small>
        </article>
        <article>
          <span>Қайта талқылауға тұрарлық</span>
          <h3>{stats.mostDifficult?.title || "Жауаптар жоқ"}</h3>
          <small>
            {stats.mostDifficult
              ? `${stats.mostDifficult.percentage}% дұрыс · ${stats.mostDifficult.answers} алғашқы жауап`
              : ""}
          </small>
        </article>
        <article>
          <span>Ең жақсы түсінілген тақырып</span>
          <h3>{stats.bestUnderstood?.title || "Жауаптар жоқ"}</h3>
          <small>
            {stats.bestUnderstood
              ? `${stats.bestUnderstood.percentage}% дұрыс · ${stats.bestUnderstood.answers} алғашқы жауап`
              : ""}
          </small>
        </article>
      </div>
      <div className="mission-summary">
        {missions.map((m, i) => (
          <div key={m.title}>
            <span>
              0{i + 1} · {m.short}
            </span>
            <strong>{stats.missionCompletion[i]}%</strong>
            <div className="distribution-track">
              <i style={{ width: `${stats.missionCompletion[i]}%` }} />
            </div>
            <small>Миссияның барлық тапсырмасын аяқтаған оқушылар</small>
          </div>
        ))}
      </div>
    </section>
  );
}

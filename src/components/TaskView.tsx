"use client";
import { useState } from "react";
import {
  Check,
  FileText,
  Fingerprint,
  FolderOpen,
  HelpCircle,
  Layers,
  Map,
  RotateCcw,
  X,
} from "lucide-react";
import { ArchiveMap } from "../ArchiveMap";
import {
  intellectualGroups,
  zhetysuEvents,
  torgaiEvents,
  sourceTypes,
  dumaFacts,
  finalQuestions,
} from "../data/historyData";
import type { Task } from "../data/historyData";
import type { Draft } from "../gameLogic";
function Document({
  task,
  draft,
  update,
  disabled,
}: {
  task: Task;
  draft: Draft;
  update: (d: Partial<Draft>) => void;
  disabled: boolean;
}) {
  if (!task.document) return null;
  const sealed = task.id === "decree" && !draft.sealed;
  return (
    <article className={`document ${sealed ? "sealed" : ""}`}>
      <div className="document-top">
        <span>{task.document.label}</span>
        <FileText size={18} />
      </div>
      <h3>{task.document.title}</h3>
      {sealed ? (
        <button
          className="wax-seal"
          disabled={disabled}
          onClick={() => update({ sealed: true })}
          aria-label="Жарлықтың мөрін ашу"
        >
          <Fingerprint size={32} />
          <small>МӨРДІ АШУ</small>
        </button>
      ) : (
        <p>{task.document.text}</p>
      )}
      <span className="document-no">
        ҚҰЖАТ № {String(task.mission + 1).padStart(2, "0")}
      </span>
    </article>
  );
}
export default function TaskView({
  task,
  draft,
  update,
  disabled,
}: {
  task: Task;
  draft: Draft;
  update: (d: Partial<Draft>) => void;
  disabled: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [reference, setReference] = useState(false);
  const place = (text: string, group: string) => {
    if (disabled) return;
    const item = task.items?.find((i) => i.text === text);
    if (!item) return;
    update({ placements: { ...draft.placements, [text]: group } });
    setActive(null);
  };
  return (
    <>
      <Document task={task} draft={draft} update={update} disabled={disabled} />
      {task.id === "karataev" && (
        <div className="duma-folders">
          {dumaFacts.map((d) => (
            <div key={d.convocation}>
              <FolderOpen size={22} />
              <strong>{d.convocation}</strong>
              <small>
                {d.deputies.length
                  ? d.deputies.join(", ")
                  : "Депутаттардың толық тізімі берілмеген"}
              </small>
            </div>
          ))}
        </div>
      )}
      {task.id === "source" && (
        <>
          <button
            className="text-btn"
            onClick={() => setReference(!reference)}
            aria-expanded={reference}
          >
            <HelpCircle size={16} /> Дерек деген не?
          </button>
          {reference && (
            <div className="reference-box">
              <p>{sourceTypes.join(" · ")}</p>
              <p>
                Қосымша тарихи анықтама: Николай II Александрович Романов —
                Ресей империясының соңғы императоры. Материалда берілген билік
                мерзімі: 20.10.1894 – 02.03.1917.
              </p>
              <p>
                Владимир Ильич Ульянов пен Иосиф Виссарионович Сталин материалда
                аталған. Анықтамаларының толық мәтіні берілмеген.
              </p>
            </div>
          )}
          <div className="source-grid">
            {task.reference?.map((t, i) => (
              <div key={t}>
                <span>0{i + 1}</span>
                {t}
              </div>
            ))}
          </div>
        </>
      )}
      {task.id === "groups" && (
        <div className="positions">
          {intellectualGroups.map((g, i) => (
            <article key={g.title}>
              <span className="eyebrow">БАҒЫТ 0{i + 1}</span>
              <h3>{g.title}</h3>
              <p>{g.names}</p>
              <blockquote>{g.position}</blockquote>
            </article>
          ))}
        </div>
      )}
      {task.type === "choice" &&
        (!task.document || task.id !== "decree" || draft.sealed) && (
          <div className="choices">
            {task.correct!.length > 1 && (
              <p className="selection-note">
                {task.correct!.length} жауап таңдаңыз · Таңдалды:{" "}
                {draft.picks?.length || 0}
              </p>
            )}
            {task.options!.map((option, i) => (
              <button
                key={option}
                disabled={disabled}
                className={`choice ${draft.picks?.includes(i) ? "selected" : ""}`}
                onClick={() =>
                  update({
                    picks:
                      task.correct!.length === 1
                        ? [i]
                        : draft.picks?.includes(i)
                          ? draft.picks.filter((n) => n !== i)
                          : [...(draft.picks || []), i],
                  })
                }
                aria-pressed={draft.picks?.includes(i) || false}
              >
                <span className="choice-letter">
                  {draft.picks?.includes(i) ? (
                    <Check size={16} />
                  ) : (
                    String.fromCharCode(65 + i)
                  )}
                </span>
                {option}
              </button>
            ))}
          </div>
        )}
      {task.type === "sort" && (
        <div className="sorting">
          <div className="sorting-head">
            <span>
              <Layers size={16} /> ДЕРЕКТЕР ЖИНАҒЫ
            </span>
            <span>
              {Object.keys(draft.placements || {}).length} /{" "}
              {task.items!.length}
            </span>
          </div>
          <div className="card-bank">
            {[...task.items!]
              .sort((a, b) => a.text.localeCompare(b.text, "kk"))
              .filter((item) => !draft.placements?.[item.text])
              .map((item) => (
                <button
                  key={item.text}
                  draggable={!disabled}
                  disabled={disabled}
                  aria-pressed={active === item.text}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item.text);
                    setActive(item.text);
                  }}
                  onClick={() =>
                    setActive(active === item.text ? null : item.text)
                  }
                  className={`drag-card ${active === item.text ? "selected" : ""}`}
                >
                  <span>⠿</span>
                  {item.text}
                </button>
              ))}
            {Object.keys(draft.placements || {}).length ===
              task.items!.length && (
              <div className="bank-complete">
                <Check size={19} /> Барлық дерек орналастырылды
              </div>
            )}
          </div>
          <p className="selection-note" aria-live="polite">
            {active
              ? `«${active}» таңдалды. Тиісті санатты басыңыз.`
              : "Карточканы сүйреңіз немесе таңдап, санатты басыңыз."}
          </p>
          <div className={`drop-zones count-${task.groups!.length}`}>
            {task.groups!.map((group) => (
              <div
                key={group}
                className={`drop-zone ${active ? "ready" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  place(e.dataTransfer.getData("text/plain"), group);
                }}
                onClick={() => active && place(active, group)}
              >
                <button
                  className="drop-target"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (active) place(active, group);
                  }}
                >
                  <strong>{group}</strong>
                  <span>{active ? "ОСЫ ЖЕРГЕ ОРНАЛАСТЫРУ" : "+ ДЕРЕК"}</span>
                </button>
                {Object.entries(draft.placements || {})
                  .filter(([, g]) => g === group)
                  .map(([text]) => (
                    <button
                      className="placed placed-removable"
                      key={text}
                      disabled={disabled}
                      aria-label={`${text} карточкасын қайтару`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const placements = { ...draft.placements };
                        delete placements[text];
                        update({ placements });
                      }}
                    >
                      <span>{text}</span>
                      <X size={12} />
                    </button>
                  ))}
              </div>
            ))}
          </div>
          {!disabled && Object.keys(draft.placements || {}).length > 0 && (
            <button
              className="text-btn"
              onClick={() => update({ placements: {} })}
            >
              <RotateCcw size={15} /> Карточкаларды қайта орналастыру
            </button>
          )}
        </div>
      )}
      {task.type === "order" && (
        <div className="order-game">
          <div className="order-bank">
            {[...task.sequence!]
              .sort((a, b) => a.localeCompare(b, "kk"))
              .filter((t) => !draft.order?.includes(t))
              .map((t) => (
                <button
                  className="drag-card"
                  key={t}
                  disabled={disabled}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", t)}
                  onClick={() => update({ order: [...(draft.order || []), t] })}
                >
                  <span>+</span>
                  {t}
                </button>
              ))}
          </div>
          <div
            className="sequence"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const t = e.dataTransfer.getData("text/plain");
              if (
                !disabled &&
                task.sequence!.includes(t) &&
                !draft.order?.includes(t)
              )
                update({ order: [...(draft.order || []), t] });
            }}
          >
            {task.sequence!.map((_, i) => (
              <div
                className={`sequence-slot ${draft.order?.[i] ? "filled" : ""}`}
                key={i}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <strong>{draft.order?.[i] || "Келесі оқиғаны таңдаңыз"}</strong>
                {draft.order?.[i] && !disabled && (
                  <button
                    className="icon-btn"
                    aria-label={`${draft.order[i]} карточкасын алып тастау`}
                    onClick={() =>
                      update({ order: draft.order!.filter((__, n) => n !== i) })
                    }
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!disabled && (
            <button className="text-btn" onClick={() => update({ order: [] })}>
              <RotateCcw size={15} /> Ретті қайта құрастыру
            </button>
          )}
        </div>
      )}
      {task.type === "map" && (
        <>
          <ArchiveMap
            interactive
            selected={draft.region}
            visited={draft.visited}
            onSelect={(region) =>
              !disabled &&
              update({
                region,
                visited: Array.from(
                  new Set([...(draft.visited || []), region]),
                ),
              })
            }
          />
          {draft.region ? (
            <article className="regional-panel">
              <span className="eyebrow">
                АШЫЛҒАН АРХИВ · {draft.region === "Жетісу" ? "01" : "02"}
              </span>
              <h3>{draft.region}</h3>
              <div className="regional-events">
                {(draft.region === "Жетісу" ? zhetysuEvents : torgaiEvents).map(
                  (text, i) => (
                    <p key={text}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      {text}
                    </p>
                  ),
                )}
              </div>
            </article>
          ) : (
            <div className="map-instruction">
              <Map size={19} /> Картаның Торғай немесе Жетісу нүктесін басыңыз.
            </div>
          )}
        </>
      )}
      {task.type === "reflection" && (
        <>
          <div className="keyword-cloud">
            {finalQuestions.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <div className="choices">
            {task.options!.map((o, i) => (
              <button
                disabled={disabled}
                key={o}
                className={`choice ${draft.picks?.includes(i) ? "selected" : ""}`}
                aria-pressed={draft.picks?.includes(i) || false}
                onClick={() =>
                  update({
                    picks: draft.picks?.includes(i)
                      ? draft.picks.filter((n) => n !== i)
                      : [...(draft.picks || []), i],
                  })
                }
              >
                <span className="choice-letter">
                  {draft.picks?.includes(i) ? <Check size={16} /> : "+"}
                </span>
                {o}
              </button>
            ))}
          </div>
          <label className="reflection-label" htmlFor="reflection">
            Менің тарихи қорытындым
          </label>
          <textarea
            id="reflection"
            disabled={disabled}
            maxLength={600}
            value={draft.reflection || ""}
            onChange={(e) => update({ reflection: e.target.value })}
            placeholder="Менің ойымша, бұл көтеріліс маңызды, себебі…"
          />
          <small className="muted">
            2–3 дәлел таңдаңыз. Бір сөйлем жеткілікті. Пікіріңіздің мазмұны
            автоматты бағаланбайды.
          </small>
        </>
      )}
    </>
  );
}

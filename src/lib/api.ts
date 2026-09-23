import { NextResponse } from "next/server";
import { ApiError } from "./security";
export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof ApiError)
    return NextResponse.json({ error: message }, { status: error.status });
  if (message === "SETUP_REQUIRED")
    return NextResponse.json(
      {
        error:
          "Supabase қосылмаған. .env.local параметрлерін толтырып, SQL миграциясын іске қосыңыз.",
        setup: true,
      },
      { status: 503 },
    );
  const cases: [string, string, number][] = [
    ["ROOM_EXPIRED", "Сабақтың сақтау мерзімі аяқталды.", 410],
    ["ROOM_ENDED", "Мұғалім сабақты аяқтады.", 409],
    ["ROOM_PAUSED", "Мұғалім ойынды уақытша тоқтатты.", 409],
    ["ANSWERS_LOCKED", "Мұғалім жауап қабылдауды жапты.", 409],
    [
      "STALE_STATE",
      "Сабақ күйі өзгерді. Деректер жаңартылды; тапсырманы қайта қараңыз.",
      409,
    ],
    ["ALREADY_SUBMITTED", "Бұл ортақ сұраққа жауабыңыз қабылданды.", 409],
    [
      "NOT_EXPECTED",
      "Бұл ортақ тапсырма сіз қосылғанға дейін басталған. Келесі тапсырманы күтіңіз.",
      409,
    ],
    [
      "WAIT_FOR_ANSWERS",
      "Барлық жауапты күтіңіз немесе жауап қабылдауды жабыңыз.",
      409,
    ],
    ["ROOM_FULL", "Сыныпта бос орын жоқ (ең көбі 100 оқушы).", 409],
    [
      "INVALID_CONTROL",
      "Бұл әрекет сабақтың қазіргі күйіне сәйкес келмейді.",
      409,
    ],
  ];
  for (const [code, text, status] of cases)
    if (message.includes(code))
      return NextResponse.json({ error: text, refresh: true }, { status });
  console.error(
    "[classroom]",
    message.replace(/https?:\/\/\S+/g, "[endpoint]"),
  );
  return NextResponse.json(
    {
      error:
        "Сервермен байланыс орнамады. Қайта қосылып көріңіз. Supabase параметрлері мен SQL миграциясын тексеріңіз.",
    },
    { status: 503 },
  );
}

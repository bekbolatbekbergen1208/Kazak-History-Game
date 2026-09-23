import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResponseRow } from "./types";
// Supabase/PostgREST caps each response at 1,000 rows by default.
// A normal 100-person classroom can exceed that cap before finishing.
export async function readResponses(
  db: SupabaseClient,
  roomId: string,
  participantId?: string,
): Promise<ResponseRow[]> {
  const rows: ResponseRow[] = [];
  const size = 1000;
  for (let offset = 0; ; offset += size) {
    let query = db
      .from("responses")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at")
      .order("id")
      .range(offset, offset + size - 1);
    if (participantId) query = query.eq("participant_id", participantId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...(data as ResponseRow[]));
    if (data.length < size) return rows;
  }
}

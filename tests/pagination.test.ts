import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readResponses } from "../src/lib/readResponses.ts";
test("A classroom larger than the Supabase 1,000-row cap retains every response", async () => {
  const rows = Array.from({ length: 1800 }, (_, i) => ({ id: String(i) }));
  const ranges: number[][] = [];
  const builder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    order() {
      return this;
    },
    range(start: number, end: number) {
      ranges.push([start, end]);
      return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
    },
  };
  const db = { from: () => builder } as unknown as SupabaseClient;
  const result = await readResponses(db, "room");
  assert.equal(result.length, 1800);
  assert.equal(result.at(-1)?.id, "1799");
  assert.deepEqual(ranges, [
    [0, 999],
    [1000, 1999],
  ]);
});

test('LAN phones can generate idempotency IDs without secure-context randomUUID',async()=>{
 const {newRequestId}=await import('../src/lib/requestId.ts');
 const fallback={getRandomValues:globalThis.crypto.getRandomValues.bind(globalThis.crypto)};
 const first=newRequestId(fallback),second=newRequestId(fallback);
 assert.match(first,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.notEqual(first,second);
});

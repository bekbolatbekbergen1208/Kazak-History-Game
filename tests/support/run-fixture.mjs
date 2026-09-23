import { startFixture } from "./supabase-fixture.mjs";

const fixture = await startFixture(54329);
console.log("Local classroom database ready at http://127.0.0.1:54329");

async function shutdown() {
  await fixture.close();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
await new Promise(() => {});

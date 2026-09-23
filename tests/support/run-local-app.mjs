import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";

const address = Object.values(networkInterfaces())
  .flat()
  .find((entry) => entry?.family === "IPv4" && !entry.internal)?.address;
const siteUrl = `http://${address || "127.0.0.1"}:3001`;

console.log(`Local classroom app: ${siteUrl}`);
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "0.0.0.0", "--port", "3001"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_classroom_test",
      SUPABASE_SECRET_KEY: "sb_secret_classroom_test",
      NEXT_PUBLIC_SITE_URL: siteUrl,
    },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}
child.once("exit", (code) => process.exit(code ?? 0));

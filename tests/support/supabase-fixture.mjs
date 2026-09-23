/** TEST ONLY: real PostgreSQL migration + minimal PostgREST/Phoenix protocol adapter.
 * This is not a Supabase replacement and is never imported by the application.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { WebSocketServer } from "ws";
export async function startFixture(port = 54329) {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema realtime;create table realtime.test_events(id bigserial,topic text,event text,payload jsonb);create function realtime.send(p_payload jsonb,p_event text,p_topic text,p_private boolean) returns void language sql as $$insert into realtime.test_events(topic,event,payload) values(p_topic,p_event,p_payload)$$;`,
  );
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/202609230001_classroom.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const ident = (value) => {
    if (!/^[a-z_]+$/.test(value)) throw Error("Invalid SQL identifier");
    return '"' + value + '"';
  };
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "apikey,authorization,content-type,x-client-info,prefer,range,accept-profile,content-profile",
    );
    if (req.method === "OPTIONS") {
      res.end();
      return;
    }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === "/health") {
      res.end("ok");
      return;
    }
    if (req.headers.apikey !== "sb_secret_classroom_test") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: "42501", message: "permission denied" }));
      return;
    }
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      const body = raw ? JSON.parse(raw) : {};
      let rows;
      const single = (req.headers.accept || "").includes(
        "application/vnd.pgrst.object+json",
      );
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const name = url.pathname.split("/").pop();
        const keys = Object.keys(body);
        const result = await db.query(
          `select public.${ident(name)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(",")}) as result`,
          keys.map((k) => body[k]),
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result.rows[0].result));
        return;
      }
      const table = url.pathname.split("/").pop();
      if (!["rooms", "participants", "progress", "responses"].includes(table))
        throw Error("Unknown table");
      const values = [];
      const where = [];
      for (const [key, value] of url.searchParams) {
        if (value.startsWith("eq.")) {
          values.push(value.slice(3));
          where.push(`${ident(key)}=$${values.length}`);
        }
      }
      const condition = where.length ? " where " + where.join(" and ") : "";
      const selected = url.searchParams.get("select") || "*";
      const selection =
        selected === "*" ? "*" : selected.split(",").map(ident).join(",");
      if (req.method === "GET") {
        const order = url.searchParams.get("order");
        const orderBy = order
          ? " order by " +
            order
              .split(",")
              .map((v) => {
                const [key, direction] = v.split(".");
                return ident(key) + (direction === "desc" ? " desc" : " asc");
              })
              .join(",")
          : "";
        const limit = Math.min(
          1000,
          Number(url.searchParams.get("limit") || 1000),
        );
        const offset = Number(url.searchParams.get("offset") || 0);
        rows = (
          await db.query(
            `select ${selection} from ${ident(table)}${condition}${orderBy} limit ${limit} offset ${offset}`,
            values,
          )
        ).rows;
      } else if (req.method === "POST") {
        const keys = Object.keys(body);
        rows = (
          await db.query(
            `insert into ${ident(table)} (${keys.map(ident).join(",")}) values (${keys.map((_, i) => "$" + (i + 1)).join(",")}) returning ${selection}`,
            keys.map((k) => body[k]),
          )
        ).rows;
      } else if (req.method === "PATCH") {
        const keys = Object.keys(body);
        const set = keys
          .map((k) => {
            values.push(body[k]);
            return `${ident(k)}=$${values.length}`;
          })
          .join(",");
        rows = (
          await db.query(
            `update ${ident(table)} set ${set}${condition} returning ${selection}`,
            values,
          )
        ).rows;
      } else throw Error("Unsupported method");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(single ? (rows[0] ?? null) : rows));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: e.message, code: e.code || "P0001" }));
    }
  });
  const wss = new WebSocketServer({ server, path: "/realtime/v1/websocket" });
  const subscriptions = new Map();
  wss.on("connection", (socket) => {
    const topics = new Map();
    subscriptions.set(socket, topics);
    socket.on("message", (raw) => {
      const [joinRef, ref, topic, event] = JSON.parse(raw.toString());
      if (event === "phx_join") topics.set(topic, joinRef);
      if (event === "phx_leave") topics.delete(topic);
      socket.send(
        JSON.stringify([
          joinRef,
          ref,
          topic,
          "phx_reply",
          { status: "ok", response: { postgres_changes: [] } },
        ]),
      );
    });
    socket.on("close", () => subscriptions.delete(socket));
  });
  let last = 0,
    polling = false;
  const timer = setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      const { rows } = await db.query(
        "select * from realtime.test_events where id>$1 order by id",
        [last],
      );
      for (const row of rows) {
        last = Number(row.id);
        const topic = "realtime:" + row.topic;
        for (const [socket, topics] of subscriptions) {
          if (topics.has(topic) && socket.readyState === 1)
            socket.send(
              JSON.stringify([
                topics.get(topic),
                null,
                topic,
                "broadcast",
                { event: row.event, payload: row.payload, type: "broadcast" },
              ]),
            );
        }
      }
    } finally {
      polling = false;
    }
  }, 50);
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    db,
    close: async () => {
      clearInterval(timer);
      wss.clients.forEach((s) => s.terminate());
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}

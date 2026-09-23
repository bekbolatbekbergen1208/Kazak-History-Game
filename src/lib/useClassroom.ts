"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Snapshot, Role } from "./types";
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function send(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const result = await response.json();
  if (!response.ok)
    throw new RequestError(result.error || "Байланыс қатесі.", response.status);
  return result;
}
export function useClassroom(id: string, role: Role, enabled = true) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [channelReady, setChannelReady] = useState(false);
  const inFlight = useRef(false),
    queued = useRef(false),
    mounted = useRef(true);
  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled || !mounted.current) return;
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const response = await fetch(`/api/rooms/${id}?role=${role}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new RequestError(result.error, response.status);
      if (mounted.current) {
        setData(result);
        setError("");
        setConnected(true);
      }
    } catch (e) {
      if (mounted.current) {
        setConnected(false);
        if (
          e instanceof RequestError &&
          [401, 403, 404, 410].includes(e.status)
        )
          setData(null);
        setError(e instanceof Error ? e.message : "Қайта қосылуда…");
      }
    } finally {
      inFlight.current = false;
      if (queued.current && mounted.current) {
        queued.current = false;
        void refresh();
      }
    }
  }, [id, role, enabled]);
  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    void refresh();
    const online = () => void refresh();
    const offline = () => setConnected(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    const timer = setInterval(() => void refresh(), 10000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [refresh, enabled]);
  const participantId = data?.participant?.id;
  useEffect(() => {
    if (!enabled || !data?.room.id || (role === "student" && !participantId))
      return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const topics = [
      `classroom:${id}`,
      role === "student" ? `student:${participantId}` : `monitor:${id}`,
    ];
    let debounce: ReturnType<typeof setTimeout>;
    const ready = new Set<string>();
    const channels = topics.map((topic) =>
      client
        .channel(topic, { config: { private: false } })
        .on("broadcast", { event: "invalidate" }, () => {
          clearTimeout(debounce);
          debounce = setTimeout(() => void refresh(), 100);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            ready.add(topic);
            setChannelReady(ready.size === topics.length);
            void refresh();
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            ready.delete(topic);
            setChannelReady(false);
          }
        }),
    );
    return () => {
      clearTimeout(debounce);
      channels.forEach((channel) => void client.removeChannel(channel));
    };
  }, [id, role, participantId, enabled, !!data?.room.id, refresh]);
  useEffect(() => {
    if (!enabled || role !== "student" || !participantId) return;
    const beat = () => {
      if (navigator.onLine)
        void send(`/api/rooms/${id}`, { action: "heartbeat" }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, 20000);
    return () => clearInterval(timer);
  }, [id, role, participantId, enabled]);
  return { data, error, connected, channelReady, refresh };
}

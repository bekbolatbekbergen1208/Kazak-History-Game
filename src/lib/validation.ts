import { z } from "zod";
const text = z.string().max(300);
export const draftSchema = z
  .object({
    picks: z
      .array(z.number().int().min(0).max(30))
      .max(30)
      .refine((v) => new Set(v).size === v.length)
      .optional(),
    placements: z
      .record(text, text)
      .refine((v) => Object.keys(v).length <= 50)
      .optional(),
    order: z.array(text).max(50).optional(),
    visited: z
      .array(z.enum(["Жетісу", "Торғай"]))
      .max(2)
      .optional(),
    region: z.enum(["Жетісу", "Торғай"]).optional(),
    reflection: z.string().max(600).optional(),
    sealed: z.boolean().optional(),
    code: z
      .string()
      .regex(/^\d{0,4}$/)
      .optional(),
  })
  .strict();
export const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }),
  z.object({
    action: z.literal("join"),
    code: z.string().regex(/^\d{6}$/),
    name: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .refine((v) => !/[\p{Cc}\p{Cf}]/u.test(v)),
  }),
]);
export const roomRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("projector_enter"),
    key: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  }),
  z.object({
    action: z.literal("control"),
    control: z.enum([
      "start",
      "pause",
      "resume",
      "next_mission",
      "launch_question",
      "individual",
      "reveal",
      "lock",
      "unlock",
      "end",
    ]),
    taskId: z.string().max(40).optional(),
    version: z.number().int().nonnegative(),
  }),
  z.object({
    action: z.literal("submit"),
    requestId: z.string().uuid(),
    taskId: z.string().max(40),
    round: z.number().int().nonnegative(),
    mode: z.enum(["individual", "class"]),
    answer: draftSchema,
  }),
  z.object({
    action: z.literal("draft"),
    taskId: z.string().max(40),
    draft: draftSchema,
  }),
  z.object({ action: z.literal("heartbeat") }),
]);

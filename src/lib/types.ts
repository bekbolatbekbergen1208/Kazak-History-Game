import type { Draft } from "../gameLogic";
import type { Task } from "../data/historyData";
export type Role = "teacher" | "student" | "projector";
export type RoomStatus = "lobby" | "running" | "paused" | "ended";
export type Room = {
  id: string;
  code: string;
  status: RoomStatus;
  current_mission: number;
  mode: "individual" | "class";
  active_task: string | null;
  round_id: number;
  expected_participants: string[];
  answers_locked: boolean;
  answer_revealed: boolean;
  started_at: string | null;
  paused_at: string | null;
  paused_ms: number;
  deadline_at: string | null;
  ended_at: string | null;
  expires_at: string;
  created_at: string;
  version: number;
};
export type Progress = {
  participant_id: string;
  room_id: string;
  awards: Record<string, number>;
  drafts: Record<string, Draft>;
  score: number;
  current_task: string | null;
  completed_tasks: number;
  finished_at: string | null;
  elapsed_seconds: number | null;
  version: number;
  updated_at: string;
};
export type Participant = {
  id: string;
  room_id: string;
  name: string;
  joined_at: string;
  last_seen_at: string;
};
export type ResponseRow = {
  id: string;
  room_id: string;
  participant_id: string;
  task_id: string;
  request_id: string;
  round_id: number;
  mode: "individual" | "class";
  answer: Draft & { code?: string };
  correct: boolean;
  points: number;
  created_at: string;
};
export type QuestionStats = {
  id: string;
  title: string;
  mission: number;
  type: Task["type"] | "code";
  options: string[];
  answers: number;
  correct: number;
  incorrect: number;
  percentage: number;
  distribution: number[];
  expected: number;
  allAnswered: boolean;
  explanation?: string;
  answerText?: string;
  correctOptions?: number[];
};
export type ClassStats = {
  totalStudents: number;
  activeStudents: number;
  averageScore: number;
  completion: number;
  correctPercentage: number;
  averageTime: number | null;
  finished: number;
  missionCompletion: number[];
  mostDifficult: QuestionStats | null;
  bestUnderstood: QuestionStats | null;
};
export type StudentRow = Participant & {
  progress: Progress;
  completion: number;
  mission: number;
  status: "active" | "offline" | "finished" | "waiting" | "incomplete";
  latestResponse: ResponseRow | null;
};
export type Snapshot = {
  role: Role;
  room: Room;
  serverTime: number;
  participant?: Participant;
  progress?: Progress;
  task?: Task | null;
  attempts?: number;
  submitted?: ResponseRow | null;
  students?: StudentRow[];
  stats?: ClassStats;
  questions?: QuestionStats[];
  activeQuestion?: QuestionStats | null;
  revealedAnswer?: { text: string; explanation: string };
  responses?: ResponseRow[];
};
export type Control =
  | "start"
  | "pause"
  | "resume"
  | "next_mission"
  | "launch_question"
  | "individual"
  | "reveal"
  | "lock"
  | "unlock"
  | "end";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import { getCalendar } from "../core/calendar.js";
import { config } from "../core/config.js";
import { getDashboard } from "../core/dashboard.js";
import { todayLocal } from "../core/dates.js";
import { createNote, deleteNote, listNotes, updateNote } from "../core/notes.js";
import { listNotifications, markNotificationRead } from "../core/notifications.js";
import { isValidRecurrence } from "../core/recurrence.js";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  listTasksWithStatus,
  setTaskDone,
  updateTask,
} from "../core/tasks.js";

// 被动世界:统一入口 + 鉴权 + CRUD(设计文档 §3)。
// 薄壳——所有逻辑在 core,这里只做 HTTP 翻译。待办模块也只通过 core 的接口调用,
// 就像未来的外部消费者那样(§1.4)。

const app = new Hono();

// ---- 静态页面:第一张"皮"(设计文档 §1.4——皮在 API 边界之外,随时可换) ----
// 页面本身不含数据,不用 token;页面里的 JS 调 API 时才带。
const indexHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../public/index.html"),
  "utf8",
);
app.get("/", (c) => c.html(indexHtml));

// ---- 鉴权:v1 单个静态 token ----
app.use("*", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (auth !== `Bearer ${config.apiToken}`) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

// ---- 校验 schema ----
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式须为 YYYY-MM-DD");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "格式须为 HH:MM");
const recurrenceStr = z.string().refine(isValidRecurrence, "只支持 daily / weekly:MON,WED");

// 客户端可自带 ULID(Crockford base32, 26 位)用于断网补发去重
const ulidStr = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "id 须为 26 位 ULID");

const taskFields = {
  title: z.string().min(1),
  due_date: dateStr.nullish(),
  recurrence: recurrenceStr.nullish(),
  start_date: dateStr.nullish(),
  end_date: dateStr.nullish(),
  remind_time: timeStr.nullish(),
  note: z.string().nullish(),
  status: z.enum(["todo", "doing", "testing", "done", "waiting", "incubating"]).optional(),
};

// id 只允许在创建时带(幂等重放);PATCH 不许改主键。
// due_date 与 recurrence 都不带 = 收集箱任务(先捕捉,以后再安排)。
const createTaskSchema = z
  .object({ id: ulidStr.optional(), ...taskFields })
  .refine((v) => !(v.due_date && v.recurrence), "due_date 与 recurrence 只能二选一");

const updateTaskSchema = z.object({ ...taskFields, archived: z.boolean() }).partial();

function parseBody<T>(schema: z.ZodType<T>, body: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(body);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error.issues.map((i) => i.message).join("; ") };
}

// ---- tasks ----
app.post("/tasks", async (c) => {
  const p = parseBody(createTaskSchema, await c.req.json());
  if (!p.ok) return c.json({ error: p.error }, 400);
  return c.json(await createTask(p.data), 201);
});

app.get("/tasks", async (c) => {
  const includeArchived = c.req.query("include_archived") === "true";
  // with_status=true:附带一次性任务的完成状态("所有"管理页用)
  if (c.req.query("with_status") === "true") {
    return c.json(await listTasksWithStatus({ includeArchived }));
  }
  return c.json(await listTasks({ includeArchived }));
});

app.get("/tasks/:id", async (c) => {
  const task = await getTask(c.req.param("id"));
  return task ? c.json(task) : c.json({ error: "not found" }, 404);
});

app.patch("/tasks/:id", async (c) => {
  const p = parseBody(updateTaskSchema, await c.req.json());
  if (!p.ok) return c.json({ error: p.error }, 400);
  const task = await updateTask(c.req.param("id"), p.data);
  return task ? c.json(task) : c.json({ error: "not found" }, 404);
});

app.delete("/tasks/:id", async (c) => {
  const ok = await deleteTask(c.req.param("id"));
  return ok ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});

// 标完成/取消完成。一次性任务的状态记在 due_date 上,循环任务记在 date(默认今天)上。
app.post("/tasks/:id/done", async (c) => {
  const p = parseBody(
    z.object({ date: dateStr.optional(), done: z.boolean().default(true) }),
    await c.req.json().catch(() => ({})),
  );
  if (!p.ok) return c.json({ error: p.error }, 400);
  const task = await getTask(c.req.param("id"));
  if (!task) return c.json({ error: "not found" }, 404);
  const done = p.data.done ?? true;
  // 一次性记在 due_date;收集箱任务(无日期)记在完成当天
  const date = task.recurrence ? (p.data.date ?? todayLocal()) : (task.due_date ?? todayLocal());
  await setTaskDone(task.id, date, done);
  return c.json({ task_id: task.id, date, done });
});

// ---- dashboard:算出来的视图 ----
app.get("/dashboard", async (c) => {
  const q = c.req.query("date");
  if (q && !dateStr.safeParse(q).success) return c.json({ error: "date 须为 YYYY-MM-DD" }, 400);
  const date = q ?? todayLocal();
  return c.json({ date, items: await getDashboard(date) });
});

// ---- notes:碎片记录,纯 CRUD ----
const noteSchema = z.object({ id: ulidStr.optional(), content: z.string().min(1) });

app.post("/notes", async (c) => {
  const p = parseBody(noteSchema, await c.req.json());
  if (!p.ok) return c.json({ error: p.error }, 400);
  return c.json(await createNote(p.data), 201);
});

app.get("/notes", async (c) => c.json(await listNotes()));

app.patch("/notes/:id", async (c) => {
  const p = parseBody(z.object({ content: z.string().min(1) }), await c.req.json());
  if (!p.ok) return c.json({ error: p.error }, 400);
  const note = await updateNote(c.req.param("id"), p.data.content);
  return note ? c.json(note) : c.json({ error: "not found" }, 404);
});

app.delete("/notes/:id", async (c) => {
  const ok = await deleteNote(c.req.param("id"));
  return ok ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});

// ---- calendar:按日期范围的日历投影(一次性钉在 due_date,循环铺满匹配日) ----
app.get("/calendar", async (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (!from || !to || !dateStr.safeParse(from).success || !dateStr.safeParse(to).success) {
    return c.json({ error: "需要 from/to,格式 YYYY-MM-DD" }, 400);
  }
  if (from > to) return c.json({ error: "from 不能晚于 to" }, 400);
  const days = (Date.parse(to) - Date.parse(from)) / 86400e3;
  if (days > 62) return c.json({ error: "范围最多 62 天" }, 400);
  return c.json({ from, to, items: await getCalendar(from, to) });
});

// ---- notifications:纯拉取 ----
app.get("/notifications", async (c) => {
  const status = c.req.query("status");
  if (status && status !== "pending" && status !== "read") {
    return c.json({ error: "status 须为 pending / read" }, 400);
  }
  return c.json(await listNotifications(status as "pending" | "read" | undefined));
});

app.post("/notifications/:id/read", async (c) => {
  const n = await markNotificationRead(c.req.param("id"));
  return n ? c.json(n) : c.json({ error: "not found or already read" }, 404);
});

serve({ fetch: app.fetch, port: config.apiPort }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
});

import {
  IconCalendarPlus,
  IconCheck,
  IconCheckbox,
  IconInbox,
  IconNote,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { toggleDone } from "../app/dashboardSlice";
import { syncNow } from "../app/sync";
import { useAppDispatch, useAppSelector } from "../app/store";
import { api, ulid } from "../lib/api";
import { sendOrQueue } from "../lib/outbox";
import { fmtDate } from "../lib/format";
import type { Task } from "../types";

interface TaskWithStatus extends Task {
  once_done: boolean | null;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
}

type Entry =
  | { kind: "note"; id: string; text: string; created_at: string }
  | { kind: "task"; id: string; text: string; created_at: string };

/** 收集箱:随手记的碎片 + 还没安排的待办,一条时间流。 */
export default function InboxPage() {
  const dispatch = useAppDispatch();
  const today = useAppSelector((s) => s.dashboard.date);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"note" | "task">("note"); // 随手记的更多,碎片是默认
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tasks, notes] = await Promise.all([
        api<TaskWithStatus[]>("/tasks?with_status=true"),
        api<Note[]>("/notes"),
      ]);
      const taskEntries: Entry[] = tasks
        .filter((t) => !t.due_date && !t.recurrence && !t.once_done && !t.archived)
        .map((t) => ({ kind: "task", id: t.id, text: t.title, created_at: t.created_at }));
      const noteEntries: Entry[] = notes.map((n) => ({
        kind: "note",
        id: n.id,
        text: n.content,
        created_at: n.created_at,
      }));
      setEntries([...taskEntries, ...noteEntries].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const capture = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const id = ulid();
    setTitle("");
    setEntries((prev) => [{ kind, id, text: trimmed, created_at: new Date().toISOString() }, ...prev]);
    if (kind === "note") {
      await sendOrQueue({ method: "POST", path: "/notes", body: { id, content: trimmed } });
    } else {
      await sendOrQueue({ method: "POST", path: "/tasks", body: { id, title: trimmed } });
    }
  };

  const completeTask = (e: Entry) => {
    void dispatch(toggleDone({ id: e.id, done: true }));
    setEntries((prev) => prev.filter((x) => x.id !== e.id));
  };

  const scheduleToday = async (e: Entry) => {
    setEntries((prev) => prev.filter((x) => x.id !== e.id));
    await sendOrQueue({ method: "PATCH", path: `/tasks/${e.id}`, body: { due_date: today } });
    void dispatch(syncNow());
  };

  /** 碎片转待办:建同内容的收集箱任务,删掉原碎片 */
  const noteToTask = async (e: Entry) => {
    const taskId = ulid();
    setEntries((prev) =>
      prev.map((x) => (x.id === e.id ? { ...x, kind: "task" as const, id: taskId } : x)),
    );
    await sendOrQueue({ method: "POST", path: "/tasks", body: { id: taskId, title: e.text } });
    await sendOrQueue({ method: "DELETE", path: `/notes/${e.id}` });
  };

  const remove = async (e: Entry) => {
    if (!window.confirm(`删除「${e.text.slice(0, 20)}${e.text.length > 20 ? "…" : ""}」?不可恢复。`)) return;
    setEntries((prev) => prev.filter((x) => x.id !== e.id));
    await sendOrQueue({ method: "DELETE", path: e.kind === "note" ? `/notes/${e.id}` : `/tasks/${e.id}` });
  };

  return (
    <main className="flex flex-col overflow-y-auto bg-bg pb-20 md:pb-6 xl:col-span-2">
      <div className="flex items-end justify-between px-4 pt-5 pb-1.5 md:px-7">
        <h1 className="flex items-baseline gap-2.5 text-xl font-medium">
          收集箱
          <span className="text-[13px] font-normal text-ink3">随手记,以后再理</span>
        </h1>
      </div>

      {error && <div className="px-4 pb-1 text-xs text-over md:px-7">离线中,列表可能不新鲜</div>}

      <div className="mx-4 my-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 py-2 focus-within:border-accent md:mx-7">
        <IconPlus size={16} className="text-ink3" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void capture()}
          placeholder={kind === "note" ? "随手记点什么,回车即存…" : "待办事项,回车即存…"}
          className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[13.5px] outline-none"
        />
        <div className="flex overflow-hidden rounded-md border border-line text-xs">
          {(["note", "task"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 ${
                kind === k ? "bg-accent-soft text-accent" : "text-ink2 hover:bg-sidebar"
              }`}
            >
              {k === "note" ? <IconNote size={13} /> : <IconCheckbox size={13} />}
              {k === "note" ? "碎片" : "待办"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-2 pb-6 md:px-5">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-ink3">
            <IconInbox size={28} stroke={1.5} />
            <span className="text-[13px]">收集箱是空的</span>
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="row-in group flex items-start gap-3 rounded-[10px] px-3.5 py-[11px] hover:bg-surface">
              {e.kind === "task" ? (
                <button
                  aria-label="完成"
                  onClick={() => completeTask(e)}
                  className="mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md border-[1.6px] border-line2 text-white hover:border-accent"
                >
                  <IconCheck size={12} className="opacity-0 group-hover:opacity-40" />
                </button>
              ) : (
                <IconNote size={19} className="mt-0.5 shrink-0 text-ink3" stroke={1.5} />
              )}

              <div className="min-w-0 flex-1">
                <div className="whitespace-pre-wrap text-[14.5px] leading-[1.45]">{e.text}</div>
                <div className="mt-0.5 text-xs text-ink3">
                  {e.kind === "note" ? "碎片" : "待办"} · {fmtDate(e.created_at.slice(0, 10))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {e.kind === "task" ? (
                  <button
                    onClick={() => void scheduleToday(e)}
                    title="安排到今天"
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[12px] text-ink2 hover:border-accent hover:text-accent"
                  >
                    <IconCalendarPlus size={13} />
                    <span className="hidden md:inline">安排到今天</span>
                  </button>
                ) : (
                  <button
                    onClick={() => void noteToTask(e)}
                    title="转为待办"
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[12px] text-ink2 hover:border-accent hover:text-accent"
                  >
                    <IconCheckbox size={13} />
                    <span className="hidden md:inline">转待办</span>
                  </button>
                )}
                <button aria-label="删除" onClick={() => void remove(e)} className="text-ink3 hover:text-over">
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

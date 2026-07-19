import { useState } from "react";
import { syncNow } from "../app/sync";
import { useAppDispatch, useAppSelector } from "../app/store";
import { sendOrQueue } from "../lib/outbox";
import type { Task } from "../types";

const WEEKDAYS: [string, string][] = [
  ["MON", "一"], ["TUE", "二"], ["WED", "三"], ["THU", "四"],
  ["FRI", "五"], ["SAT", "六"], ["SUN", "日"],
];

type Kind = "inbox" | "once" | "daily" | "weekly";

const kindOf = (t: Task): Kind =>
  t.recurrence ? (t.recurrence === "daily" ? "daily" : "weekly") : t.due_date ? "once" : "inbox";

const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

const input = "rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs text-ink2";

/** 任务定义编辑器:类型/日期/循环规则/生效区间/提醒 全可改。改的是定义,所有按日视图立即跟随。 */
export default function TaskEditor({
  task,
  onSaved,
  onCancel,
  initialKind,
}: {
  task: Task;
  onSaved: () => void;
  onCancel: () => void;
  /** 覆盖初始类型(收集箱"安排"时默认进"某天"模式) */
  initialKind?: Kind;
}) {
  const dispatch = useAppDispatch();
  const today = useAppSelector((s) => s.dashboard.date);
  const [title, setTitle] = useState(task.title);
  const [kind, setKind] = useState<Kind>(initialKind ?? kindOf(task));
  const [due, setDue] = useState(task.due_date ?? today);
  const [days, setDays] = useState<string[]>(
    task.recurrence?.startsWith("weekly:") ? task.recurrence.slice("weekly:".length).split(",") : [],
  );
  const [start, setStart] = useState(task.start_date ?? "");
  const [end, setEnd] = useState(task.end_date ?? "");
  const [remind, setRemind] = useState(task.remind_time ?? "");

  const canSave =
    title.trim().length > 0 &&
    (kind !== "once" || !!due) &&
    (kind !== "weekly" || days.length > 0);

  const save = async () => {
    if (!canSave) return;
    const base = { title: title.trim(), remind_time: remind || null };
    const body =
      kind === "inbox"
        ? { ...base, due_date: null, recurrence: null, start_date: null, end_date: null }
        : kind === "once"
          ? { ...base, due_date: due, recurrence: null, start_date: null, end_date: null }
          : {
              ...base,
              due_date: null,
              recurrence: kind === "daily" ? "daily" : `weekly:${days.join(",")}`,
              start_date: start || null,
              end_date: end || null,
            };
    await sendOrQueue({ method: "PATCH", path: `/tasks/${task.id}`, body });
    void dispatch(syncNow());
    onSaved();
  };

  const toggleDay = (d: string) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <div className="flex flex-col gap-2.5 text-[13px]">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="标题"
        className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13.5px] outline-none focus:border-accent"
      />

      <div className="flex items-center gap-2">
        <span className="w-[38px] text-xs text-ink3">类型</span>
        <div className="flex overflow-hidden rounded-md border border-line text-xs">
          {([["inbox", "收集箱"], ["once", "某天"], ["daily", "每天"], ["weekly", "每周"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-2.5 py-1 ${kind === k ? "bg-accent-soft text-accent" : "text-ink2 hover:bg-sidebar"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {kind === "once" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-[38px] text-xs text-ink3">日期</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
          <button onClick={() => setDue(today)} className="rounded-md border border-line px-2 py-0.5 text-xs text-ink2 hover:border-accent hover:text-accent">今天</button>
          <button onClick={() => setDue(addDays(today, 1))} className="rounded-md border border-line px-2 py-0.5 text-xs text-ink2 hover:border-accent hover:text-accent">明天</button>
        </div>
      )}

      {kind === "weekly" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-[38px] text-xs text-ink3">周</span>
          {WEEKDAYS.map(([code, label]) => (
            <button
              key={code}
              onClick={() => toggleDay(code)}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                days.includes(code) ? "bg-accent text-white" : "bg-sidebar text-ink2 hover:bg-sidebar-hover"
              }`}
            >
              {label}
            </button>
          ))}
          {days.length === 0 && <span className="text-xs text-over">至少选一天</span>}
        </div>
      )}

      {(kind === "daily" || kind === "weekly") && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-[38px] text-xs text-ink3">区间</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
          <span className="text-ink3">–</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
          <span className="text-xs text-ink3">留空 = 不限</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-[38px] text-xs text-ink3">提醒</span>
        <input type="time" value={remind} onChange={(e) => setRemind(e.target.value)} className={input} />
        {remind && (
          <button onClick={() => setRemind("")} className="text-xs text-ink3 hover:text-ink">清除</button>
        )}
        {kind === "inbox" && remind && <span className="text-xs text-ink3">收集箱任务不会提醒,安排后才生效</span>}
      </div>

      <div className="mt-1 flex gap-2">
        <button
          onClick={() => void save()}
          disabled={!canSave}
          className="rounded-md bg-accent px-3.5 py-1.5 text-xs text-white disabled:opacity-40"
        >
          保存
        </button>
        <button onClick={onCancel} className="rounded-md border border-line px-3.5 py-1.5 text-xs text-ink2 hover:text-ink">
          取消
        </button>
      </div>
    </div>
  );
}

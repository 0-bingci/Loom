import { IconCheck, IconClock, IconRepeat } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toggleDone } from "../app/dashboardSlice";
import { useAppDispatch, useAppSelector } from "../app/store";
import { api } from "../lib/api";
import { fmtDate, fmtRecurrence, overdueDays, weekday } from "../lib/format";
import type { Task } from "../types";

interface CalItem {
  task: Task;
  date: string;
  kind: "once" | "recurring";
  done: boolean;
}

const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export default function WeekPage() {
  const dispatch = useAppDispatch();
  const { date: today, items: dashItems } = useAppSelector((s) => s.dashboard);
  const [items, setItems] = useState<CalItem[]>([]);
  const [error, setError] = useState(false);
  const overdue = dashItems.filter((i) => i.overdue);

  const load = useCallback(async (from: string) => {
    try {
      const res = await api<{ items: CalItem[] }>(`/calendar?from=${from}&to=${addDays(from, 6)}`);
      setItems(res.items);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (today) void load(today);
  }, [today, load]);

  const days = useMemo(() => (today ? Array.from({ length: 7 }, (_, i) => addDays(today, i)) : []), [today]);
  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const it of items) (m.get(it.date) ?? m.set(it.date, []).get(it.date)!).push(it);
    return m;
  }, [items]);

  const toggle = (it: CalItem) => {
    void dispatch(toggleDone({ id: it.task.id, done: !it.done, date: it.date }));
    setItems((prev) =>
      prev.map((p) => (p.task.id === it.task.id && p.date === it.date ? { ...p, done: !it.done } : p)),
    );
  };

  const row = (it: CalItem) => (
    <div key={`${it.task.id}|${it.date}`} className="row-in flex items-center gap-3 rounded-[10px] px-3.5 py-[11px] hover:bg-surface">
      <button
        aria-label={it.done ? "取消完成" : "完成"}
        onClick={() => toggle(it)}
        className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md border-[1.6px] text-white transition-colors ${
          it.done ? "border-accent bg-accent" : "border-line2 hover:border-accent"
        }`}
      >
        {it.done && <IconCheck size={12} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-[14.5px] leading-[1.35] ${it.done ? "text-ink3 line-through" : ""}`}>{it.task.title}</div>
        {it.task.remind_time && (
          <div className="mt-0.5 flex items-center gap-1 text-xs text-ink2">
            <IconClock size={13} />
            {it.task.remind_time}
          </div>
        )}
      </div>
      {it.kind === "recurring" ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-rec-soft px-2 py-0.5 text-[11px] text-rec">
          <IconRepeat size={11} />
          {fmtRecurrence(it.task.recurrence!)}
        </span>
      ) : (
        <span className="whitespace-nowrap rounded-md bg-[#EFEDE6] px-2 py-0.5 text-[11px] text-ink2">一次性</span>
      )}
    </div>
  );

  return (
    <main className="flex flex-col overflow-y-auto bg-bg pb-20 md:pb-6 xl:col-span-2">
      <div className="flex items-end justify-between px-4 pt-5 pb-1.5 md:px-7">
        <h1 className="flex items-baseline gap-2.5 text-xl font-medium">
          最近 7 天
          {today && (
            <span className="text-[13px] font-normal text-ink3">
              {fmtDate(today)} – {fmtDate(addDays(today, 6))}
            </span>
          )}
        </h1>
      </div>

      {error && <div className="px-4 pb-1 text-xs text-over md:px-7">离线中,数据可能不新鲜</div>}

      {overdue.length > 0 && (
        <>
          <div className="flex items-center gap-[7px] px-4 pt-4 pb-1.5 text-xs tracking-[0.5px] md:px-7">
            <span className="font-medium text-over">逾期</span>
            <small className="text-ink3">未做完,一直挂着</small>
          </div>
          <div className="px-2 md:px-5">
            {overdue.map((it) => (
              <div key={it.task.id} className="row-in flex items-center gap-3 rounded-[10px] bg-over-row px-3.5 py-[11px] hover:bg-over-row-hover">
                <button
                  aria-label="完成"
                  onClick={() => void dispatch(toggleDone({ id: it.task.id, done: true }))}
                  className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md border-[1.6px] border-[#D89A86] text-white hover:border-accent"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px]">{it.task.title}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-over">
                    <IconClock size={13} />
                    {fmtDate(it.task.due_date!)} · 逾期 {overdueDays(it.task.due_date!, today)} 天
                  </div>
                </div>
                <span className="whitespace-nowrap rounded-md bg-[#EFEDE6] px-2 py-0.5 text-[11px] text-ink2">一次性</span>
              </div>
            ))}
          </div>
        </>
      )}

      {days.map((d, idx) => {
        const list = byDay.get(d) ?? [];
        return (
          <div key={d}>
            <div className="flex items-center gap-2 px-4 pt-4 pb-1.5 text-xs tracking-[0.5px] md:px-7">
              <span className={`font-medium ${idx === 0 ? "text-accent" : "text-ink2"}`}>
                {fmtDate(d)} · {weekday(d)}
              </span>
              {idx === 0 && <small className="text-accent">今天</small>}
              {idx === 1 && <small className="text-ink3">明天</small>}
              {list.length > 0 && <small className="text-ink3">{list.filter((i) => i.done).length}/{list.length}</small>}
            </div>
            <div className="px-2 md:px-5">
              {list.length === 0 ? (
                <div className="px-3.5 py-1.5 text-[13px] text-ink3">—</div>
              ) : (
                list.map(row)
              )}
            </div>
          </div>
        );
      })}
    </main>
  );
}

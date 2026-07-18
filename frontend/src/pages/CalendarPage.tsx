import { IconCheck, IconChevronLeft, IconChevronRight, IconRepeat } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toggleDone } from "../app/dashboardSlice";
import { useAppDispatch, useAppSelector } from "../app/store";
import { api } from "../lib/api";
import { fmtDate, fmtRecurrence, weekday } from "../lib/format";
import type { Task } from "../types";

interface CalItem {
  task: Task;
  date: string;
  kind: "once" | "recurring";
  done: boolean;
}

const WD_HEAD = ["一", "二", "三", "四", "五", "六", "日"];
const pad = (n: number) => String(n).padStart(2, "0");

export default function CalendarPage() {
  const dispatch = useAppDispatch();
  const today = useAppSelector((s) => s.dashboard.date); // UTC+8 的今天
  const [ym, setYm] = useState<{ y: number; m: number } | null>(null); // m: 1-12
  const [items, setItems] = useState<CalItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState(false);

  // 初始定位到"今天"所在月
  useEffect(() => {
    if (today && !ym) setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  }, [today, ym]);

  const load = useCallback(async (y: number, m: number) => {
    const from = `${y}-${pad(m)}-01`;
    const to = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
    try {
      const res = await api<{ items: CalItem[] }>(`/calendar?from=${from}&to=${to}`);
      setItems(res.items);
      setError(false);
    } catch {
      setError(true); // 离线时日历暂不可用(纯读视图,不走发件箱)
    }
  }, []);

  useEffect(() => {
    if (ym) void load(ym.y, ym.m);
  }, [ym, load]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const it of items) {
      (m.get(it.date) ?? m.set(it.date, []).get(it.date)!).push(it);
    }
    return m;
  }, [items]);

  if (!ym) return <div className="flex items-center justify-center bg-bg xl:col-span-2 text-ink3 text-[13px]">加载中…</div>;

  const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
  // 周一开头的前导空格
  const lead = (new Date(ym.y, ym.m - 1, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${ym.y}-${pad(ym.m)}-${pad(i + 1)}`),
  ];

  const nav = (delta: number) => {
    const d = new Date(ym.y, ym.m - 1 + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() + 1 });
    setSelected(null);
  };

  const selItems = selected ? (byDay.get(selected) ?? []) : [];

  const dayList = selected && (
    <div className="border-t border-line xl:border-t-0">
      <div className="px-5 pt-4 pb-2 text-[13px] text-ink2">
        {fmtDate(selected)} · {weekday(selected)}
        {selected === today && <span className="ml-1.5 text-accent">今天</span>}
      </div>
      {selItems.length === 0 ? (
        <div className="px-5 py-3 text-[13px] text-ink3">这天没有任务</div>
      ) : (
        <div className="px-3 pb-6">
          {selItems.map((it) => (
            <div key={`${it.task.id}|${it.date}`} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-bg">
              <button
                aria-label={it.done ? "取消完成" : "完成"}
                onClick={() => {
                  void dispatch(toggleDone({ id: it.task.id, done: !it.done, date: it.date }));
                  // 乐观更新本地日历状态
                  setItems((prev) =>
                    prev.map((p) => (p.task.id === it.task.id && p.date === it.date ? { ...p, done: !it.done } : p)),
                  );
                }}
                className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md border-[1.6px] text-white ${
                  it.done ? "border-accent bg-accent" : "border-line2 hover:border-accent"
                }`}
              >
                {it.done && <IconCheck size={12} />}
              </button>
              <span className={`flex-1 text-[14px] ${it.done ? "text-ink3 line-through" : ""}`}>{it.task.title}</span>
              {it.kind === "recurring" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-rec-soft px-2 py-0.5 text-[11px] text-rec">
                  <IconRepeat size={11} />
                  {fmtRecurrence(it.task.recurrence!)}
                </span>
              ) : (
                <span className="rounded-md bg-[#EFEDE6] px-2 py-0.5 text-[11px] text-ink2">一次性</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <main className="flex flex-col overflow-y-auto bg-bg pb-16 md:pb-0">
        <div className="flex items-center justify-between px-4 pt-5 pb-3 md:px-7">
          <h1 className="text-xl font-medium">
            {ym.y} 年 {ym.m} 月
          </h1>
          <div className="flex items-center gap-1">
            <button onClick={() => nav(-1)} aria-label="上个月" className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] text-ink2 hover:bg-sidebar"><IconChevronLeft size={18} /></button>
            <button
              onClick={() => { setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }); setSelected(today); }}
              className="rounded-[7px] px-2.5 py-1 text-[13px] text-ink2 hover:bg-sidebar"
            >
              今天
            </button>
            <button onClick={() => nav(1)} aria-label="下个月" className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] text-ink2 hover:bg-sidebar"><IconChevronRight size={18} /></button>
          </div>
        </div>

        {error && <div className="px-4 pb-2 text-xs text-over md:px-7">离线中,日历暂不可用</div>}

        <div className="grid grid-cols-7 px-4 pb-1 md:px-7">
          {WD_HEAD.map((w) => (
            <div key={w} className="pb-1.5 text-center text-[11px] tracking-[1px] text-ink3">{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 px-4 pb-6 md:px-7">
          {cells.map((day, i) =>
            day === null ? (
              <div key={`x${i}`} />
            ) : (
              <button
                key={day}
                onClick={() => setSelected(day)}
                className={`flex min-h-[64px] flex-col items-stretch gap-0.5 rounded-[10px] border p-1.5 text-left transition-colors md:min-h-[84px] ${
                  selected === day ? "border-line2 bg-surface" : "border-transparent hover:bg-surface"
                }`}
              >
                <span
                  className={`mb-0.5 flex h-5 w-5 items-center justify-center self-start rounded-full text-[11.5px] ${
                    day === today ? "bg-accent font-medium text-white" : "text-ink2"
                  }`}
                >
                  {Number(day.slice(8))}
                </span>
                {(byDay.get(day) ?? []).slice(0, 3).map((it) => (
                  <span
                    key={`${it.task.id}|${it.date}`}
                    className={`hidden truncate rounded px-1 py-px text-[10.5px] leading-[1.5] md:block ${
                      it.done
                        ? "text-ink3 line-through"
                        : it.kind === "recurring"
                          ? "bg-rec-soft text-rec"
                          : "bg-[#EFEDE6] text-ink"
                    }`}
                  >
                    {it.task.title}
                  </span>
                ))}
                {/* 手机:标题放不下,用点表示 */}
                <span className="flex gap-0.5 md:hidden">
                  {(byDay.get(day) ?? []).slice(0, 4).map((it) => (
                    <i
                      key={`${it.task.id}|${it.date}`}
                      className={`h-1.5 w-1.5 rounded-full ${it.done ? "bg-line2" : it.kind === "recurring" ? "bg-rec" : "bg-accent"}`}
                    />
                  ))}
                </span>
                {(byDay.get(day)?.length ?? 0) > 3 && (
                  <span className="hidden text-[10px] text-ink3 md:block">+{byDay.get(day)!.length - 3}</span>
                )}
              </button>
            ),
          )}
        </div>

        {/* 手机/中屏:选中日的任务列表直接跟在月格下面 */}
        <div className="xl:hidden">{dayList}</div>
      </main>

      {/* xl:右侧第四栏放选中日列表 */}
      <aside className="hidden flex-col overflow-y-auto border-l border-line bg-surface xl:flex">
        {selected ? dayList : (
          <div className="flex flex-1 items-center justify-center text-[13px] text-ink3">点一天看当天任务</div>
        )}
      </aside>
    </>
  );
}

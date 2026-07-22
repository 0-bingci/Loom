import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconNote,
  IconRepeat,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toggleDone } from "../app/dashboardSlice";
import { syncNow } from "../app/sync";
import { useAppDispatch, useAppSelector } from "../app/store";
import { api } from "../lib/api";
import { sendOrQueue } from "../lib/outbox";
import { fmtDate, fmtRecurrence, weekday } from "../lib/format";
import type { Task } from "../types";

interface CalItem {
  task: Task;
  date: string;
  kind: "once" | "recurring";
  done: boolean;
  day_note: string | null;
}

/** 自动撑高、失焦保存的备注框。挂载时以 initial 打底;切换任务靠外层 key 重新挂载。 */
function AutoNote({
  initial,
  label,
  hint,
  placeholder,
  onSave,
}: {
  initial: string;
  label: string;
  hint?: string;
  placeholder: string;
  onSave: (note: string | null) => Promise<void> | void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const savedInitial = useRef(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [v]);

  const save = async () => {
    if (v === savedInitial.current) return;
    await onSave(v || null);
    savedInitial.current = v;
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="text-[12.5px] text-ink3">
      {label}
      {hint && <span className="ml-1.5 text-[11px] text-ink3">{hint}</span>}
      {saved && <span className="ml-2 text-[11px] text-accent">已保存</span>}
      <textarea
        ref={ref}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => void save()}
        placeholder={placeholder}
        rows={2}
        className="mt-1 min-h-[52px] w-full resize-none overflow-hidden rounded-lg border border-line bg-bg px-2.5 py-1.5 font-[inherit] text-[13px] text-ink outline-none focus:border-accent"
      />
    </div>
  );
}

const WD_HEAD = ["一", "二", "三", "四", "五", "六", "日"];
const pad = (n: number) => String(n).padStart(2, "0");

export default function CalendarPage() {
  const dispatch = useAppDispatch();
  const today = useAppSelector((s) => s.dashboard.date); // UTC+8 的今天
  const [ym, setYm] = useState<{ y: number; m: number } | null>(null); // m: 1-12
  const [items, setItems] = useState<CalItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null); // 展开备注的任务:`${task.id}|${date}`
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
          {selItems.map((it) => {
            const key = `${it.task.id}|${it.date}`;
            const open = openKey === key;
            const saveShared = async (note: string | null) => {
              await sendOrQueue({ method: "PATCH", path: `/tasks/${it.task.id}`, body: { note } });
              setItems((prev) => prev.map((p) => (p.task.id === it.task.id ? { ...p, task: { ...p.task, note } } : p)));
              void dispatch(syncNow());
            };
            const saveDay = async (note: string | null) => {
              await sendOrQueue({ method: "POST", path: `/tasks/${it.task.id}/day-note`, body: { date: it.date, note } });
              setItems((prev) => prev.map((p) => (p.task.id === it.task.id && p.date === it.date ? { ...p, day_note: note } : p)));
              void dispatch(syncNow());
            };
            return (
              <div key={key} className={`rounded-[10px] ${open ? "bg-bg" : ""}`}>
                <div className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-bg">
                  <button
                    aria-label={it.done ? "取消完成" : "完成"}
                    onClick={() => {
                      void dispatch(toggleDone({ id: it.task.id, done: !it.done, date: it.date }));
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
                  <button
                    onClick={() => setOpenKey((k) => (k === key ? null : key))}
                    title="点击查看/编辑备注"
                    className={`flex min-w-0 flex-1 items-center gap-1.5 text-left text-[14px] ${it.done ? "text-ink3 line-through" : ""}`}
                  >
                    <IconChevronDown size={13} className={`shrink-0 text-ink3 transition-transform ${open ? "" : "-rotate-90"}`} />
                    <span className="truncate">{it.task.title}</span>
                    {(it.task.note || it.day_note) && <IconNote size={12} className="shrink-0 text-ink3" />}
                  </button>
                  {it.kind === "recurring" ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rec-soft px-2 py-0.5 text-[11px] text-rec">
                      <IconRepeat size={11} />
                      {fmtRecurrence(it.task.recurrence!)}
                    </span>
                  ) : (
                    <span className="rounded-md bg-[#EFEDE6] px-2 py-0.5 text-[11px] text-ink2">一次性</span>
                  )}
                </div>
                {open && (
                  <div className="flex flex-col gap-3 px-3 pb-3 pt-0.5">
                    <AutoNote
                      key={`${key}|shared`}
                      initial={it.task.note ?? ""}
                      label="备注"
                      hint={it.kind === "recurring" ? "每天都看得到" : undefined}
                      placeholder="写点描述…(离开输入框自动保存)"
                      onSave={saveShared}
                    />
                    {it.kind === "recurring" && (
                      <AutoNote
                        key={`${key}|day`}
                        initial={it.day_note ?? ""}
                        label="今天的记录"
                        hint={`仅 ${it.date} 这天`}
                        placeholder="这天具体做了啥…(离开输入框自动保存)"
                        onSave={saveDay}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
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

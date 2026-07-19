import { IconFilter } from "@tabler/icons-react";
import { useState } from "react";
import AddBar from "../components/AddBar";
import DetailPanel from "../components/DetailPanel";
import TaskRow from "../components/TaskRow";
import { useAppSelector } from "../app/store";
import { fmtDate, weekday } from "../lib/format";
import type { DashboardItem } from "../types";

/** 今天视图的筛选器:决定"不看什么"。存 localStorage,跨会话持久。 */
interface TodayFilter {
  done: boolean; // 已完成
  once: boolean; // 一次性
  recurring: boolean; // 循环
  parked: boolean; // 停靠区(等待/酝酿)
}

const FILTER_KEY = "loom_today_filter";
const defaultFilter: TodayFilter = { done: true, once: true, recurring: true, parked: true };

function loadFilter(): TodayFilter {
  try {
    return { ...defaultFilter, ...JSON.parse(localStorage.getItem(FILTER_KEY) ?? "{}") };
  } catch {
    return defaultFilter;
  }
}

const FILTER_LABELS: [keyof TodayFilter, string][] = [
  ["done", "已完成"],
  ["once", "一次性任务"],
  ["recurring", "循环任务"],
  ["parked", "停靠区(等待/酝酿)"],
];

function matches(it: DashboardItem, f: TodayFilter): boolean {
  if (!f.done && it.done) return false;
  if (!f.once && it.kind === "once") return false;
  if (!f.recurring && it.kind === "recurring") return false;
  if (!f.parked && it.kind === "once" && (it.task.status === "waiting" || it.task.status === "incubating")) {
    return false;
  }
  return true;
}

export default function TodayPage() {
  const { date, items, loaded } = useAppSelector((s) => s.dashboard);
  const [filter, setFilter] = useState<TodayFilter>(loadFilter);
  const [filterOpen, setFilterOpen] = useState(false);

  const setF = (key: keyof TodayFilter, v: boolean) => {
    const next = { ...filter, [key]: v };
    setFilter(next);
    localStorage.setItem(FILTER_KEY, JSON.stringify(next));
  };

  const filtered = items.filter((it) => matches(it, filter));
  const over = filtered.filter((i) => i.overdue);
  const today = filtered.filter((i) => !i.overdue);
  const hidden = items.length - filtered.length;
  // 进度条永远按全量算,不受筛选影响
  const done = items.filter((i) => i.done).length;
  const filterActive = Object.values(filter).some((v) => !v);

  return (
    <>
      <main className="flex flex-col overflow-y-auto bg-bg">
        <div className="flex items-end justify-between px-4 pt-5 pb-1.5 md:px-7">
          <h1 className="flex items-baseline gap-2.5 text-xl font-medium">
            今天
            {date && (
              <span className="text-[13px] font-normal text-ink3">
                {fmtDate(date)} · {weekday(date)}
              </span>
            )}
          </h1>
          <div className="relative">
            <button
              aria-label="筛选"
              title="筛选(决定不看什么,记住你的选择)"
              onClick={() => setFilterOpen((v) => !v)}
              className={`relative flex h-[30px] w-[30px] items-center justify-center rounded-[7px] ${
                filterOpen ? "bg-sidebar text-ink" : "text-ink3 hover:bg-sidebar hover:text-ink2"
              }`}
            >
              <IconFilter size={18} />
              {filterActive && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-9 z-10 w-52 rounded-[10px] border border-line bg-surface p-2 shadow-lg">
                <div className="px-2 pb-1.5 pt-1 text-[11px] tracking-[0.5px] text-ink3">显示哪些</div>
                {FILTER_LABELS.map(([key, label]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-bg"
                  >
                    <input
                      type="checkbox"
                      checked={filter[key]}
                      onChange={(e) => setF(key, e.target.checked)}
                      className="accent-[#1F7A6B]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 织布进度条(按全量,不受筛选影响) */}
        <div className="mx-4 mt-3 mb-1 flex h-[5px] overflow-hidden rounded-full bg-[#EDEAE2] md:mx-7">
          <i
            className="block h-full bg-accent transition-[width] duration-300"
            style={{ width: items.length ? `${Math.round((done / items.length) * 100)}%` : "0%" }}
          />
        </div>
        <div className="px-4 pb-2 text-xs text-ink3 md:px-7">
          完成 {done} / {items.length} · 今天织进 {items.length} 条
          {hidden > 0 && <span> · 筛掉 {hidden} 条</span>}
        </div>

        <AddBar />

        {loaded && over.length > 0 && (
          <>
            <div className="flex items-center gap-[7px] px-4 pt-4 pb-1.5 text-xs tracking-[0.5px] md:px-7">
              <span className="font-medium text-over">逾期</span>
              <small className="text-ink3">未做完,一直挂着</small>
            </div>
            <div className="px-2 md:px-5">
              {over.map((it, i) => (
                <TaskRow key={it.task.id} item={it} index={i} />
              ))}
            </div>
          </>
        )}

        <div className="flex items-center gap-[7px] px-4 pt-4 pb-1.5 text-xs tracking-[0.5px] md:px-7">
          <span className="font-medium text-ink2">今天</span>
        </div>
        <div className="px-2 pb-24 md:px-5 md:pb-6">
          {!loaded ? (
            <div className="px-3.5 py-3 text-[13px] text-ink3">加载中…</div>
          ) : today.length === 0 ? (
            <div className="px-3.5 py-3 text-[13px] text-ink3">
              {hidden > 0 ? "都被筛掉了——点右上角调整筛选" : "今天没有任务 🎉"}
            </div>
          ) : (
            today.map((it, i) => <TaskRow key={it.task.id} item={it} index={over.length + i} />)
          )}
        </div>
      </main>

      <DetailPanel />
    </>
  );
}

import { IconBellRinging, IconCalendarPlus, IconFilter, IconTarget } from "@tabler/icons-react";
import { useState } from "react";
import { applySortOrders, selectTask, setPlanDate, toggleDone } from "../app/dashboardSlice";
import { markRead } from "../app/notificationsSlice";
import { syncNow } from "../app/sync";
import AddBar from "../components/AddBar";
import DetailPanel from "../components/DetailPanel";
import TaskRow from "../components/TaskRow";
import { useAppDispatch, useAppSelector } from "../app/store";
import { sendOrQueue } from "../lib/outbox";
import { fmtDate, weekday } from "../lib/format";
import { useSettings } from "../lib/settings";
import type { DashboardItem } from "../types";

/** 到点的提醒:顶在今天页最上面,直到你处理它 */
function ReminderBanner() {
  const dispatch = useAppDispatch();
  const notifs = useAppSelector((s) => s.notifications.items);
  const items = useAppSelector((s) => s.dashboard.items);
  if (notifs.length === 0) return null;

  const titleOf = (taskId: string) =>
    items.find((i) => i.task.id === taskId)?.task.title ?? "一个任务";
  const remindOf = (taskId: string) =>
    items.find((i) => i.task.id === taskId)?.task.remind_time;

  return (
    <div className="mx-4 mt-3 rounded-[10px] border border-accent/40 bg-accent-soft md:mx-7">
      {notifs.map((n) => (
        <div key={n.id} className="row-in flex items-center gap-2.5 px-3.5 py-2.5 [&+&]:border-t [&+&]:border-accent/20">
          <IconBellRinging size={17} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
            该做「{titleOf(n.task_id)}」了
            {remindOf(n.task_id) && <span className="text-ink2">(约定 {remindOf(n.task_id)})</span>}
          </span>
          <button
            onClick={() => {
              void dispatch(toggleDone({ id: n.task_id, done: true }));
              void dispatch(markRead(n.id));
            }}
            className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs text-white"
          >
            完成
          </button>
          <button
            onClick={() => void dispatch(markRead(n.id))}
            className="shrink-0 rounded-md border border-accent/40 px-2.5 py-1 text-xs text-accent hover:bg-accent/10"
          >
            知道了
          </button>
        </div>
      ))}
    </div>
  );
}

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

/** 距死线的中文提示 */
function daysLeftLabel(d: number | null): string {
  if (d == null) return "";
  return d <= 1 ? "明天到期" : `还剩 ${d} 天`;
}

/** 临近死线区的一行:只有死线、还没排期。可「今天做」或排到任意一天。 */
function UpcomingRow({ item, today }: { item: DashboardItem; today: string }) {
  const dispatch = useAppDispatch();
  const t = item.task;
  const near = (item.days_left ?? 99) <= 3;

  const plan = (date: string | null) =>
    void dispatch(setPlanDate({ id: t.id, plan_date: date })).then(() => void dispatch(syncNow()));

  return (
    <div className="row-in group flex items-center gap-3 rounded-[10px] border border-transparent px-3.5 py-[10px] hover:bg-surface">
      <span className="w-[18px] shrink-0 text-center text-ink3"><IconTarget size={16} /></span>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => dispatch(selectTask(t.id))}>
        <div className="truncate text-[14px] leading-[1.35] text-ink2">{t.title}</div>
        <div className={`mt-0.5 text-xs ${near ? "text-over" : "text-ink3"}`}>
          {fmtDate(t.due_date!)} 截止 · {daysLeftLabel(item.days_left)}
        </div>
      </div>
      <button
        onClick={() => plan(today)}
        className="shrink-0 rounded-md bg-accent-soft px-2.5 py-1 text-xs text-accent hover:bg-accent/15"
      >
        今天做
      </button>
      <label
        title="排到某天做"
        className="relative flex h-[26px] w-[26px] shrink-0 cursor-pointer items-center justify-center rounded-md text-ink3 hover:bg-bg hover:text-ink2"
      >
        <IconCalendarPlus size={16} />
        <input
          type="date"
          min={today}
          onChange={(e) => e.target.value && plan(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

export default function TodayPage() {
  const dispatch = useAppDispatch();
  const { date, items, loaded } = useAppSelector((s) => s.dashboard);
  const [filter, setFilter] = useState<TodayFilter>(loadFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null); // 当前悬停的目标行(插到它前面)

  /**
   * 放下:插到 targetId 前面(targetId 为 null = 段尾)。
   * 序号取邻居中点;邻居还没编过号就给整段重新编号(首次拖拽时发生一次)。
   */
  const dropIn = (section: DashboardItem[], targetId: string | null) => {
    setOverId(null);
    const fromId = dragId;
    setDragId(null);
    if (!fromId || fromId === targetId) return;
    const moved = section.find((i) => i.task.id === fromId);
    if (!moved) return; // 不允许跨段(逾期/今天)拖
    const rest = section.filter((i) => i.task.id !== fromId);
    const at = targetId === null ? rest.length : rest.findIndex((i) => i.task.id === targetId);
    if (at < 0) return;
    const arr = [...rest.slice(0, at), moved, ...rest.slice(at)];

    const prev = arr[at - 1];
    const next = arr[at + 1];
    let patches: { id: string; sort_order: number }[];
    if ((prev && prev.task.sort_order == null) || (next && next.task.sort_order == null)) {
      patches = arr.map((it, i) => ({ id: it.task.id, sort_order: i }));
    } else if (prev && next) {
      patches = [{ id: fromId, sort_order: (prev.task.sort_order! + next.task.sort_order!) / 2 }];
    } else if (prev) {
      patches = [{ id: fromId, sort_order: prev.task.sort_order! + 1 }];
    } else if (next) {
      patches = [{ id: fromId, sort_order: next.task.sort_order! - 1 }];
    } else {
      return; // 只有一条,没得排
    }

    dispatch(applySortOrders(patches)); // 界面立刻重排
    for (const p of patches) {
      void sendOrQueue({ method: "PATCH", path: `/tasks/${p.id}`, body: { sort_order: p.sort_order } });
    }
  };

  const draggableRow = (it: DashboardItem, section: DashboardItem[], index: number) => (
    <div
      key={it.task.id}
      draggable
      title="可拖拽调整顺序"
      onDragStart={() => setDragId(it.task.id)}
      onDragOver={(e) => {
        e.preventDefault();
        if (dragId && dragId !== it.task.id) setOverId(it.task.id);
      }}
      onDragLeave={() => overId === it.task.id && setOverId(null)}
      onDrop={() => dropIn(section, it.task.id)}
      onDragEnd={() => { setDragId(null); setOverId(null); }}
      className={overId === it.task.id ? "border-t-2 border-accent" : "border-t-2 border-transparent"}
    >
      <TaskRow item={it} index={index} />
    </div>
  );

  /** 段尾落点:拖到列表最后 */
  const tailZone = (section: DashboardItem[]) => (
    <div
      className={`h-3 ${overId === `tail` && dragId ? "border-t-2 border-accent" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOverId("tail"); }}
      onDrop={() => dropIn(section, null)}
    />
  );

  const setF = (key: keyof TodayFilter, v: boolean) => {
    const next = { ...filter, [key]: v };
    setFilter(next);
    localStorage.setItem(FILTER_KEY, JSON.stringify(next));
  };

  const { ddlLeadDays } = useSettings();
  const filtered = items.filter((it) => matches(it, filter));
  const over = filtered.filter((i) => i.overdue);
  const dueToday = filtered.filter((i) => i.due_today);
  const today = filtered.filter((i) => !i.overdue && !i.due_today && !i.upcoming);
  // 临近死线:只显示窗口内(死线前 N 天,N 由浏览器设置决定)的
  const upcoming = filtered.filter((i) => i.upcoming && (i.days_left ?? Infinity) <= ddlLeadDays);
  // 计数/进度只算"今天要做的",不含临近死线预告
  const main = items.filter((i) => !i.upcoming);
  const done = main.filter((i) => i.done).length;
  const hidden = main.length - over.length - dueToday.length - today.length;
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

        <ReminderBanner />

        {/* 织布进度条(按全量,不受筛选影响) */}
        <div className="mx-4 mt-3 mb-1 flex h-[5px] overflow-hidden rounded-full bg-[#EDEAE2] md:mx-7">
          <i
            className="block h-full bg-accent transition-[width] duration-300"
            style={{ width: main.length ? `${Math.round((done / main.length) * 100)}%` : "0%" }}
          />
        </div>
        <div className="px-4 pb-2 text-xs text-ink3 md:px-7">
          完成 {done} / {main.length} · 今天织进 {main.length} 条
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
              {over.map((it, i) => draggableRow(it, over, i))}
              {tailZone(over)}
            </div>
          </>
        )}

        {loaded && dueToday.length > 0 && (
          <>
            <div className="flex items-center gap-[7px] px-4 pt-4 pb-1.5 text-xs tracking-[0.5px] md:px-7">
              <span className="font-medium text-over">今天截止</span>
              <small className="text-ink3">死线就是今天</small>
            </div>
            <div className="px-2 md:px-5">
              {dueToday.map((it, i) => draggableRow(it, dueToday, over.length + i))}
              {tailZone(dueToday)}
            </div>
          </>
        )}

        <div className="flex items-center gap-[7px] px-4 pt-4 pb-1.5 text-xs tracking-[0.5px] md:px-7">
          <span className="font-medium text-ink2">今天</span>
        </div>
        <div className="px-2 md:px-5">
          {!loaded ? (
            <div className="px-3.5 py-3 text-[13px] text-ink3">加载中…</div>
          ) : today.length === 0 ? (
            <div className="px-3.5 py-3 text-[13px] text-ink3">
              {hidden > 0 ? "都被筛掉了——点右上角调整筛选" : "今天没有任务 🎉"}
            </div>
          ) : (
            <>
              {today.map((it, i) => draggableRow(it, today, over.length + dueToday.length + i))}
              {tailZone(today)}
            </>
          )}
        </div>

        {loaded && upcoming.length > 0 && (
          <>
            <div className="flex items-center gap-[7px] px-4 pt-5 pb-1.5 text-xs tracking-[0.5px] md:px-7">
              <span className="font-medium text-ink2">临近死线</span>
              <small className="text-ink3">还没排期——挑一天做</small>
            </div>
            <div className="px-2 pb-24 md:px-5 md:pb-6">
              {upcoming.map((it) => (
                <UpcomingRow key={it.task.id} item={it} today={date} />
              ))}
            </div>
          </>
        )}
        {!(loaded && upcoming.length > 0) && <div className="pb-24 md:pb-6" />}
      </main>

      <DetailPanel />
    </>
  );
}

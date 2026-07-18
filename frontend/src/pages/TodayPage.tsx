import { IconArrowsSort, IconDots } from "@tabler/icons-react";
import AddBar from "../components/AddBar";
import DetailPanel from "../components/DetailPanel";
import TaskRow from "../components/TaskRow";
import { useAppSelector } from "../app/store";
import { fmtDate, weekday } from "../lib/format";

export default function TodayPage() {
  const { date, items, loaded } = useAppSelector((s) => s.dashboard);
  const over = items.filter((i) => i.overdue);
  const today = items.filter((i) => !i.overdue);
  const done = items.filter((i) => i.done).length;

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
          <div className="flex gap-1 text-ink3">
            <button aria-label="排序" title="规划中" className="h-[30px] w-[30px] rounded-[7px] opacity-55"><IconArrowsSort size={18} className="mx-auto" /></button>
            <button aria-label="更多" title="规划中" className="h-[30px] w-[30px] rounded-[7px] opacity-55"><IconDots size={18} className="mx-auto" /></button>
          </div>
        </div>

        {/* 织布进度条 */}
        <div className="mx-4 mt-3 mb-1 flex md:mx-7 h-[5px] overflow-hidden rounded-full bg-[#EDEAE2]">
          <i
            className="block h-full bg-accent transition-[width] duration-300"
            style={{ width: items.length ? `${Math.round((done / items.length) * 100)}%` : "0%" }}
          />
        </div>
        <div className="px-4 pb-2 text-xs md:px-7 text-ink3">
          完成 {done} / {items.length} · 今天织进 {items.length} 条
        </div>

        <AddBar />

        {loaded && over.length > 0 && (
          <>
            <div className="flex items-center gap-[7px] px-4 pt-4 pb-1.5 md:px-7 text-xs tracking-[0.5px]">
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

        <div className="flex items-center gap-[7px] px-4 pt-4 pb-1.5 md:px-7 text-xs tracking-[0.5px]">
          <span className="font-medium text-ink2">今天</span>
        </div>
        <div className="px-2 pb-24 md:px-5 md:pb-6">
          {!loaded ? (
            <div className="px-3.5 py-3 text-[13px] text-ink3">加载中…</div>
          ) : today.length === 0 ? (
            <div className="px-3.5 py-3 text-[13px] text-ink3">今天没有任务 🎉</div>
          ) : (
            today.map((it, i) => <TaskRow key={it.task.id} item={it} index={over.length + i} />)
          )}
        </div>
      </main>

      <DetailPanel />
    </>
  );
}

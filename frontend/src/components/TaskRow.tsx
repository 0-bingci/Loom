import { IconCheck, IconClock, IconRepeat } from "@tabler/icons-react";
import { toggleDone, selectTask } from "../app/dashboardSlice";
import { useAppDispatch, useAppSelector } from "../app/store";
import { fmtDate, fmtRecurrence, overdueDays } from "../lib/format";
import type { DashboardItem } from "../types";

export default function TaskRow({ item, index }: { item: DashboardItem; index: number }) {
  const dispatch = useAppDispatch();
  const selected = useAppSelector((s) => s.dashboard.selectedId) === item.task.id;
  const today = useAppSelector((s) => s.dashboard.date);
  const t = item.task;

  const pendingChip = item.pendingSync && (
    <span className="ml-1.5 text-[11px] text-ink3">待同步</span>
  );

  const meta = item.overdue ? (
    <div className="mt-0.5 flex items-center gap-1 text-xs text-over">
      <IconClock size={13} />
      {fmtDate(t.due_date!)} · 逾期 {overdueDays(t.due_date!, today)} 天
    </div>
  ) : t.remind_time ? (
    <div className="mt-0.5 flex items-center gap-1 text-xs text-ink2">
      <IconClock size={13} />
      {t.remind_time}
    </div>
  ) : null;

  return (
    <div
      className={`row-in flex cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-[11px] transition-colors ${
        selected ? "border-line2 bg-surface" : "border-transparent"
      } ${
        item.overdue
          ? "bg-over-row hover:bg-over-row-hover"
          : selected
            ? ""
            : "hover:bg-surface"
      }`}
      style={{ animationDelay: `${Math.min(index * 30, 240)}ms` }}
      onClick={() => dispatch(selectTask(t.id))}
    >
      <button
        aria-label={item.done ? "取消完成" : "完成"}
        onClick={(e) => {
          e.stopPropagation();
          void dispatch(toggleDone({ id: t.id, done: !item.done }));
        }}
        className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md border-[1.6px] text-white transition-colors ${
          item.done
            ? "border-accent bg-accent"
            : item.overdue
              ? "border-[#D89A86] hover:border-accent"
              : "border-line2 hover:border-accent"
        }`}
      >
        {item.done && <IconCheck size={12} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className={`text-[14.5px] leading-[1.35] ${item.done ? "text-ink3 line-through" : ""} ${item.pendingSync ? "opacity-70" : ""}`}>
          {t.title}
          {pendingChip}
        </div>
        {meta}
      </div>

      {item.kind === "recurring" ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-rec-soft px-2 py-0.5 text-[11px] text-rec">
          <IconRepeat size={11} />
          {fmtRecurrence(t.recurrence!)}
        </span>
      ) : (
        <span className="whitespace-nowrap rounded-md bg-[#EFEDE6] px-2 py-0.5 text-[11px] text-ink2">
          一次性
        </span>
      )}
    </div>
  );
}

import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { addTask } from "../app/dashboardSlice";
import { syncNow } from "../app/sync";
import { useAppDispatch, useAppSelector } from "../app/store";

const WEEKDAYS: [string, string][] = [
  ["MON", "一"], ["TUE", "二"], ["WED", "三"], ["THU", "四"],
  ["FRI", "五"], ["SAT", "六"], ["SUN", "日"],
];

export default function AddBar() {
  const dispatch = useAppDispatch();
  const today = useAppSelector((s) => s.dashboard.date);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"once" | "daily" | "weekly">("once");
  const [remind, setRemind] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const canSubmit = title.trim() && (kind !== "weekly" || days.length > 0);

  const submit = async () => {
    if (!canSubmit) return;
    const r = await dispatch(
      addTask({
        title: title.trim(),
        kind,
        remind_time: remind || null,
        due_date: today,
        weekdays: days,
        start_date: start || null,
        end_date: end || null,
      }),
    );
    setTitle("");
    // 在线时拉真相校准;离线时 addTask 已本地落列表
    if (addTask.fulfilled.match(r) && !r.payload.queued) void dispatch(syncNow());
  };

  if (!open) {
    return (
      <div
        className="mx-4 my-1 flex cursor-text items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 py-[11px] text-[13.5px] text-ink3 md:mx-7"
        onClick={() => setOpen(true)}
      >
        <IconPlus size={16} /> 添加任务
      </div>
    );
  }

  const toggleDay = (d: string) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <div className="mx-4 my-1 rounded-[10px] border border-accent bg-surface px-3.5 py-2 md:mx-7">
      <div className="flex flex-wrap items-center gap-2">
        <IconPlus size={16} className="text-ink3" />
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="任务标题,回车即建"
          className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] outline-none"
        />
        <div className="flex overflow-hidden rounded-md border border-line text-xs">
          {([["once", "今天"], ["daily", "每天"], ["weekly", "每周"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-2.5 py-1 ${kind === k ? "bg-accent-soft text-accent" : "text-ink2 hover:bg-sidebar"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="time"
          value={remind}
          onChange={(e) => setRemind(e.target.value)}
          title="提醒时间(可空);到点写入提醒"
          className="rounded-md border border-line px-1.5 py-0.5 text-xs text-ink2"
        />
        <button
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="rounded-md bg-accent px-3 py-1 text-xs text-white disabled:opacity-40"
        >
          添加
        </button>
      </div>

      {kind === "weekly" && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-xs text-ink3">周</span>
          {WEEKDAYS.map(([code, label]) => (
            <button
              key={code}
              onClick={() => toggleDay(code)}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors ${
                days.includes(code) ? "bg-accent text-white" : "bg-sidebar text-ink2 hover:bg-sidebar-hover"
              }`}
            >
              {label}
            </button>
          ))}
          {days.length === 0 && <span className="text-xs text-over">至少选一天</span>}
        </div>
      )}

      {kind !== "once" && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink3">
          生效区间(可空)
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                 className="rounded-md border border-line px-1.5 py-0.5 text-xs text-ink2" />
          –
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                 className="rounded-md border border-line px-1.5 py-0.5 text-xs text-ink2" />
          <span className="text-ink3">留空 = 不限;到期后自动消失</span>
        </div>
      )}
    </div>
  );
}

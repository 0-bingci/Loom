import {
  IconArchive,
  IconArchiveOff,
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconNote,
  IconRepeat,
  IconTrash,
} from "@tabler/icons-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toggleDone } from "../app/dashboardSlice";
import { syncNow } from "../app/sync";
import { useAppDispatch, useAppSelector } from "../app/store";
import { api } from "../lib/api";
import { sendOrQueue } from "../lib/outbox";
import { fmtDate, fmtRecurrence, fmtWindow } from "../lib/format";
import { STATUSES, statusMeta, type TaskStatus } from "../lib/status";
import type { Task } from "../types";

interface TaskWithStatus extends Task {
  once_done: boolean | null;
  once_done_at: string | null;
}

type SortKey = "created_at" | "title" | "date";

const pill = "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] whitespace-nowrap";
const th = "px-3 py-2 text-left text-xs font-medium text-ink2 select-none";
const td = "px-3 py-2 align-middle";

/** 展开行里的备注编辑:随内容撑高,失焦保存(离线走发件箱)。 */
function NoteEditor({ task, onSaved }: { task: TaskWithStatus; onSaved: (note: string | null) => void }) {
  const dispatch = useAppDispatch();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState(task.note ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [note]);

  const save = async () => {
    if (note === (task.note ?? "")) return;
    await sendOrQueue({ method: "PATCH", path: `/tasks/${task.id}`, body: { note: note || null } });
    onSaved(note || null);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    void dispatch(syncNow());
  };

  return (
    <div className="text-[13px] text-ink3">
      备注
      {task.recurrence && <span className="ml-1.5 text-[11px] text-ink3">(所有日子共享;某天的记录去今天/日历页写)</span>}
      {saved && <span className="ml-2 text-[11px] text-accent">已保存</span>}
      <textarea
        ref={ref}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => void save()}
        placeholder="写点描述…(离开输入框自动保存)"
        rows={3}
        className="mt-1.5 min-h-[72px] w-full resize-none overflow-hidden rounded-lg border border-line bg-bg px-3 py-2 font-[inherit] text-[13.5px] text-ink outline-none focus:border-accent"
      />
    </div>
  );
}

export default function AllTasksPage() {
  const dispatch = useAppDispatch();
  const today = useAppSelector((s) => s.dashboard.date);
  const [rows, setRows] = useState<TaskWithStatus[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "created_at", asc: false });
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api<TaskWithStatus[]>("/tasks?with_status=true&include_archived=true"));
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (t: TaskWithStatus, status: TaskStatus) => {
    setRows((prev) =>
      prev.map((r) => (r.id === t.id ? { ...r, status, once_done: status === "done" } : r)),
    );
    await sendOrQueue({ method: "PATCH", path: `/tasks/${t.id}`, body: { status } });
    void dispatch(syncNow());
  };

  const visible = useMemo(() => {
    const list = rows.filter((t) => showArchived || !t.archived);
    const dir = sort.asc ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = sort.key === "title" ? a.title : sort.key === "date" ? (a.due_date ?? a.start_date ?? "") : a.created_at;
      const vb = sort.key === "title" ? b.title : sort.key === "date" ? (b.due_date ?? b.start_date ?? "") : b.created_at;
      return va < vb ? -dir : va > vb ? dir : 0;
    });
  }, [rows, showArchived, sort]);

  const header = (key: SortKey, label: string) => (
    <th
      className={`${th} cursor-pointer hover:text-ink`}
      onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : false }))}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sort.key === key && (sort.asc ? <IconArrowUp size={12} /> : <IconArrowDown size={12} />)}
      </span>
    </th>
  );

  const toggleOnce = (t: TaskWithStatus) => {
    const done = !t.once_done;
    void dispatch(toggleDone({ id: t.id, done, date: t.due_date! }));
    setRows((prev) =>
      prev.map((r) => (r.id === t.id ? { ...r, once_done: done, status: done ? "done" : "todo" } : r)),
    );
  };

  const setArchived = async (t: TaskWithStatus, archived: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === t.id ? { ...r, archived } : r)));
    await sendOrQueue({ method: "PATCH", path: `/tasks/${t.id}`, body: { archived } });
    void dispatch(syncNow());
  };

  const remove = async (t: TaskWithStatus) => {
    if (!window.confirm(`删除「${t.title}」?其打卡记录与提醒会一并删除,不可恢复。`)) return;
    setRows((prev) => prev.filter((r) => r.id !== t.id));
    await sendOrQueue({ method: "DELETE", path: `/tasks/${t.id}` });
    void dispatch(syncNow());
  };

  return (
    <main className="flex flex-col overflow-y-auto bg-bg pb-20 md:pb-6 xl:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-5 pb-3 md:px-7">
        <h1 className="flex items-baseline gap-2.5 text-xl font-medium">
          所有
          <span className="text-[13px] font-normal text-ink3">
            {rows.filter((t) => !t.archived).length} 条
            {rows.some((t) => t.archived) && `,另有已归档 ${rows.filter((t) => t.archived).length} 条`}
          </span>
        </h1>
        <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-ink2">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="accent-[#1F7A6B]"
          />
          显示已归档
        </label>
      </div>

      {error && <div className="px-4 pb-2 text-xs text-over md:px-7">离线中,列表可能不新鲜</div>}

      <div className="mx-4 mb-6 overflow-x-auto rounded-[10px] border border-line bg-surface md:mx-7">
        <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-line bg-sidebar">
              <th className={`${th} w-10`}></th>
              {header("title", "标题")}
              <th className={th}>类型</th>
              {header("date", "日期 / 规则")}
              <th className={th}>提醒</th>
              <th className={th}>状态</th>
              {header("created_at", "创建时间")}
              <th className={`${th} w-20`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-ink3">
                  还没有任务
                </td>
              </tr>
            )}
            {visible.map((t) => {
              const overdueBadge =
                !t.recurrence && !t.archived && t.status !== "done" && t.status !== "closed" && t.due_date && today && t.due_date < today;
              const expanded = expandedId === t.id;
              return (
                <Fragment key={t.id}>
                <tr className={`border-b border-line hover:bg-bg ${expanded ? "bg-bg" : ""} ${t.archived ? "opacity-55" : ""}`}>
                  <td className={`${td} text-center`}>
                    {!t.recurrence && (
                      <button
                        aria-label={t.once_done ? "取消完成" : "完成"}
                        onClick={() => toggleOnce(t)}
                        className={`inline-flex h-[17px] w-[17px] items-center justify-center rounded-[5px] border-[1.5px] text-white ${
                          t.once_done ? "border-accent bg-accent" : "border-line2 hover:border-accent"
                        }`}
                      >
                        {t.once_done && <IconCheck size={11} />}
                      </button>
                    )}
                  </td>
                  <td
                    className={`${td} cursor-pointer ${t.once_done ? "text-ink3 line-through" : ""}`}
                    onClick={() => setExpandedId((id) => (id === t.id ? null : t.id))}
                    title="点击查看/编辑备注"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {expanded ? (
                        <IconChevronDown size={14} className="shrink-0 text-ink3" />
                      ) : (
                        <IconChevronRight size={14} className="shrink-0 text-ink3" />
                      )}
                      <span>{t.title}</span>
                      {t.note && <IconNote size={13} className="shrink-0 text-ink3" />}
                    </span>
                  </td>
                  <td className={td}>
                    {t.recurrence ? (
                      <span className={`${pill} bg-rec-soft text-rec`}>
                        <IconRepeat size={11} />循环
                      </span>
                    ) : (
                      <span className={`${pill} bg-[#EFEDE6] text-ink2`}>一次性</span>
                    )}
                  </td>
                  <td className={`${td} text-ink2`}>
                    {t.recurrence
                      ? fmtRecurrence(t.recurrence) + (fmtWindow(t.start_date, t.end_date) ? ` · ${fmtWindow(t.start_date, t.end_date)}` : "")
                      : fmtDate(t.due_date!)}
                  </td>
                  <td className={`${td} text-ink2`}>{t.remind_time ?? "—"}</td>
                  <td className={td}>
                    {t.archived ? (
                      <span className={`${pill} bg-[#EFEDE6] text-ink3`}>已归档</span>
                    ) : t.recurrence ? (
                      <span className={`${pill} bg-rec-soft text-rec`}>循环中</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <select
                          value={t.status}
                          onChange={(e) => void setStatus(t, e.target.value as TaskStatus)}
                          className={`cursor-pointer rounded-md border-0 px-1.5 py-0.5 text-[11px] outline-none ${statusMeta(t.status).cls}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        {overdueBadge && <span className={`${pill} bg-over-soft text-over`}>逾期</span>}
                      </span>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap text-ink3`}>{fmtDate(t.created_at.slice(0, 10))}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <button
                      aria-label={t.archived ? "取消归档" : "归档"}
                      title={t.archived ? "取消归档" : "归档(不再出现在视图里,保留记录)"}
                      onClick={() => void setArchived(t, !t.archived)}
                      className="mr-1.5 text-ink3 hover:text-ink"
                    >
                      {t.archived ? <IconArchiveOff size={16} /> : <IconArchive size={16} />}
                    </button>
                    <button
                      aria-label="删除"
                      title="删除(连带打卡记录,不可恢复)"
                      onClick={() => void remove(t)}
                      className="text-ink3 hover:text-over"
                    >
                      <IconTrash size={16} />
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-line bg-bg">
                    <td></td>
                    <td colSpan={7} className="px-3 pb-4 pt-0.5 pr-6">
                      <NoteEditor
                        task={t}
                        onSaved={(note) =>
                          setRows((prev) => prev.map((r) => (r.id === t.id ? { ...r, note } : r)))
                        }
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

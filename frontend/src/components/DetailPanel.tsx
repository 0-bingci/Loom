import {
  IconBell,
  IconCalendar,
  IconCalendarStats,
  IconCheck,
  IconList,
  IconPencil,
  IconProgress,
  IconRepeat,
  IconSquare,
  IconSquareCheck,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { selectTask, toggleDone } from "../app/dashboardSlice";
import { syncNow } from "../app/sync";
import { useAppDispatch, useAppSelector } from "../app/store";
import { sendOrQueue } from "../lib/outbox";
import { fmtRecurrence, fmtWindow, overdueDays } from "../lib/format";
import { STATUSES, type TaskStatus } from "../lib/status";
import type { DashboardItem, Task } from "../types";
import TaskEditor from "./TaskEditor";

function Prop({ icon, k, children }: { icon: React.ReactNode; k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-line py-[11px]">
      <span className="w-5 text-center text-ink3">{icon}</span>
      <span className="w-[66px] text-[13px] text-ink2">{k}</span>
      <span className="flex-1 text-[13.5px]">{children}</span>
    </div>
  );
}

const pill = "inline-flex items-center gap-1.5 rounded-lg px-[11px] py-1 text-[13px]";

/** 底部祝福语:按星期轮换 */
const BLESSINGS = [
  "留点时间给自己 🌙",
  "今天也要开心呀 ✨",
  "慢慢来,比较快 🌱",
  "把一天织成喜欢的样子 🧶",
  "任务会做完的,先照顾好自己 ☕",
  "小步前进也是前进 🐾",
  "天天开心,万事顺意 🌞",
];

/** 标题:点进去直接改,失焦保存 */
function TitleBox({ task, done }: { task: Task; done: boolean }) {
  const dispatch = useAppDispatch();
  const [v, setV] = useState(task.title);
  useEffect(() => setV(task.title), [task.id, task.title]);

  const save = async () => {
    const trimmed = v.trim();
    if (!trimmed || trimmed === task.title) {
      setV(task.title);
      return;
    }
    await sendOrQueue({ method: "PATCH", path: `/tasks/${task.id}`, body: { title: trimmed } });
    void dispatch(syncNow());
  };

  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`w-full border-0 bg-transparent text-[19px] font-medium leading-[1.35] outline-none ${
        done ? "text-ink3 line-through" : ""
      }`}
    />
  );
}

/** 状态选择:六态两族,点击即存(仅非循环任务) */
function StatusPicker({ task }: { task: Task }) {
  const dispatch = useAppDispatch();
  const setStatus = async (s: TaskStatus) => {
    if (s === task.status) return;
    await sendOrQueue({ method: "PATCH", path: `/tasks/${task.id}`, body: { status: s } });
    void dispatch(syncNow());
  };
  return (
    <div className="flex items-start gap-3 border-t border-line py-[11px]">
      <span className="w-5 text-center text-ink3"><IconProgress size={17} /></span>
      <span className="w-[66px] pt-0.5 text-[13px] text-ink2">状态</span>
      <div className="flex flex-1 flex-wrap items-center gap-1">
        {/* "完成"不在这里——勾选框专管完成 */}
        {STATUSES.filter((s) => s.value !== "done").map((s) => (
          <button
            key={s.value}
            onClick={() => void setStatus(s.value)}
            className={`rounded-md px-2 py-0.5 text-[11.5px] transition-all ${s.cls} ${
              task.status === s.value ? "ring-1 ring-current" : "opacity-55 hover:opacity-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 任务备注:失焦自动保存(离线走发件箱) */
function NoteBox({ task }: { task: Task }) {
  const [note, setNote] = useState(task.note ?? "");
  const [saved, setSaved] = useState(false);

  // 切换任务时装入对应备注
  useEffect(() => {
    setNote(task.note ?? "");
    setSaved(false);
  }, [task.id]);

  const save = async () => {
    if (note === (task.note ?? "")) return;
    await sendOrQueue({ method: "PATCH", path: `/tasks/${task.id}`, body: { note: note || null } });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="mt-[18px] border-t border-line pt-4 text-[13px] text-ink3">
      备注{saved && <span className="ml-2 text-[11px] text-accent">已保存</span>}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => void save()}
        placeholder="写点什么…(离开输入框自动保存)"
        className="mt-2 min-h-[60px] w-full resize-none border-0 bg-transparent font-[inherit] text-ink outline-none"
      />
    </div>
  );
}

function DetailContent({ item, onClose }: { item: DashboardItem; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const today = useAppSelector((s) => s.dashboard.date);
  const [editing, setEditing] = useState(false);
  const t = item.task;

  // 切换选中任务时退出编辑态
  useEffect(() => setEditing(false), [t.id]);

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5 text-[13px] text-ink3">
        <span className="inline-flex items-center gap-1.5">
          {item.done ? <IconSquareCheck size={15} className="text-accent" /> : <IconSquare size={15} />}
          {item.done ? "已完成" : "未完成"}
          {item.pendingSync && <span className="text-[11px]">· 待同步</span>}
        </span>
        <div className="ml-auto flex gap-1.5">
          <button
            aria-label="编辑"
            title="编辑日期 / 循环规则 / 提醒"
            onClick={() => setEditing((v) => !v)}
            className={editing ? "text-accent" : "text-ink3 hover:text-ink"}
          >
            <IconPencil size={17} />
          </button>
          <button aria-label="关闭" className="text-ink3 hover:text-ink xl:hidden" onClick={onClose}>
            <IconX size={17} />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex-1 p-5">
          <TaskEditor task={t} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
        </div>
      ) : (
      <div className="flex-1 p-5">
        <div className="mb-3 text-xs text-ink3">今天 ›</div>
        <div className="mb-5 flex items-start gap-3">
          <button
            aria-label={item.done ? "取消完成" : "完成"}
            onClick={() => void dispatch(toggleDone({ id: t.id, done: !item.done }))}
            className={`mt-0.5 flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-md border-[1.6px] text-white ${
              item.done ? "border-accent bg-accent" : "border-line2 hover:border-accent"
            }`}
          >
            {item.done && <IconCheck size={13} />}
          </button>
          <TitleBox task={t} done={item.done} />
        </div>

        {item.kind === "recurring" ? (
          <>
            <Prop icon={<IconRepeat size={17} />} k="循环">
              <span className={`${pill} bg-rec-soft text-rec`}>
                <IconRepeat size={13} />
                {fmtRecurrence(t.recurrence!)}
              </span>
            </Prop>
            {fmtWindow(t.start_date, t.end_date) && (
              <Prop icon={<IconCalendarStats size={17} />} k="生效区间">
                <span className={`${pill} bg-[#EFEDE6] text-ink2`}>{fmtWindow(t.start_date, t.end_date)}</span>
              </Prop>
            )}
          </>
        ) : (
          <Prop icon={<IconCalendar size={17} />} k="日期">
            <span className="inline-flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={t.due_date!}
                onChange={(e) => {
                  if (!e.target.value) return;
                  void sendOrQueue({ method: "PATCH", path: `/tasks/${t.id}`, body: { due_date: e.target.value } }).then(
                    () => void dispatch(syncNow()),
                  );
                }}
                className={`cursor-pointer rounded-lg border-0 px-2.5 py-1 text-[13px] outline-none ${
                  item.overdue ? "bg-over-soft text-over" : "bg-[#EFEDE6] text-ink2"
                }`}
              />
              {item.overdue && (
                <span className="text-xs text-over">逾期 {overdueDays(t.due_date!, today)} 天</span>
              )}
            </span>
          </Prop>
        )}

        {item.kind === "once" && !item.done && <StatusPicker task={t} />}

        <Prop icon={<IconBell size={17} />} k="提醒">
          <span className="inline-flex items-center gap-2">
            <input
              type="time"
              value={t.remind_time ?? ""}
              onChange={(e) =>
                void sendOrQueue({
                  method: "PATCH",
                  path: `/tasks/${t.id}`,
                  body: { remind_time: e.target.value || null },
                }).then(() => void dispatch(syncNow()))
              }
              className={`cursor-pointer rounded-lg border-0 px-2.5 py-1 text-[13px] outline-none ${
                t.remind_time ? "bg-accent-soft text-accent" : "bg-[#EFEDE6] text-ink3"
              }`}
            />
            {t.remind_time && (
              <button
                onClick={() =>
                  void sendOrQueue({ method: "PATCH", path: `/tasks/${t.id}`, body: { remind_time: null } }).then(
                    () => void dispatch(syncNow()),
                  )
                }
                className="text-xs text-ink3 hover:text-ink"
              >
                清除
              </button>
            )}
          </span>
        </Prop>
        <Prop icon={<IconList size={17} />} k="清单">
          <span className="text-ink2">默认(清单规划中)</span>
        </Prop>

        <NoteBox task={t} />
      </div>
      )}

      <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-ink3">
        {BLESSINGS[new Date().getDay()]}
      </div>
    </>
  );
}

/** xl 及以上:固定第四栏;以下:选中任务时变成右侧抽屉(带遮罩) */
export default function DetailPanel() {
  const dispatch = useAppDispatch();
  const { items, selectedId } = useAppSelector((s) => s.dashboard);
  const item = items.find((i) => i.task.id === selectedId);
  const close = () => dispatch(selectTask(null));

  return (
    <>
      <aside className="hidden flex-col overflow-y-auto border-l border-line bg-surface xl:flex">
        {item ? (
          <DetailContent item={item} onClose={close} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-[13px] text-ink3">
            选中一条任务查看详情
          </div>
        )}
      </aside>

      {item && (
        <div className="fixed inset-0 z-30 xl:hidden">
          <div className="absolute inset-0 bg-black/25" onClick={close} />
          <div className="absolute inset-y-0 right-0 flex w-[min(92vw,360px)] flex-col overflow-y-auto bg-surface shadow-xl">
            <DetailContent item={item} onClose={close} />
          </div>
        </div>
      )}
    </>
  );
}

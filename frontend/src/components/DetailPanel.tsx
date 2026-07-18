import {
  IconBell,
  IconCalendar,
  IconCalendarStats,
  IconCheck,
  IconDots,
  IconFlag,
  IconList,
  IconRepeat,
  IconSquare,
  IconSquareCheck,
  IconX,
} from "@tabler/icons-react";
import { selectTask, toggleDone } from "../app/dashboardSlice";
import { useAppDispatch, useAppSelector } from "../app/store";
import { fmtDate, fmtRecurrence, fmtWindow, overdueDays } from "../lib/format";
import type { DashboardItem } from "../types";

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

function DetailContent({ item, onClose }: { item: DashboardItem; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const today = useAppSelector((s) => s.dashboard.date);
  const t = item.task;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5 text-[13px] text-ink3">
        <span className="inline-flex items-center gap-1.5">
          {item.done ? <IconSquareCheck size={15} className="text-accent" /> : <IconSquare size={15} />}
          {item.done ? "已完成" : "未完成"}
          {item.pendingSync && <span className="text-[11px]">· 待同步</span>}
        </span>
        <div className="ml-auto flex gap-1.5">
          <button aria-label="标记优先" className="text-ink3 opacity-55" title="规划中"><IconFlag size={17} /></button>
          <button aria-label="更多" className="text-ink3 opacity-55" title="规划中"><IconDots size={17} /></button>
          <button aria-label="关闭" className="text-ink3 hover:text-ink xl:hidden" onClick={onClose}>
            <IconX size={17} />
          </button>
        </div>
      </div>

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
          <div className={`text-[19px] font-medium leading-[1.35] ${item.done ? "text-ink3 line-through" : ""}`}>
            {t.title}
          </div>
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
            {item.overdue ? (
              <span className={`${pill} bg-over-soft text-over`}>
                {fmtDate(t.due_date!)} · 逾期 {overdueDays(t.due_date!, today)} 天
              </span>
            ) : (
              <span className={`${pill} bg-[#EFEDE6] text-ink2`}>{fmtDate(t.due_date!)}</span>
            )}
          </Prop>
        )}

        <Prop icon={<IconBell size={17} />} k="提醒">
          {t.remind_time ? (
            <span className={`${pill} bg-accent-soft text-accent`}>{t.remind_time}</span>
          ) : (
            <span className="text-ink3">未设置</span>
          )}
        </Prop>
        <Prop icon={<IconList size={17} />} k="清单">
          <span className="text-ink2">默认(清单规划中)</span>
        </Prop>

        <div className="mt-[18px] border-t border-line pt-4 text-[13px] text-ink3">
          备注
          <textarea
            placeholder="写点什么…(暂存本地,后端笔记功能规划中)"
            className="mt-2 min-h-[60px] w-full resize-none border-0 bg-transparent font-[inherit] text-ink outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-ink3">
        <IconBell size={14} /> 到点会写入提醒,客户端从这里拉取
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

import { IconBell, IconX } from "@tabler/icons-react";
import { markRead } from "../app/notificationsSlice";
import { useAppDispatch, useAppSelector } from "../app/store";

export default function NotifPanel({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const notifs = useAppSelector((s) => s.notifications.items);
  const items = useAppSelector((s) => s.dashboard.items);
  const titleOf = (taskId: string) =>
    items.find((i) => i.task.id === taskId)?.task.title ?? taskId;

  return (
    <div className="fixed bottom-16 left-2 right-2 z-20 rounded-xl md:bottom-14 md:left-16 md:right-auto md:w-80 border border-line bg-surface shadow-lg">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[13px] font-medium">
        <IconBell size={15} className="text-ink2" />
        提醒
        {notifs.length > 0 && <span className="text-ink3">({notifs.length})</span>}
        <button onClick={onClose} aria-label="关闭" className="ml-auto text-ink3 hover:text-ink">
          <IconX size={15} />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto p-1.5">
        {notifs.length === 0 ? (
          <div className="px-3 py-4 text-[13px] text-ink3">没有待处理的提醒</div>
        ) : (
          notifs.map((n) => (
            <div key={n.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 hover:bg-bg">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px]">{titleOf(n.task_id)}</div>
                <div className="text-xs text-ink3">{n.date}</div>
              </div>
              <button
                onClick={() => void dispatch(markRead(n.id))}
                className="rounded-md border border-line px-2.5 py-1 text-xs text-ink2 hover:border-line2 hover:text-ink"
              >
                知道了
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

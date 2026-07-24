import { syncNow } from "../app/sync";
import { fetchLists } from "../app/listsSlice";
import { useAppDispatch, useAppSelector } from "../app/store";
import { sendOrQueue } from "../lib/outbox";

/**
 * 清单选择器:把任务归到某清单,或设为未分类。
 * 改动走发件箱(离线可用),成功后刷新计数与看板。
 * onChanged:给自持行数据的页(如"所有")做本地乐观更新。
 */
export default function ListPicker({
  listId,
  taskId,
  onChanged,
}: {
  listId: string | null;
  taskId: string;
  onChanged?: (listId: string | null) => void;
}) {
  const dispatch = useAppDispatch();
  const lists = useAppSelector((s) => s.lists.items);

  const change = async (value: string) => {
    const next = value || null;
    if (next === listId) return;
    onChanged?.(next);
    await sendOrQueue({ method: "PATCH", path: `/tasks/${taskId}`, body: { list_id: next } });
    void dispatch(syncNow());
    void dispatch(fetchLists()); // 计数随之变
  };

  return (
    <select
      value={listId ?? ""}
      onChange={(e) => void change(e.target.value)}
      className={`cursor-pointer rounded-lg border-0 px-2.5 py-1 text-[13px] outline-none ${
        listId ? "bg-accent-soft text-accent" : "bg-[#EFEDE6] text-ink3"
      }`}
    >
      <option value="">未分类</option>
      {lists.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}

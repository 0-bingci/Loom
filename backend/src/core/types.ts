// core 对外的数据形状。API/worker 都消费这些类型,不直接碰表结构。

export interface Task {
  id: string;
  title: string;
  due_date: string | null; // 'YYYY-MM-DD',死线
  plan_date: string | null; // 'YYYY-MM-DD',计划哪天做;NULL=还没排
  recurrence: string | null; // 'daily' / 'weekly:MON,WED'
  start_date: string | null;
  end_date: string | null;
  remind_time: string | null; // 'HH:MM'
  note: string | null; // 备注(自由文本)
  sort_order: number | null; // 手动排序序号,NULL=未排
  /** 仅非循环任务有意义。推进线:todo/doing/testing/done;停靠区:waiting/incubating;关闭:closed(不做了,留档) */
  status: TaskStatus;
  archived: boolean;
  created_at: string; // ISO8601
}

export type TaskStatus = "todo" | "doing" | "testing" | "done" | "waiting" | "incubating" | "closed";

export interface TaskLog {
  id: string;
  task_id: string;
  date: string;
  done: boolean;
  done_at: string | null;
  notified: boolean;
  note: string | null; // 当天备注(循环任务按天各记各的)
}

export interface Notification {
  id: string;
  task_id: string;
  date: string;
  status: "pending" | "read";
  created_at: string;
  read_at: string | null;
}

/** dashboard 里的一条:任务定义 + 当天状态。 */
export interface DashboardItem {
  task: Task;
  date: string; // 这条对应哪一天
  kind: "once" | "recurring";
  overdue: boolean; // 仅一次性任务:due_date < 当天
  due_today: boolean; // 仅一次性:due_date == 当天(死线就是今天,浮在顶部)
  upcoming: boolean; // 临近死线、还没排期的一次性任务(浮在日视图下方)
  days_left: number | null; // 仅 upcoming:距死线还有几天
  done: boolean;
  done_at: string | null;
  day_note: string | null; // 这一天的备注(task_log.note);任务级共享备注在 task.note
}

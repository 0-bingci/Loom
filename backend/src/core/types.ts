// core 对外的数据形状。API/worker 都消费这些类型,不直接碰表结构。

export interface Task {
  id: string;
  title: string;
  due_date: string | null; // 'YYYY-MM-DD'
  recurrence: string | null; // 'daily' / 'weekly:MON,WED'
  start_date: string | null;
  end_date: string | null;
  remind_time: string | null; // 'HH:MM'
  note: string | null; // 备注(自由文本)
  sort_order: number | null; // 手动排序序号,NULL=未排
  /** 六态两族;仅非循环任务有意义。推进线:todo/doing/testing/done;停靠区:waiting/incubating */
  status: TaskStatus;
  archived: boolean;
  created_at: string; // ISO8601
}

export type TaskStatus = "todo" | "doing" | "testing" | "done" | "waiting" | "incubating";

export interface TaskLog {
  id: string;
  task_id: string;
  date: string;
  done: boolean;
  done_at: string | null;
  notified: boolean;
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
  overdue: boolean; // 仅一次性任务:due_date < 今天
  done: boolean;
  done_at: string | null;
}

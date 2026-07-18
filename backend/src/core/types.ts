// core 对外的数据形状。API/worker 都消费这些类型,不直接碰表结构。

export interface Task {
  id: string;
  title: string;
  due_date: string | null; // 'YYYY-MM-DD'
  recurrence: string | null; // 'daily' / 'weekly:MON,WED'
  start_date: string | null;
  end_date: string | null;
  remind_time: string | null; // 'HH:MM'
  archived: boolean;
  created_at: string; // ISO8601
}

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

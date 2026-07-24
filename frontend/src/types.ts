// 与后端 core/types.ts 对齐的数据形状

export interface Task {
  id: string;
  title: string;
  due_date: string | null; // 死线
  plan_date: string | null; // 计划哪天做;NULL=还没排
  recurrence: string | null;
  start_date: string | null;
  end_date: string | null;
  remind_time: string | null;
  note: string | null; // 备注(自由文本)
  sort_order: number | null; // 手动排序序号,NULL=未排
  /** 六态两族;仅非循环任务有意义 */
  status: import("./lib/status").TaskStatus;
  archived: boolean;
  created_at: string;
}

export interface DashboardItem {
  task: Task;
  date: string;
  kind: "once" | "recurring";
  overdue: boolean;
  due_today: boolean; // 死线就是今天
  upcoming: boolean; // 临近死线、还没排期
  days_left: number | null; // 仅 upcoming:距死线还有几天
  done: boolean;
  done_at: string | null;
  day_note: string | null; // 这一天的备注(循环任务按天记);共享备注在 task.note
  /** 仅前端:离线期间的改动,等待补发 */
  pendingSync?: boolean;
}

export interface DashboardResponse {
  date: string;
  items: DashboardItem[];
}

export interface Notification {
  id: string;
  task_id: string;
  date: string;
  status: "pending" | "read";
  created_at: string;
  read_at: string | null;
}

// 任务状态。仅非循环任务有意义(循环任务的完成按天记)。

export type TaskStatus = "todo" | "doing" | "testing" | "done" | "waiting" | "incubating" | "closed";

export interface StatusMeta {
  value: TaskStatus;
  label: string;
  family: "推进线" | "停靠区" | "已关闭";
  /** pill 配色 */
  cls: string;
}

export const STATUSES: StatusMeta[] = [
  { value: "todo", label: "待办", family: "推进线", cls: "bg-[#EFEDE6] text-ink2" },
  { value: "doing", label: "进行中", family: "推进线", cls: "bg-[#E3EDF7] text-[#3B6EA8]" },
  { value: "testing", label: "测试中", family: "推进线", cls: "bg-rec-soft text-rec" },
  { value: "done", label: "完成", family: "推进线", cls: "bg-accent-soft text-accent" },
  { value: "waiting", label: "等待", family: "停靠区", cls: "bg-[#F7F0DC] text-[#96772A]" },
  { value: "incubating", label: "酝酿", family: "停靠区", cls: "bg-[#EDEAE2] text-ink3" },
  { value: "closed", label: "关闭", family: "已关闭", cls: "bg-[#E6E1D8] text-ink3" },
];

export const statusMeta = (s: TaskStatus): StatusMeta => STATUSES.find((x) => x.value === s)!;

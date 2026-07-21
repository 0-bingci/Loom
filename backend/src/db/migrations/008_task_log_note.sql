-- 当天备注:循环任务按天各写各的,记在 task_log 上(一天一行)。
-- 与 tasks.note(任务级共享备注)分工:tasks.note 所有日子都看得到,task_log.note 只属于那一天。
ALTER TABLE task_log ADD COLUMN note TEXT;

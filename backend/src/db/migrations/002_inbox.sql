-- 收集箱:允许任务既无 due_date 也无 recurrence(先捕捉,以后再安排)。
-- 这类任务不出现在任何按日视图里,住在收集箱,直到被赋予日期或循环规则。
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_check;

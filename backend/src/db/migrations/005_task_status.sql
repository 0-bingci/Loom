-- 任务状态:从二元完成扩展为六态两族(仅对非循环任务有意义;循环任务的完成仍按天记在 task_log)。
-- 推进线:todo 待办 → doing 进行中 → testing 测试中 → done 完成
-- 停靠区:waiting 等待 / incubating 酝酿
ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'todo'
  CHECK (status IN ('todo', 'doing', 'testing', 'done', 'waiting', 'incubating'));

-- 回填:已完成的非循环任务 → done
UPDATE tasks SET status = 'done'
FROM task_log l
WHERE l.task_id = tasks.id AND tasks.recurrence IS NULL AND l.done;

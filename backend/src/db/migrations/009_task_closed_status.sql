-- 新增"关闭"状态:任务不做了但留档(区别于 done 做完、区别于删除)。
-- 关闭的任务从"今天"视图消失,但在"所有"页仍可跟踪、可改回。
ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'doing', 'testing', 'done', 'waiting', 'incubating', 'closed'));

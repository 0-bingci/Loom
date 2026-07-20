-- 计划做的日子:与 due_date(死线)分离。
-- 只有死线、没定哪天做的任务,靠 plan_date 主动排期进某一天的"今天"视图;
-- 没排期时按临近死线浮在日视图下方。NULL = 还没排。
ALTER TABLE tasks ADD COLUMN plan_date DATE;

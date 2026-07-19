-- 手动排序:浮点序号,拖拽插入时取邻居中点,基本不用重排。
-- NULL = 未手动排过,排在已排项之后(按创建时间)。
ALTER TABLE tasks ADD COLUMN sort_order DOUBLE PRECISION;

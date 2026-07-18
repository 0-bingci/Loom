-- 碎片记录(设计文档 §2.2/§6:第四张纯 CRUD 表)。
-- 随手记的东西:一段文本 + 时间,没有状态、没有日期语义。自有数据,完整增删改查。
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,             -- ULID(客户端可自带,幂等)
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_notes_created ON notes (created_at DESC);

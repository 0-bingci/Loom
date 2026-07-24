# loom — 个人信息管理系统

长期自用的个人信息管理系统。v1:待办(一次性 + 循环)+ 按日期算出的 dashboard + 每分钟轮询的提醒 worker + 对外 API。设计见 [设计文档](./个人信息管理系统-设计文档.md)。

## 结构

```
backend/    # 核心:API + worker + core + 迁移
frontend/   # Vite + React 皮(开发中;backend/public 是过渡期的静态皮)
```

后端双进程 + 共享 Postgres,横跨"两个世界":

- **API(被动世界)** `backend/src/api` — Hono,统一入口、静态 token 鉴权、CRUD。
- **worker(主动世界)** `backend/src/worker` — 每分钟醒来,到点的任务生成通知。状态全在数据库,重启不丢。
- **core** `backend/src/core` — 数据 + 逻辑,两个进程共享。API/worker 都只是 core 的消费者。
- 两个世界在 `notifications` 表交汇。

## 快速开始

```bash
# 1. Postgres(本机装了 PG 17 服务;或用 docker compose up -d)
#    需要 role loom / 密码 loom / 数据库 loom

# 2. 后端
cd backend
cp .env.example .env   # 按需改 DATABASE_URL / LOOM_API_TOKEN
npm install
npm run migrate
npm run api      # http://localhost:8787(另开终端 npm run worker)

# 3. 前端(开发)
cd frontend
npm install
npm run dev      # http://localhost:5173,API 请求经 vite 代理转给 8787
```

## API

所有请求带 `Authorization: Bearer <LOOM_API_TOKEN>`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/tasks` | 建任务:`{title, due_date?}` 一次性 / `{title, recurrence, start_date?, end_date?}` 循环;`remind_time?`、`list_id?`(归到某清单)均可带。可带客户端生成的 `id`(26 位 ULID)——同 id 重放幂等去重,供离线补发用 |
| GET | `/tasks` | 列任务(`?include_archived=true` 含归档) |
| GET/PATCH/DELETE | `/tasks/:id` | 查/改/删(PATCH 可带 `list_id`,传 `null` = 移出清单) |
| POST | `/tasks/:id/done` | 标完成 `{done?: bool, date?: 'YYYY-MM-DD'}`(循环任务默认今天;一次性记在 due_date 上) |
| POST | `/lists` | 建清单:`{name, color?}`,可带客户端 `id`(幂等) |
| GET | `/lists` | 列清单(`?include_archived=true` 含归档),每条带 `task_count`(未归档任务数) |
| PATCH/DELETE | `/lists/:id` | 改(`name`/`color`/`sort_order`/`archived`)/删。删清单不删任务,其下任务 `list_id` 置空(回到未分类) |
| GET | `/dashboard` | 当天视图(`?date=` 看任意一天);算出来的,不预生成 |
| GET | `/notifications` | 拉通知(`?status=pending`) |
| POST | `/notifications/:id/read` | 标读 |

循环规则 v1:`daily` 或 `weekly:MON,WED`(星期用 MON..SUN)。

所有"今天"与 `remind_time` 按 **UTC+8** 计算,与机器时区无关。

## 开发

```bash
npm run typecheck
npm test
npm run api:dev / worker:dev   # watch 模式
```

迁移:往 `src/db/migrations/` 加按序号命名的 `.sql`,`npm run migrate` 只跑没跑过的。

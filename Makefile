# loom 开发编排。make dev 一键起全部;各目标只是薄薄地转发给 npm。
.PHONY: dev api worker web migrate test typecheck db

dev:            ## API + worker + 前端 一起起(热重载)
	npm run dev

api:            ## 只起 API
	cd backend && npm run api:dev

worker:         ## 只起 worker
	cd backend && npm run worker:dev

web:            ## 只起前端
	cd frontend && npm run dev

migrate:        ## 跑数据库迁移
	cd backend && npm run migrate

test:           ## 后端测试
	cd backend && npm test

typecheck:      ## 后端类型检查
	cd backend && npm run typecheck

db:             ## 用 Docker 起 Postgres(本机已装原生 PG 服务的话不需要)
	docker compose up -d

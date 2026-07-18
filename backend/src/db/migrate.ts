import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { closePool, getPool } from "../core/db.js";

// 极简迁移 runner:按文件名顺序跑 migrations/*.sql,已跑过的记在 _migrations 表里,跑过不再跑。
// 不上重型 ORM migration 工具——单人项目这几十行足够。

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export async function runMigrations(pool: pg.Pool): Promise<string[]> {
  await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const { rows } = await pool.query<{ name: string }>("SELECT name FROM _migrations");
  const applied = new Set(rows.map((r) => r.name));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const justRan: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    // 每个迁移文件在一个事务里跑:要么整份成功,要么整份回滚。
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      justRan.push(file);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  return justRan;
}

// 作为脚本直接运行:npm run migrate
const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("db/migrate.ts");
if (isMain) {
  const ran = await runMigrations(getPool());
  if (ran.length === 0) console.log("没有待跑的迁移,schema 已是最新。");
  else console.log(`已应用迁移:${ran.join(", ")}`);
  await closePool();
}

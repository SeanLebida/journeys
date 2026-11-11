import { DurableObject } from "cloudflare:workers";
import type { DownloadIncrementResult, DownloadMonthRow } from "./types.ts";

export class DownloadStats extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS download_counts (
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          version_id INTEGER NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (year, month, version_id)
        )
      `);
    });
  }

  async increment(
    versionId: number,
    year: number,
    month: number,
  ): Promise<DownloadIncrementResult> {
    this.ctx.storage.sql.exec(
      `INSERT INTO download_counts (year, month, version_id, count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(year, month, version_id)
       DO UPDATE SET count = count + 1`,
      year,
      month,
      versionId,
    );
    const monthRow = this.ctx.storage.sql
      .exec<{ count: number }>(
        `SELECT count FROM download_counts
         WHERE year = ? AND month = ? AND version_id = ?`,
        year,
        month,
        versionId,
      )
      .one();
    const yearRow = this.ctx.storage.sql
      .exec<{ total: number }>(
        `SELECT COALESCE(SUM(count), 0) AS total
         FROM download_counts
         WHERE year = ? AND version_id = ?`,
        year,
        versionId,
      )
      .one();
    return { monthCount: monthRow.count, yearTotal: yearRow.total };
  }

  async statsForYear(year: number): Promise<DownloadMonthRow[]> {
    return this.ctx.storage.sql
      .exec<{ version_id: number; month: number; count: number }>(
        `SELECT version_id, month, count
         FROM download_counts
         WHERE year = ?
         ORDER BY version_id, month`,
        year,
      )
      .toArray();
  }
}

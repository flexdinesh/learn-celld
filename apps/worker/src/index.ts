interface Env {
  CELLS: DurableObjectNamespace;
}
type Row = {
  value: number;
  revision: number;
  alarm_fires: number;
  last_alarm_at: number | null;
};
type EventRow = { revision: number; kind: string; at: number; value: number };

export class LabCell implements DurableObject {
  private readonly bootId = crypto.randomUUID();
  private readonly bootedAt = Date.now();
  constructor(private readonly ctx: DurableObjectState) {
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY CHECK(id = 1), value INTEGER NOT NULL, revision INTEGER NOT NULL, alarm_fires INTEGER NOT NULL, last_alarm_at INTEGER)",
    );
    ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO counter VALUES (1, 0, 0, 0, NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS events (revision INTEGER PRIMARY KEY, kind TEXT NOT NULL, at INTEGER NOT NULL, value INTEGER NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS alarm_job (id INTEGER PRIMARY KEY CHECK(id = 1), scheduled INTEGER NOT NULL)",
    );
  }
  private row(): Row {
    const row = this.ctx.storage.sql
      .exec<Row>("SELECT * FROM counter WHERE id = 1")
      .toArray()[0];
    if (!row) throw new Error("Missing counter row");
    return row;
  }
  private mutate(kind: "increment" | "alarm"): void {
    this.ctx.storage.transactionSync(() => {
      const old = this.row();
      const value = old.value + (kind === "increment" ? 1 : 10);
      const revision = old.revision + 1;
      const at = Date.now();
      this.ctx.storage.sql.exec(
        "UPDATE counter SET value = ?, revision = ?, alarm_fires = ?, last_alarm_at = ? WHERE id = 1",
        value,
        revision,
        old.alarm_fires + (kind === "alarm" ? 1 : 0),
        kind === "alarm" ? at : old.last_alarm_at,
      );
      this.ctx.storage.sql.exec(
        "INSERT INTO events VALUES (?, ?, ?, ?)",
        revision,
        kind,
        at,
        value,
      );
      this.ctx.storage.sql.exec(
        "DELETE FROM events WHERE revision <= ?",
        revision - 20,
      );
    });
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/increment")
      this.mutate("increment");
    else if (request.method === "POST" && url.pathname === "/alarm") {
      const delay = Number(url.searchParams.get("delayMs") ?? 5000);
      if (!Number.isInteger(delay) || delay < 1000 || delay > 30000)
        return Response.json({ error: "Invalid delay" }, { status: 400 });
      const scheduled = Date.now() + delay;
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO alarm_job VALUES (1, ?)",
        scheduled,
      );
      await this.ctx.storage.setAlarm(scheduled);
    } else if (request.method !== "GET" || url.pathname !== "/read")
      return new Response("Not found", { status: 404 });
    const row = this.row();
    return Response.json({
      cell: url.searchParams.get("cell") ?? "unknown",
      id: this.ctx.id.toString(),
      value: row.value,
      revision: row.revision,
      bootId: this.bootId,
      bootedAt: this.bootedAt,
      alarmAt: await this.ctx.storage.getAlarm(),
      alarmFires: row.alarm_fires,
      lastAlarmAt: row.last_alarm_at,
      events: this.ctx.storage.sql
        .exec<EventRow>("SELECT * FROM events ORDER BY revision DESC LIMIT 20")
        .toArray(),
    });
  }
  async alarm(): Promise<void> {
    // Deleting the pending job and changing the counter in one transaction makes retries harmless.
    this.ctx.storage.transactionSync(() => {
      const job = this.ctx.storage.sql
        .exec<{ scheduled: number }>(
          "SELECT scheduled FROM alarm_job WHERE id = 1",
        )
        .toArray()[0];
      if (!job || job.scheduled > Date.now()) return;
      this.mutate("alarm");
      this.ctx.storage.sql.exec("DELETE FROM alarm_job WHERE id = 1");
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cell = url.searchParams.get("cell") ?? "counter";
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cell))
      return Response.json({ error: "Invalid cell name" }, { status: 400 });
    return env.CELLS.get(env.CELLS.idFromName(cell)).fetch(request);
  },
};

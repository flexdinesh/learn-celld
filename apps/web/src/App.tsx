import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Database,
  ExternalLink,
  FlaskConical,
  Layers,
  Play,
  Radio,
  RotateCcw,
  Send,
  Server,
  Terminal,
  Timer,
  Zap,
} from "lucide-react";
import {
  batchSchema,
  nodeId,
  snapshotSchema,
  type CellResult,
  type LabRequest,
  type NodeId,
  type Snapshot,
  type Trace,
} from "@lab/contracts";

interface Experiment {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Zap;
  cell: string;
  operation: LabRequest["operation"];
  count: number;
  premise: string;
  steps: string[];
  watch: string;
}
const experiments: Experiment[] = [
  {
    id: "routing",
    title: "One cell, any node",
    subtitle: "Ownership & routing",
    icon: Radio,
    cell: "counter",
    operation: "increment",
    count: 1,
    premise:
      "A cell has one owner. The node receiving your request can forward it to that owner.",
    steps: [
      "Send an increment through node A.",
      "Change ingress to node B; send again.",
      "Compare ingress with the ownership record below.",
    ],
    watch:
      "The counter continues from the same value. Ingress can change while the owner stays the same.",
  },
  {
    id: "concurrency",
    title: "A hundred writers",
    subtitle: "Concurrency & consistency",
    icon: Zap,
    cell: "shared-counter",
    operation: "increment",
    count: 100,
    premise:
      "One named cell owns one SQLite database. Synchronous transactions serialize each counter update.",
    steps: [
      "Run the experiment to read a baseline.",
      "Submit 100 concurrent increments to the same cell.",
      "Read the final value and compare it with the baseline.",
    ],
    watch:
      "With 100 acknowledged writes, the value increases by exactly 100. Each response has a distinct revision.",
  },
  {
    id: "isolation",
    title: "Divide the work",
    subtitle: "Independent cells",
    icon: Layers,
    cell: "room-alpha",
    operation: "increment",
    count: 1,
    premise:
      "Different names produce different cells with private databases. There is no shared counter between rooms.",
    steps: [
      "Run the experiment to write to three rooms through three nodes.",
      "Inspect each room using the cell selector.",
      "Send another increment to one room; the others do not change.",
    ],
    watch:
      "Each room has its own value, cell ID and owner. Distribution is observed, not guaranteed to stay fixed.",
  },
  {
    id: "failover",
    title: "Pull a node",
    subtitle: "Durability & recovery",
    icon: Server,
    cell: "failover-counter",
    operation: "increment",
    count: 1,
    premise:
      "An acknowledged write is durable. When an owner dies, a surviving node can recover the cell after its lease expires.",
    steps: [
      "Increment the cell and note its owner and value.",
      "Crash that owner with its node control above.",
      "Select a healthy ingress, wait about 10 seconds, then read. Start the stopped node afterward.",
    ],
    watch:
      "The acknowledged value survives. Ownership and the runtime boot ID may change; recovery requests can take time.",
  },
  {
    id: "idle",
    title: "Memory is temporary",
    subtitle: "Idle eviction & restore",
    icon: RotateCcw,
    cell: "sleepy-counter",
    operation: "increment",
    count: 1,
    premise:
      "SQLite state is durable; JavaScript memory is not. This fleet evicts resident cells after 20 seconds of inactivity.",
    steps: [
      "Increment once and note the runtime boot ID.",
      "Leave the cell untouched for at least 25 seconds.",
      "Read again. Telemetry polling does not invoke the cell.",
    ],
    watch:
      "The value persists while the boot ID changes. Idle eviction can retain ownership; balancing may later move idle cells.",
  },
  {
    id: "alarm",
    title: "Wake up later",
    subtitle: "Durable alarms",
    icon: Timer,
    cell: "alarm-counter",
    operation: "alarm",
    count: 1,
    premise:
      "A durable alarm can wake a cell without a browser request. This handler adds 10 and records when it ran.",
    steps: [
      "Schedule an alarm for 5 seconds from now.",
      "Wait at least 6 seconds without calling the cell.",
      "Read the result; compare alarm fires and the event history.",
    ],
    watch:
      "The alarm adds 10 once per pending job. Rescheduling replaces the pending job; polling fleet state does not fire it.",
  },
];
function firstExperiment(): Experiment {
  const first = experiments[0];
  if (!first) throw new Error("No experiments configured");
  return first;
}
const defaultExperiment = firstExperiment();

async function post(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data === "object" && data !== null && "error" in data
        ? String(data.error)
        : `Request failed (${response.status})`,
    );
  return data;
}
function numberAt(
  record: Record<string, unknown> | null,
  key: string,
): number | null {
  const direct = record?.[key];
  if (typeof direct === "number") return direct;
  const load = record?.node_load;
  if (typeof load === "object" && load !== null && key in load) {
    const value: unknown = Reflect.get(load, key);
    if (typeof value === "number") return value;
  }
  return null;
}
function latestResult(traces: Trace[], cell: string): CellResult | undefined {
  return traces
    .filter((t) => t.cell === cell && t.result)
    .sort(
      (a, b) =>
        b.at - a.at || (b.result?.revision ?? 0) - (a.result?.revision ?? 0),
    )[0]?.result;
}
const time = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour12: false });
const bytes = (value: number) =>
  value >= 1048576
    ? `${(value / 1048576).toFixed(1)} MB`
    : value >= 1024
      ? `${(value / 1024).toFixed(1)} KB`
      : `${value} B`;

export function App() {
  const [experiment, setExperiment] = useState(defaultExperiment);
  const [cell, setCell] = useState(defaultExperiment.cell);
  const [ingress, setIngress] = useState<NodeId>("node-a");
  const [operation, setOperation] =
    useState<LabRequest["operation"]>("increment");
  const [count, setCount] = useState(1);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("Connecting to the Node API…");
  const [busy, setBusy] = useState(false);
  const [nodeBusy, setNodeBusy] = useState<NodeId>();
  const [report, setReport] = useState("");
  const [activeIngress, setActiveIngress] = useState<NodeId>();
  const [tab, setTab] = useState<"requests" | "storage">("requests");
  const [selectedTrace, setSelectedTrace] = useState<Trace>();
  useEffect(() => {
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const response = await fetch("/api/snapshot", {
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const next = snapshotSchema.parse(await response.json());
        if (!closed) {
          setSnapshot(next);
          setConnection("");
        }
      } catch (error) {
        if (!closed)
          setConnection(
            `API unavailable: ${error instanceof Error ? error.message : String(error)}. Run pnpm lab:up.`,
          );
      } finally {
        if (!closed)
          timer = setTimeout(() => {
            void poll();
          }, 2000);
      }
    }
    void poll();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (!activeIngress) return;
    const t = setTimeout(() => setActiveIngress(undefined), 1400);
    return () => clearTimeout(t);
  }, [activeIngress]);

  async function send(input: LabRequest): Promise<Trace[]> {
    setActiveIngress(input.ingress);
    const results = batchSchema.parse(
      await post("/api/requests", input),
    ).traces;
    const next = snapshotSchema.parse(
      await (await fetch("/api/snapshot")).json(),
    );
    setSnapshot(next);
    const failed = results.filter((t) => t.error);
    if (failed.length)
      throw new Error(
        `${failed.length}/${results.length} requests failed. ${failed[0]?.error ?? ""} Inspect the trace; writes are not automatically retried.`,
      );
    return results;
  }
  async function submit(runExperiment = false) {
    setBusy(true);
    setError("");
    setReport("");
    try {
      const chosenOperation = runExperiment ? experiment.operation : operation;
      const input: LabRequest = {
        cell,
        ingress,
        operation: chosenOperation,
        count: chosenOperation === "increment" ? count : 1,
        delayMs: 5000,
      };
      if (runExperiment && experiment.id === "concurrency") {
        const before = (
          await send({ ...input, operation: "read", count: 1 })
        )[0]?.result;
        const written = await send({
          ...input,
          operation: "increment",
          count: 100,
        });
        const after = (await send({ ...input, operation: "read", count: 1 }))[0]
          ?.result;
        if (!before || !after)
          throw new Error("Missing baseline or final read");
        const delta = after.value - before.value;
        const revisions = new Set(written.map((t) => t.result?.revision));
        setReport(
          `${delta === 100 && revisions.size === 100 ? "Verified" : "Unexpected result"}: ${before.value} → ${after.value}. ${written.length} acknowledged writes, ${revisions.size} distinct revisions, delta ${delta}.`,
        );
      } else if (runExperiment && experiment.id === "isolation") {
        const rooms = ["room-alpha", "room-beta", "room-gamma"];
        await Promise.all(
          rooms.map((room, i) =>
            send({
              ...input,
              cell: room,
              ingress: nodeId.options[i] ?? "node-a",
              operation: "increment",
              count: 1,
            }),
          ),
        );
        setReport(
          "Three independent rooms received one increment each. Select a room below to compare its value and owner.",
        );
      } else {
        const traces = await send(input);
        setReport(
          `${traces.length} request${traces.length === 1 ? "" : "s"} acknowledged. ${chosenOperation === "alarm" ? "Alarm scheduled. Wait 6 seconds, then read the cell." : "Inspect the cell and request evidence below."}`,
        );
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  async function changeNode(id: NodeId, action: "start" | "stop" | "kill") {
    setNodeBusy(id);
    setError("");
    try {
      await post(`/api/nodes/${id}/${action}`);
      setSnapshot(
        snapshotSchema.parse(await (await fetch("/api/snapshot")).json()),
      );
      setReport(
        `${id} ${action === "start" ? "started; readiness may take a few seconds" : action === "kill" ? "crashed with SIGKILL; its lease must expire before takeover" : "stopped after graceful handoff"}.`,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setNodeBusy(undefined);
    }
  }
  function choose(next: Experiment) {
    setExperiment(next);
    setCell(next.cell);
    setOperation(next.operation);
    setCount(next.count);
    setError("");
    setReport("");
    setSelectedTrace(undefined);
  }
  const traces = snapshot?.traces ?? [];
  const result = latestResult(traces, cell);
  const owner = snapshot?.owners.find(
    (o) => o.cellId === `LabCell:${result?.id}`,
  );
  const healthy = snapshot?.nodes.filter((n) => n.ready).length ?? 0;
  const knownCells = Array.from(new Set([cell, ...traces.map((t) => t.cell)]));
  const selectedNode = snapshot?.nodes.find((n) => n.id === ingress);
  return (
    <div className="shell">
      <header className="app-header">
        <a href="/" className="brand" aria-label="celld systems lab home">
          <span className="brand-mark">
            <FlaskConical size={20} />
          </span>
          <strong>
            celld<span className="brand-divider">/</span>
            <span className="brand-sub">systems lab</span>
          </strong>
        </a>
        <div className="header-links">
          <span className={`fleet-status ${healthy === 3 ? "good" : ""}`}>
            <span className="status-dot" />
            {healthy}/3 nodes ready
          </span>
          <a href="https://celld.dev/docs/" target="_blank" rel="noreferrer">
            Documentation <ExternalLink size={13} />
          </a>
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <h2>Experiments</h2>
            <span>6</span>
          </div>
          <nav aria-label="Experiments">
            {experiments.map((item, index) => (
              <button
                key={item.id}
                className={`experiment-link ${item.id === experiment.id ? "selected" : ""}`}
                onClick={() => choose(item)}
                aria-current={item.id === experiment.id ? "page" : undefined}
              >
                <span className="experiment-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <CircleHelp size={17} />
            <p>
              Real nodes. Real state.
              <br />
              Every request runs against your local Docker fleet.
            </p>
          </div>
          <a
            className="minio-link"
            href="http://localhost:9001"
            target="_blank"
            rel="noreferrer"
          >
            <Database size={16} /> Open MinIO console <ExternalLink size={12} />
          </a>
        </aside>
        <main>
          <div className="page-heading">
            <div>
              <h1>Watch the system work.</h1>
              <p>Send a request. Follow ownership. Change the fleet.</p>
            </div>
            <span className="environment">
              <span className="status-dot" />
              Local Docker fleet
            </span>
          </div>
          {connection && (
            <div className="connection-banner" role="status">
              {connection}
              {snapshot ? " Last successful sample is retained." : ""}
            </div>
          )}
          <section className="topology" aria-labelledby="topology-title">
            <div className="section-heading">
              <h2 id="topology-title">Live topology</h2>
              <div className="legend">
                <span>
                  <i className="legend-owner" />
                  Selected cell owner
                </span>
                <span>
                  <i className="legend-ingress" />
                  Request ingress
                </span>
                <span className="sample-time">
                  {snapshot
                    ? `Sampled ${time(snapshot.at)}`
                    : "Awaiting sample"}
                </span>
              </div>
            </div>
            <div className="client-route">
              <span>
                <Terminal size={15} />
                React browser
              </span>
              <ArrowRight size={16} />
              <span>
                Node API<span className="muted"> :3001</span>
              </span>
              <span className="route-explanation">
                You choose ingress. celld resolves ownership.
              </span>
            </div>
            <div className="node-grid">
              {nodeId.options.map((id) => {
                const node = snapshot?.nodes.find((n) => n.id === id);
                const isOwner = owner?.node === id;
                return (
                  <article
                    key={id}
                    className={`node ${isOwner ? "owns-cell" : ""} ${activeIngress === id ? "request-active" : ""} ${node && !node.reachable ? "node-offline" : ""}`}
                  >
                    <div className="node-heading">
                      <span className="node-title">
                        <Server size={18} />
                        <h3>{id}</h3>
                      </span>
                      <span
                        className={`node-health ${node?.ready ? "good" : ""}`}
                      >
                        <span className="status-dot" />
                        {node?.ready
                          ? "Ready"
                          : node?.reachable
                            ? "Joining"
                            : "Offline"}
                      </span>
                    </div>
                    <dl className="node-stats">
                      <div>
                        <dt>Owned</dt>
                        <dd>
                          {numberAt(node?.state ?? null, "owned_cells") ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Resident</dt>
                        <dd>
                          {numberAt(node?.state ?? null, "occupied") ??
                            numberAt(node?.state ?? null, "resident_cells") ??
                            "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Memory</dt>
                        <dd>
                          {numberAt(node?.state ?? null, "rss_bytes") !== null
                            ? bytes(
                                numberAt(node?.state ?? null, "rss_bytes") ?? 0,
                              )
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <div className="cell-slot">
                      {isOwner ? (
                        <>
                          <span className="cell-marker" />
                          <strong>{cell}</strong>
                          <span>epoch {owner.epoch}</span>
                        </>
                      ) : (
                        <span className="muted">
                          {node?.reachable
                            ? "No selected cell on this node"
                            : "Node is unreachable"}
                        </span>
                      )}
                    </div>
                    <div className="node-controls">
                      {node?.reachable ? (
                        <>
                          <button
                            onClick={() => void changeNode(id, "stop")}
                            disabled={Boolean(nodeBusy)}
                            title="SIGTERM; allow graceful handoff"
                          >
                            {nodeBusy === id ? "Working…" : "Stop gracefully"}
                          </button>
                          <button
                            className="danger-control"
                            onClick={() => void changeNode(id, "kill")}
                            disabled={Boolean(nodeBusy)}
                            title="SIGKILL this lab node"
                          >
                            Crash
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => void changeNode(id, "start")}
                          disabled={Boolean(nodeBusy)}
                        >
                          {nodeBusy === id ? "Starting…" : "Start node"}
                        </button>
                      )}
                      <details>
                        <summary aria-label={`Inspect ${id} operator state`}>
                          State
                        </summary>
                        <pre>
                          {JSON.stringify(
                            node?.state ?? {
                              error: node?.error ?? "Awaiting state",
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="bucket-bus">
              <div className="bus-lines">
                <span />
                <span />
                <span />
              </div>
              <div className="bucket-strip">
                <Database size={23} />
                <div>
                  <strong>MinIO</strong>
                  <span>
                    Shared bucket <code>celld-lab</code>
                  </span>
                </div>
                <span className="bucket-purpose">
                  Ownership records · node leases · durable logs & snapshots
                </span>
                <span
                  className={`node-health ${snapshot?.bucket.reachable ? "good" : ""}`}
                >
                  <span className="status-dot" />
                  {snapshot?.bucket.reachable
                    ? `${snapshot.objects.length}${snapshot.bucket.truncated ? "+" : ""} objects`
                    : "Unavailable"}
                </span>
              </div>
            </div>
            <p className="topology-caption">
              Lines show configured connectivity. Ownership comes from{" "}
              <code>own.json</code>; replication packets are not instrumented.
              Fleet durability can acknowledge after peer disk persistence, or
              bucket persistence.
            </p>
          </section>
          <div className="workbench">
            <section
              className="experiment-panel"
              aria-labelledby="experiment-title"
            >
              <div className="experiment-title">
                <experiment.icon size={21} />
                <h2 id="experiment-title">{experiment.title}</h2>
              </div>
              <p className="premise">{experiment.premise}</p>
              <ol className="steps">
                {experiment.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="watch-for">
                <BookOpen size={16} />
                <div>
                  <strong>What to look for</strong>
                  <p>{experiment.watch}</p>
                </div>
              </div>
              <button
                className="run-experiment"
                onClick={() => void submit(true)}
                disabled={busy || !selectedNode?.ready}
              >
                <Play size={14} />
                {busy
                  ? "Running…"
                  : experiment.id === "concurrency" ||
                      experiment.id === "isolation"
                    ? "Run experiment"
                    : experiment.id === "alarm"
                      ? "Schedule alarm"
                      : "Send first request"}
              </button>
            </section>
            <section className="console-panel" aria-labelledby="console-title">
              <div className="section-heading">
                <h2 id="console-title">Request console</h2>
                <span className="muted">Browser → Node API → celld</span>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <div className="form-row">
                  <label>
                    Cell name
                    <input
                      value={cell}
                      onChange={(event) => setCell(event.target.value)}
                      pattern="[a-zA-Z0-9_-]{1,64}"
                      maxLength={64}
                      required
                      list="known-cells"
                      disabled={busy}
                    />
                    <datalist id="known-cells">
                      {knownCells.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Ingress node
                    <select
                      value={ingress}
                      onChange={(event) =>
                        setIngress(nodeId.parse(event.target.value))
                      }
                      disabled={busy}
                    >
                      {nodeId.options.map((id) => (
                        <option key={id} value={id}>
                          {id}
                          {snapshot?.nodes.find((n) => n.id === id)?.ready
                            ? ""
                            : " · unavailable"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Operation
                    <select
                      value={operation}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (
                          value === "read" ||
                          value === "increment" ||
                          value === "alarm"
                        )
                          setOperation(value);
                      }}
                      disabled={busy}
                    >
                      <option value="increment">Increment +1</option>
                      <option value="read">Read state</option>
                      <option value="alarm">Set alarm · +10 after 5s</option>
                    </select>
                  </label>
                  <label>
                    Concurrent requests
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={operation === "increment" ? count : 1}
                      onChange={(event) => setCount(Number(event.target.value))}
                      disabled={busy || operation !== "increment"}
                    />
                  </label>
                </div>
                <div className="send-row">
                  <code>
                    {operation === "read" ? "GET" : "POST"} /{operation}?cell=
                    {cell || "…"}
                  </code>
                  <button
                    className="primary"
                    disabled={busy || !selectedNode?.ready}
                  >
                    <Send size={14} />
                    {busy ? "Sending…" : "Send request"}
                  </button>
                </div>
              </form>
              <div className="cell-inspector">
                <div className="inspector-header">
                  <h3>Selected cell</h3>
                  <button
                    className="text-button"
                    disabled={busy || !selectedNode?.ready}
                    onClick={() => {
                      setBusy(true);
                      setError("");
                      void send({
                        cell,
                        ingress,
                        operation: "read",
                        count: 1,
                        delayMs: 5000,
                      })
                        .catch((error) =>
                          setError(
                            error instanceof Error
                              ? error.message
                              : String(error),
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    <RotateCcw size={12} />
                    Read now
                  </button>
                </div>
                {result ? (
                  <>
                    <dl className="cell-state">
                      <div>
                        <dt>Value</dt>
                        <dd className="counter-value">{result.value}</dd>
                      </div>
                      <div>
                        <dt>Revision</dt>
                        <dd>{result.revision}</dd>
                      </div>
                      <div>
                        <dt>Owner</dt>
                        <dd className="owner-text">
                          {owner?.node || "Unowned"}
                        </dd>
                      </div>
                      <div>
                        <dt>Alarm fires</dt>
                        <dd>{result.alarmFires}</dd>
                      </div>
                    </dl>
                    <div className="runtime-info">
                      <span>
                        Runtime boot{" "}
                        <code title={result.bootId}>
                          {result.bootId.slice(0, 8)}
                        </code>
                      </span>
                      <span>Started {time(result.bootedAt)}</span>
                      {result.alarmAt && (
                        <span className="alarm-label">
                          <Timer size={12} />
                          Alarm {time(result.alarmAt)}
                        </span>
                      )}
                    </div>
                    <details className="cell-details">
                      <summary>Cell ID & SQLite event history</summary>
                      <code className="long-id">{result.id}</code>
                      <pre>{JSON.stringify(result.events, null, 2)}</pre>
                    </details>
                  </>
                ) : (
                  <div className="empty-cell">
                    <Database size={23} />
                    <p>
                      This cell has not been read yet.
                      <br />
                      <span>Send a request to activate and inspect it.</span>
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
          <div aria-live="polite">
            {error && (
              <div className="feedback error" role="alert">
                {error}
              </div>
            )}
            {report && (
              <div className="feedback success">
                <Check size={16} />
                {report}
              </div>
            )}
          </div>
          <section className="evidence" aria-label="System evidence">
            <div className="evidence-heading">
              <div className="tabs" role="tablist" aria-label="Evidence type">
                <button
                  id="requests-tab"
                  role="tab"
                  aria-controls="requests-panel"
                  aria-selected={tab === "requests"}
                  onClick={() => setTab("requests")}
                >
                  Request timeline <span>{traces.length}</span>
                </button>
                <button
                  id="storage-tab"
                  role="tab"
                  aria-controls="storage-panel"
                  aria-selected={tab === "storage"}
                  onClick={() => setTab("storage")}
                >
                  Bucket explorer <span>{snapshot?.objects.length ?? 0}</span>
                </button>
              </div>
              <span className="evidence-note">
                {tab === "requests"
                  ? "Last 200 submissions · no automatic write retries"
                  : "Live object metadata · sampled every 2s"}
              </span>
            </div>
            {tab === "requests" ? (
              <div
                id="requests-panel"
                role="tabpanel"
                aria-labelledby="requests-tab"
              >
                {traces.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Cell / operation</th>
                          <th>Ingress</th>
                          <th>Observed owner</th>
                          <th>Value</th>
                          <th>Duration</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traces.slice(0, 40).map((trace) => (
                          <tr
                            key={trace.id}
                            className={
                              selectedTrace?.id === trace.id
                                ? "selected-row"
                                : ""
                            }
                          >
                            <td>{time(trace.at)}</td>
                            <td>
                              <button
                                className="trace-link"
                                onClick={() =>
                                  setSelectedTrace(
                                    selectedTrace?.id === trace.id
                                      ? undefined
                                      : trace,
                                  )
                                }
                              >
                                {trace.cell}
                                <span>{trace.operation}</span>
                              </button>
                            </td>
                            <td>{trace.ingress}</td>
                            <td>{trace.ownerAfter || "—"}</td>
                            <td>{trace.result?.value ?? "—"}</td>
                            <td>{trace.durationMs} ms</td>
                            <td>
                              <span
                                className={
                                  trace.error ? "trace-failed" : "trace-ok"
                                }
                              >
                                {trace.error ? "Failed" : "Acknowledged"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {selectedTrace && (
                      <div className="trace-detail">
                        <div>
                          <h3>Request {selectedTrace.id.slice(0, 8)}</h3>
                          <button
                            className="text-button"
                            onClick={() => setSelectedTrace(undefined)}
                          >
                            Close
                          </button>
                        </div>
                        <pre>{JSON.stringify(selectedTrace, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-evidence">
                    <ArrowDown size={20} />
                    <p>Your first request starts the timeline.</p>
                    <span>
                      Compare ingress, observed owner, result and latency here.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div
                id="storage-panel"
                role="tabpanel"
                aria-labelledby="storage-tab"
              >
                {snapshot?.bucket.error && (
                  <p className="storage-error">{snapshot.bucket.error}</p>
                )}
                <div className="storage-explanation">
                  <span>
                    <code>cells/</code> ownership & snapshots
                  </span>
                  <span>
                    <code>nodes/</code> discovery & leases
                  </span>
                  <span>
                    <code>deploy/</code> Worker code
                  </span>
                  <span>Other prefixes contain fleet coordination & logs.</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Object key</th>
                        <th>Size</th>
                        <th>Modified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot?.objects.map((object) => (
                        <tr key={object.key}>
                          <td className="object-key">{object.key}</td>
                          <td>{bytes(object.size)}</td>
                          <td>
                            {object.modified
                              ? time(Date.parse(object.modified))
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
          <footer>
            <span>
              <FlaskConical size={13} />
              celld v0.6.1 · 3 nodes · SQLite per cell · MinIO
            </span>
            <span>State survives ordinary Docker restarts.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

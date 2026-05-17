// ============================================================
// InfraNodus MCP — Tool result UI components (one per tool)
//
// Each card visualizes what the host renders when a given tool
// returns. Cards are sized 560×400 for the design canvas.
// Tool list mirrors github.com/Zpankz/mcp-server-infranodus.
// ============================================================

const { useMemo: tcUseMemo, useState: tcUseState, useEffect: tcUseEffect, useRef: tcUseRef, useCallback: tcUseCallback, createContext: tcCreateContext, useContext: tcUseContext } = React;

// ─── Tweaks context ────────────────────────────────────────
// Global controls surfaced via the Tweaks panel; consumed by every
// card. The shape stays stable so adding a card can't break existing
// ones — unknown keys read as undefined and the components default.
const ToolsTweaksContext = tcCreateContext({
  density: "balanced",        // "sparse" | "balanced" | "dense"
  labels:  "hubs",            // "none" | "hubs" | "all"
  speed:   1,                 // simulated-run speed multiplier (0.5x – 2x)
  hover:   true,              // graph node hover-to-focus
  showSpecular: true,         // 3D-sprite specular highlight
});
function useToolsTweaks() { return tcUseContext(ToolsTweaksContext); }

// ─── useToolRun ────────────────────────────────────────────
// Simulates a tool execution lifecycle: idle/ok → run → ok with a
// ticking timer in the header. `run()` is idempotent — calling it
// while running aborts and restarts. Speed scales by the global
// tweak so the whole canvas can be sped up or slowed down for demos.
function useToolRun({ duration = 1200, initialStatus = "ok" } = {}) {
  const tw = useToolsTweaks();
  const speed = (tw && tw.speed) || 1;
  const scaled = duration / speed;
  const [status, setStatus] = tcUseState(initialStatus);
  const [t, setT] = tcUseState(`${(scaled / 1000).toFixed(2)}s`);
  const [runs, setRuns] = tcUseState(0);
  const timer = tcUseRef(null);
  const ticker = tcUseRef(null);
  const clear = () => {
    if (timer.current)  { clearTimeout(timer.current);  timer.current  = null; }
    if (ticker.current) { clearInterval(ticker.current); ticker.current = null; }
  };
  const run = tcUseCallback(() => {
    clear();
    setStatus("run"); setT("…");
    const start = Date.now();
    ticker.current = setInterval(() => {
      setT(`${((Date.now() - start) / 1000).toFixed(2)}s`);
    }, 100);
    timer.current = setTimeout(() => {
      clear();
      setStatus("ok");
      setT(`${(scaled / 1000).toFixed(2)}s`);
      setRuns((r) => r + 1);
    }, scaled);
  }, [scaled]);
  tcUseEffect(() => clear, []);
  return { status, t, runs, run };
}

// ─── Card shell ────────────────────────────────────────────
function ToolCard({ name, group, status = "ok", t = "", children, accent = "var(--in-accent)", onRun }) {
  const statusColor =
    status === "ok" ? "var(--ok)" : status === "run" ? "var(--warn)" : status === "err" ? "var(--err)" : "var(--host-fg-3)";
  const handleRun = (e) => { e.stopPropagation(); if (onRun && status !== "run") onRun(); };
  return (
    <div className="in-app dir-topology" style={{
      gridTemplate: "auto 1fr / 1fr",
      background: "var(--host-bg)",
      borderRadius: 0,
    }}>
      <header style={{
        display: "grid", gridTemplate: "auto auto / 1fr auto",
        gap: 4, padding: "14px 16px", borderBottom: "var(--line-2)",
        background: "var(--host-bg-2)",
      }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 2, background: accent,
            boxShadow: `0 0 8px ${accent}`,
            animation: status === "run" ? "tc-pulse 1.2s ease-in-out infinite" : "none",
          }}></span>
          <span className="mono" style={{ fontSize: 13, color: "var(--host-fg)", letterSpacing: "-0.005em" }}>{name}</span>
          <span style={{ flex: 1 }}></span>
          {onRun && (
            <button
              onClick={handleRun}
              disabled={status === "run"}
              className="mono"
              title={status === "run" ? "running" : "re-run"}
              style={{
                fontSize: 10, padding: "2px 7px",
                background: status === "run" ? "var(--host-bg-3)" : "var(--host-bg-3)",
                color: status === "run" ? "var(--host-fg-3)" : "var(--host-fg)",
                border: "var(--line-2)", borderRadius: 3,
                cursor: status === "run" ? "default" : "pointer",
                letterSpacing: "0.04em",
              }}
            >
              {status === "run" ? "…" : "⟳ run"}
            </button>
          )}
          <span className="pill mono" style={{ fontSize: 10 }}>
            <span className="dot" style={{
              background: statusColor,
              animation: status === "run" ? "tc-pulse 0.9s ease-in-out infinite" : "none",
            }}></span>
            {status === "run" ? "running" : status === "ok" ? "ok" : status}
          </span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="mono dim2" style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>{group}</span>
          <span style={{ flex: 1 }}></span>
          {t && <span className="mono dim2" style={{ fontSize: 10 }}>{t}</span>}
        </div>
      </header>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

// ─── ArgRow ────────────────────────────────────────────────
// Display-only by default; pass `onChange` to make the value
// editable inline. Pass `options` to render a dropdown instead
// of a text input. The dotted underline cues editability without
// adding chrome; values commit on blur or Enter, cancel on Escape.
function ArgRow({ k, v, c, onChange, options, max = 32 }) {
  const editable = typeof onChange === "function";
  const [editing, setEditing] = tcUseState(false);
  const [val, setVal] = tcUseState(v);
  tcUseEffect(() => { setVal(v); }, [v]);
  const color = c || "var(--c-lime)";
  const commit = (newVal) => { onChange?.(newVal); setEditing(false); };

  const fmt = (x) => {
    if (typeof x === "string") {
      return `"${x.length > max ? x.slice(0, max) + "…" : x}"`;
    }
    return JSON.stringify(x);
  };

  if (editable && editing) {
    if (options) {
      return (
        <div className="mono" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
          <span className="dim2">{k}:</span>{" "}
          <select
            autoFocus value={val}
            onChange={(e) => { const next = e.target.value === "true" ? true : e.target.value === "false" ? false : e.target.value; setVal(next); commit(next); }}
            onBlur={() => setEditing(false)}
            style={{
              background: "var(--host-bg-3)", color, border: "var(--line-2)",
              borderRadius: 3, font: "inherit", padding: "1px 4px",
            }}
          >
            {options.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
          </select>
        </div>
      );
    }
    return (
      <div className="mono" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
        <span className="dim2">{k}:</span>{" "}
        <input
          autoFocus
          value={typeof val === "string" ? val : JSON.stringify(val)}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => commit(val)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(val);
            else if (e.key === "Escape") { setVal(v); setEditing(false); }
          }}
          style={{
            background: "var(--host-bg-3)", color, border: "var(--line-2)",
            borderRadius: 3, font: "inherit", padding: "1px 4px",
            width: Math.max(80, String(val).length * 7 + 16),
          }}
        />
      </div>
    );
  }

  return (
    <div className="mono" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
      <span className="dim2">{k}:</span>{" "}
      <span
        onClick={() => editable && setEditing(true)}
        style={{
          color, cursor: editable ? "pointer" : "default",
          borderBottom: editable ? "1px dotted color-mix(in oklch, currentColor 40%, transparent)" : "none",
          paddingBottom: 1,
        }}
        title={editable ? "click to edit" : ""}
      >
        {fmt(v)}
      </span>
    </div>
  );
}

function Section({ children, style }) {
  return <div style={{ padding: "12px 16px", ...(style || {}) }}>{children}</div>;
}

function Hr() { return <div style={{ height: 1, background: "var(--host-border-2)" }}></div>; }

function PreviewHeader({ icon, label, badge }) {
  return (
    <div className="row" style={{ padding: "8px 16px", background: "var(--host-bg-2)", borderTop: "var(--line-2)", borderBottom: "var(--line-2)" }}>
      <span className="mono" style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--host-fg-3)" }}>{label}</span>
      <span style={{ flex: 1 }}></span>
      {badge && <span className="mono dim2" style={{ fontSize: 10 }}>{badge}</span>}
    </div>
  );
}

// Tiny sparkline ish bar
function MiniBar({ v, color, label, sub }) {
  return (
    <div className="row" style={{ gap: 10, padding: "5px 0" }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: "0 0 auto" }}></span>
      <span style={{ fontSize: 12.5, color: "var(--host-fg)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      <span style={{ width: 70, height: 3, background: "var(--host-bg-3)", borderRadius: 999, overflow: "hidden", flex: "0 0 auto" }}>
        <span style={{ display: "block", height: "100%", width: `${v * 100}%`, background: color }}></span>
      </span>
      <span className="mono dim2" style={{ fontSize: 10.5, width: 32, textAlign: "right", flex: "0 0 auto" }}>{sub}</span>
    </div>
  );
}

// ============================================================
// 1. ANALYSIS — graph-from-text and graph-as-context
// ============================================================

// 1.1 generate_knowledge_graph
function T_GenerateKnowledgeGraph() {
  const tw = useToolsTweaks();
  const { status, t, runs, run } = useToolRun({ duration: 1800 });
  const [modify, setModify] = tcUseState("entities");
  const [includeStmt, setIncludeStmt] = tcUseState(true);
  const [hover, setHover] = tcUseState(null);
  const seed = 7 + runs;  // re-running gives a fresh layout
  return (
    <ToolCard name="generate_knowledge_graph" group="Analysis" t={t} status={status} onRun={run} accent="var(--c-orange)">
      <Section style={{ paddingBottom: 0 }}>
        <ArgRow k="text" v="<2,841 chars>" c="var(--c-cyan)" />
        <ArgRow k="modifyAnalyzedText" v={modify} onChange={setModify} options={["none", "entities", "lemmatize"]} />
        <ArgRow k="includeStatements" v={includeStmt} c="var(--c-orange)" onChange={setIncludeStmt} options={[true, false]} />
      </Section>
      <PreviewHeader label="graph result" badge={`${142 + runs * 3} nodes · ${318 + runs * 4} edges · 5 clusters`} />
      <div
        style={{ flex: 1, minHeight: 0, position: "relative", opacity: status === "run" ? 0.55 : 1, transition: "opacity 220ms" }}
        onMouseLeave={() => setHover(null)}
      >
        <ForceGraph seed={seed} density={tw.density} variant="topology" showLabels={tw.labels} showHulls focus={hover} showSpecular={tw.showSpecular} />
        <div style={{ position: "absolute", bottom: 8, left: 12, display: "flex", gap: 4 }}>
          <span className="pill mono" style={{ fontSize: 10 }}><span className="dot" style={{ background: "var(--c-orange)" }}></span>kg</span>
          <span className="pill mono" style={{ fontSize: 10 }}><span className="dot" style={{ background: "var(--c-cyan)" }}></span>lm</span>
          <span className="pill mono" style={{ fontSize: 10 }}><span className="dot" style={{ background: "var(--c-violet)" }}></span>ds</span>
          <span className="pill mono" style={{ fontSize: 10 }}><span className="dot" style={{ background: "var(--c-lime)" }}></span>nw</span>
          <span className="pill mono" style={{ fontSize: 10 }}><span className="dot" style={{ background: "var(--c-magenta)" }}></span>gap</span>
        </div>
      </div>
    </ToolCard>
  );
}

// 1.2 analyze_existing_graph_by_name
function T_AnalyzeExistingGraph() {
  const tw = useToolsTweaks();
  const { status, t, runs, run } = useToolRun({ duration: 420 });
  const [graphName, setGraphName] = tcUseState("research-notes-2026");
  const [includeSummary, setIncludeSummary] = tcUseState(true);
  const seed = 11 + runs;
  return (
    <ToolCard name="analyze_existing_graph_by_name" group="Analysis" t={t} status={status} onRun={run} accent="var(--c-cyan)">
      <Section>
        <ArgRow k="graphName" v={graphName} c="var(--c-cyan)" onChange={setGraphName}
          options={["research-notes-2026", "manuscript-draft-v4", "competitor-scan", "customer-interviews"]} />
        <ArgRow k="includeGraphSummary" v={includeSummary} c="var(--c-orange)" onChange={setIncludeSummary} options={[true, false]} />
      </Section>
      <PreviewHeader label="loaded from infranodus" badge="last touched 2h ago" />
      <div style={{ display: "grid", gridTemplate: "1fr / 0.55fr 0.45fr", flex: 1, minHeight: 0, opacity: status === "run" ? 0.55 : 1, transition: "opacity 220ms" }}>
        <div style={{ position: "relative", borderRight: "var(--line-2)" }}>
          <ForceGraph seed={seed} density={tw.density} variant="topology" showLabels={tw.labels} showSpecular={tw.showSpecular} />
        </div>
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, overflow: "auto" }}>
          <div className="stat" style={{ padding: "6px 8px" }}><span className="num" style={{ fontSize: 16 }}>{142 + runs}</span><span className="lab">nodes</span></div>
          <div className="stat" style={{ padding: "6px 8px" }}><span className="num" style={{ fontSize: 16 }}>{318 + runs * 2}</span><span className="lab">edges</span></div>
          <div className="stat" style={{ padding: "6px 8px" }}><span className="num" style={{ fontSize: 16 }}>0.42</span><span className="lab">modularity</span></div>
          <div className="stat" style={{ padding: "6px 8px" }}><span className="num" style={{ fontSize: 16 }}>2.91</span><span className="lab">entropy</span></div>
        </div>
      </div>
    </ToolCard>
  );
}

// 1.3 create_knowledge_graph
function T_CreateKnowledgeGraph() {
  const tw = useToolsTweaks();
  const { status, t, runs, run } = useToolRun({ duration: 2100 });
  const [name, setName] = tcUseState("aug-research-batch");
  return (
    <ToolCard name="create_knowledge_graph" group="Analysis" t={t} status={status} onRun={run} accent="var(--c-lime)">
      <Section>
        <ArgRow k="text" v="<5,210 chars>" c="var(--c-cyan)" />
        <ArgRow k="name" v={name} c="var(--c-cyan)" onChange={setName} />
      </Section>
      <PreviewHeader label={status === "run" ? "creating…" : "created · link returned"} badge={status === "run" ? "status: 102" : "status: 201"} />
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
        <div style={{
          padding: "10px 12px", border: "1px solid var(--in-accent-line)",
          borderRadius: 4, background: "var(--in-accent-soft)",
        }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--c-lime)" }}></span>
            <span className="mono" style={{ fontSize: 12, color: "var(--host-fg)" }}>{name}</span>
            <span style={{ flex: 1 }}></span>
            <span className="mono dim2" style={{ fontSize: 11 }}>{status === "run" ? "… saving" : "✓ saved"}</span>
          </div>
          <a className="mono" style={{ fontSize: 11.5, color: "var(--c-cyan)", textDecoration: "none", wordBreak: "break-all" }}>
            https://infranodus.com/g/{name}
          </a>
        </div>
        <div style={{ flex: 1, minHeight: 0, position: "relative", border: "var(--line-2)", borderRadius: 4, overflow: "hidden", opacity: status === "run" ? 0.4 : 1, transition: "opacity 220ms" }}>
          <ForceGraph seed={17 + runs} density={tw.density} variant="topology" showLabels={tw.labels} showHulls showSpecular={tw.showSpecular} />
          <div style={{ position: "absolute", top: 6, left: 8 }}>
            <span className="pill mono" style={{ fontSize: 10 }}>preview · {86 + runs} nodes</span>
          </div>
        </div>
      </div>
    </ToolCard>
  );
}

// 1.4 retrieve_from_knowledge_base
function T_RetrieveFromKB() {
  const tw = useToolsTweaks();
  const { status, t, run } = useToolRun({ duration: 780 });
  const [graphName, setGraphName] = tcUseState("research-notes-2026");
  const [prompt, setPrompt] = tcUseState("how do bridges form?");
  const [includeSummary, setIncludeSummary] = tcUseState(true);
  const [selected, setSelected] = tcUseState(null);
  const allStmts = [
    { s: "Bridges form at the boundary of cluster hulls, where betweenness centrality spikes.", k: 0.92 },
    { s: "The 'embedding' concept routes 4 of the 7 cross-cluster paths in this corpus.", k: 0.88 },
    { s: "Ontology-discourse coupling is asymmetric; ontology bridges out, discourse does not bridge in.", k: 0.81 },
    { s: "When a hub is removed, the modularity score rises by ~0.04 on average.", k: 0.74 },
  ];
  return (
    <ToolCard name="retrieve_from_knowledge_base" group="Analysis · GraphRAG" t={t} status={status} onRun={run} accent="var(--c-violet)">
      <Section>
        <ArgRow k="graphName" v={graphName} c="var(--c-cyan)" onChange={setGraphName}
          options={["research-notes-2026", "manuscript-draft-v4", "competitor-scan"]} />
        <ArgRow k="prompt" v={prompt} c="var(--c-orange)" onChange={setPrompt} />
        <ArgRow k="includeGraphSummary" v={includeSummary} c="var(--c-orange)" onChange={setIncludeSummary} options={[true, false]} />
      </Section>
      <PreviewHeader label="ranked statements" badge="6 of 18 returned" />
      <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0, overflow: "auto", opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        {allStmts.map((it, i) => {
          const isSel = selected === i;
          return (
            <div key={i}
              onClick={() => setSelected(isSel ? null : i)}
              style={{
                padding: "8px 10px", border: "1px solid " + (isSel ? "var(--c-violet)" : "var(--host-border-2)"),
                borderRadius: 4, background: isSel ? "color-mix(in oklch, var(--c-violet) 14%, var(--host-bg-2))" : "var(--host-bg-2)",
                cursor: "pointer", transition: "all 160ms",
              }}
            >
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <span className="mono dim2" style={{ fontSize: 10 }}>#{String(i + 1).padStart(2, "0")}</span>
                <span style={{ flex: 1 }}></span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--c-violet)" }}>{it.k.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--host-fg-2)", lineHeight: 1.5 }}>{it.s}</div>
            </div>
          );
        })}
      </div>
    </ToolCard>
  );
}

// 1.5 develop_text_tool — multi-step pipeline w/ live progress
function T_DevelopText() {
  const tw = useToolsTweaks();
  const speed = (tw && tw.speed) || 1;
  const STEPS = [
    { id: 1, name: "generate_topical_clusters",    ms: 620 },
    { id: 2, name: "generate_content_gaps",        ms: 840 },
    { id: 3, name: "develop_latent_topics",        ms: 1100 },
    { id: 4, name: "develop_conceptual_bridges",   ms: 1240 },
    { id: 5, name: "generate_research_ideas",      ms: 980 },
  ];
  const totalMs = STEPS.reduce((a, s) => a + s.ms, 0) / speed;
  // currentStep: 0..STEPS.length. < STEPS.length means running; === means done.
  const [pipeline, setPipeline] = tcUseState({ current: STEPS.length, dt: STEPS.map((s) => `${(s.ms / 1000).toFixed(2)}s`) });
  const [status, setStatus] = tcUseState("ok");
  const [t, setT] = tcUseState(`${(totalMs / 1000).toFixed(2)}s`);
  const timers = tcUseRef([]);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  tcUseEffect(() => clear, []);

  const run = () => {
    clear();
    setStatus("run");
    setT("…");
    setPipeline({ current: 0, dt: STEPS.map(() => "…") });
    let cum = 0;
    const startWall = Date.now();
    const tickWall = setInterval(() => setT(`${((Date.now() - startWall) / 1000).toFixed(2)}s`), 100);
    timers.current.push(tickWall);
    STEPS.forEach((s, i) => {
      cum += s.ms / speed;
      const id = setTimeout(() => {
        setPipeline((p) => {
          const dt = p.dt.slice();
          dt[i] = `${(s.ms / 1000 / speed).toFixed(2)}s`;
          return { current: i + 1, dt };
        });
        if (i === STEPS.length - 1) {
          clearInterval(tickWall);
          setStatus("ok");
          setT(`${(totalMs / 1000).toFixed(2)}s`);
        }
      }, cum);
      timers.current.push(id);
    });
  };

  const cancel = () => {
    clear();
    setStatus("ok");
    setT(`${(totalMs / 1000).toFixed(2)}s`);
    setPipeline((p) => ({ ...p, current: STEPS.length }));
  };

  const pct = Math.round((pipeline.current / STEPS.length) * 100);

  return (
    <ToolCard name="develop_text_tool" group="Analysis · pipeline" t={t} status={status} onRun={run} accent="var(--c-magenta)">
      <Section>
        <ArgRow k="text" v="<4,108 chars>" c="var(--c-cyan)" />
        <ArgRow k="depth" v="comprehensive" />
      </Section>
      <PreviewHeader
        label={status === "run" ? "progress" : "complete"}
        badge={status === "run" ? `step ${Math.min(pipeline.current + 1, STEPS.length)} of ${STEPS.length}` : `${STEPS.length} of ${STEPS.length}`}
      />
      <div style={{ padding: "12px 16px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {STEPS.map((s, i) => (
          <Step key={s.id} n={s.id} t={s.name}
            done={i < pipeline.current}
            running={status === "run" && i === pipeline.current}
            dt={i <= pipeline.current ? pipeline.dt[i] : ""}
          />
        ))}
        <div style={{ marginTop: 6, height: 4, background: "var(--host-bg-3)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: "linear-gradient(90deg, var(--c-magenta), var(--in-accent))",
            transition: "width 240ms ease-out",
          }}></div>
        </div>
        <div className="row" style={{ marginTop: 4 }}>
          <span className="mono dim2" style={{ fontSize: 11 }}>
            {status === "run" ? `${pct}% \u00b7 running` : `${pct}% \u00b7 done`}
          </span>
          <span style={{ flex: 1 }}></span>
          {status === "run" && (
            <button onClick={cancel} className="btn ghost mono" style={{ padding: "3px 8px", fontSize: 10 }}>cancel</button>
          )}
        </div>
      </div>
    </ToolCard>
  );
}

function Step({ n, t, done, running, dt }) {
  const color = done ? "var(--ok)" : running ? "var(--warn)" : "var(--host-fg-3)";
  return (
    <div className="row" style={{ gap: 10 }}>
      <span className="mono dim2" style={{ fontSize: 10, width: 14 }}>{String(n).padStart(2, "0")}</span>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: "0 0 auto", boxShadow: running ? `0 0 8px ${color}` : "" }}></span>
      <span className="mono" style={{ fontSize: 11.5, color: done || running ? "var(--host-fg)" : "var(--host-fg-3)", flex: 1 }}>{t}</span>
      {dt && <span className="mono dim2" style={{ fontSize: 10.5 }}>{dt}</span>}
    </div>
  );
}

// ============================================================
// 2. INSIGHT — graph → meaning
// ============================================================

// 2.1 generate_content_gaps
function T_ContentGaps() {
  const tw = useToolsTweaks();
  const { status, t, run } = useToolRun({ duration: 610 });
  const [hoverIdx, setHoverIdx] = tcUseState(null);
  const gaps = [
    { a: "discourse", b: "network science", v: 0.78, hint: "narrative betweenness" },
    { a: "language model", b: "gaps", v: 0.62, hint: "attention coverage" },
    { a: "ontology", b: "discourse", v: 0.41, hint: "narrative structure" },
  ];
  return (
    <ToolCard name="generate_content_gaps" group="Insight" t={t} status={status} onRun={run} accent="var(--c-magenta)">
      <Section><ArgRow k="text" v="<2,841 chars>" c="var(--c-cyan)" /></Section>
      <PreviewHeader label="structural gaps" badge="3 found · sorted by strength" />
      <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0, opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        {gaps.map((g, i) => (
          <div key={i}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{
              padding: "10px 12px",
              border: "1px solid " + (hoverIdx === i ? "var(--c-magenta)" : "var(--host-border-2)"),
              borderRadius: 4,
              background: hoverIdx === i ? "color-mix(in oklch, var(--c-magenta) 12%, var(--host-bg-2))" : "var(--host-bg-2)",
              transition: "all 160ms", cursor: "pointer",
            }}
          >
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: 11.5 }}>
                <span style={{ color: "var(--c-orange)" }}>{g.a}</span>{" "}
                <span className="dim2">⟶</span>{" "}
                <span style={{ color: "var(--c-cyan)" }}>{g.b}</span>
              </span>
              <span style={{ flex: 1 }}></span>
              <span style={{ width: 60, height: 3, background: "var(--host-bg-3)", borderRadius: 999, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${g.v * 100}%`, background: "var(--c-magenta)", transition: "width 240ms" }}></span>
              </span>
              <span className="mono dim2" style={{ fontSize: 10.5 }}>{g.v.toFixed(2)}</span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className="mono dim2" style={{ fontSize: 10, letterSpacing: "0.06em" }}>BRIDGE →</span>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--in-accent)" }}>{g.hint}</span>
            </div>
          </div>
        ))}
      </div>
    </ToolCard>
  );
}

// 2.2 generate_topical_clusters
function T_TopicalClusters() {
  const { status, t, run } = useToolRun({ duration: 740 });
  const [aiNaming, setAiNaming] = tcUseState(true);
  const [expanded, setExpanded] = tcUseState(0);
  const clusters = [
    { l: "knowledge graph", n: 7, c: "var(--c-orange)", v: 0.92, kws: ["ontology", "vertex", "graph", "concept", "topology", "node", "edge"] },
    { l: "language model", n: 6, c: "var(--c-cyan)", v: 0.81, kws: ["llm", "prompt", "embedding", "context", "token", "claude"] },
    { l: "discourse analysis", n: 6, c: "var(--c-violet)", v: 0.66, kws: ["frame", "rhetoric", "voice", "narrative", "text", "discourse"] },
    { l: "network science", n: 4, c: "var(--c-lime)", v: 0.55, kws: ["betweenness", "community", "modularity", "centrality"] },
    { l: "gaps", n: 3, c: "var(--c-magenta)", v: 0.41, kws: ["bridge", "blind-spot", "gap"] },
  ];
  return (
    <ToolCard name="generate_topical_clusters" group="Insight" t={t} status={status} onRun={run} accent="var(--c-orange)">
      <Section>
        <ArgRow k="text" v="<2,841 chars>" c="var(--c-cyan)" />
        <ArgRow k="aiTopicNaming" v={aiNaming} c="var(--c-orange)" onChange={setAiNaming} options={[true, false]} />
      </Section>
      <PreviewHeader label="clusters" badge="5 detected · click to expand" />
      <div style={{ padding: "8px 16px 14px", flex: 1, minHeight: 0, overflow: "auto", opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        {clusters.map((cl, i) => {
          const isOpen = expanded === i;
          return (
            <div key={i}
              onClick={() => setExpanded(isOpen ? -1 : i)}
              style={{ padding: "8px 0", borderBottom: i < clusters.length - 1 ? "var(--line-2)" : "none", cursor: "pointer" }}
            >
              <div className="row" style={{ marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: cl.c }}></span>
                <span style={{ fontSize: 13, color: "var(--host-fg)", marginLeft: 8, flex: 1, fontWeight: 500 }}>{cl.l}</span>
                <span style={{ width: 50, height: 3, background: "var(--host-bg-3)", borderRadius: 999, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${cl.v * 100}%`, background: cl.c }}></span>
                </span>
                <span className="mono dim2" style={{ fontSize: 10.5, marginLeft: 8, width: 28, textAlign: "right" }}>{cl.n}</span>
              </div>
              <div className="mono dim2" style={{ fontSize: 10.5, marginLeft: 16, lineHeight: 1.55 }}>
                {(isOpen ? cl.kws : cl.kws.slice(0, 4)).join(" · ")}
                {!isOpen && cl.kws.length > 4 && <span style={{ color: cl.c, marginLeft: 6 }}>+{cl.kws.length - 4}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </ToolCard>
  );
}

// 2.3 generate_contextual_hint
function T_ContextualHint() {
  const { status, t, run } = useToolRun({ duration: 550 });
  const [forUse, setForUse] = tcUseState("prompt-augmentation");
  const [copied, setCopied] = tcUseState(false);
  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 1100); };
  return (
    <ToolCard name="generate_contextual_hint" group="Insight" t={t} status={status} onRun={run} accent="var(--in-accent)">
      <Section>
        <ArgRow k="text" v="<2,841 chars>" c="var(--c-cyan)" />
        <ArgRow k="for" v={forUse} c="var(--c-orange)" onChange={setForUse}
          options={["prompt-augmentation", "context-window", "system-prompt"]} />
      </Section>
      <PreviewHeader label="contextual overview" badge="for downstream llm" />
      <div style={{ padding: "14px 18px", flex: 1, overflow: "auto", opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: 4, background: "var(--in-accent-soft)", border: "1px solid var(--in-accent-line)", display: "grid", placeItems: "center" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--in-accent)" }}>✦</span>
          </span>
          <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--host-fg-3)" }}>ai overview</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--host-fg)" }}>
          The text discusses{" "}
          <em style={{ fontStyle: "normal", color: "var(--c-orange)" }}>knowledge graphs</em>,{" "}
          <em style={{ fontStyle: "normal", color: "var(--c-cyan)" }}>language models</em>, and{" "}
          <em style={{ fontStyle: "normal", color: "var(--c-violet)" }}>discourse</em>, with{" "}
          <em style={{ fontStyle: "normal", color: "var(--in-accent)" }}>embedding</em> and{" "}
          <em style={{ fontStyle: "normal", color: "var(--in-accent)" }}>ontology</em>{" "}
          as the central bridging concepts. Discourse remains structurally isolated from network-science terms — an opportunity for elaboration.
        </p>
        <div
          onClick={copy}
          style={{ marginTop: 12, padding: "8px 10px", background: "var(--host-bg-3)", border: "1px solid " + (copied ? "var(--ok)" : "var(--host-border-2)"), borderRadius: 4, cursor: "pointer", transition: "border 160ms" }}
        >
          <div className="row" style={{ marginBottom: 4 }}>
            <span className="mono dim2" style={{ fontSize: 10 }}>{copied ? "✓ copied to clipboard" : "click to copy as prompt fragment"}</span>
          </div>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--host-fg)", lineHeight: 1.5 }}>
            Context: 3 clusters · top bridge: embedding · gap: discourse↔network sci
          </div>
        </div>
      </div>
    </ToolCard>
  );
}

// 2.4 develop_conceptual_bridges
function T_ConceptualBridges() {
  const { status, t, run } = useToolRun({ duration: 1300 });
  const [model, setModel] = tcUseState("claude-sonnet");
  return (
    <ToolCard name="develop_conceptual_bridges" group="Insight" t={t} status={status} onRun={run} accent="var(--c-cyan)">
      <Section>
        <ArgRow k="text" v="<2,841 chars>" c="var(--c-cyan)" />
        <ArgRow k="model" v={model} c="var(--c-cyan)" onChange={setModel}
          options={["claude-sonnet", "claude-haiku", "gpt-5", "gpt-5-mini"]} />
      </Section>
      <PreviewHeader label="conceptual bridges" badge="4 latent connectors" />
      <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1, overflow: "auto", opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        {[
          { c: "narrative betweenness", w: "bridges discourse → network science via centrality framing" },
          { c: "attention coverage", w: "bridges language models → gaps via context-window awareness" },
          { c: "structural rhetoric", w: "bridges ontology → discourse via argument graphs" },
          { c: "semantic gravity", w: "bridges embedding → community detection via density" },
        ].map((b, i) => (
          <div key={i} className="row" style={{ gap: 10, padding: "8px 10px", border: "var(--line-2)", borderRadius: 4, background: "var(--host-bg-2)", cursor: "pointer", transition: "all 160ms" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--c-cyan)"; e.currentTarget.style.background = "color-mix(in oklch, var(--c-cyan) 10%, var(--host-bg-2))"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = "var(--host-bg-2)"; }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-cyan)", boxShadow: "0 0 8px var(--c-cyan)", flex: "0 0 auto" }}></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 12.5, color: "var(--host-fg)" }}>{b.c}</div>
              <div style={{ fontSize: 11.5, color: "var(--host-fg-2)", marginTop: 2 }}>{b.w}</div>
            </div>
          </div>
        ))}
      </div>
    </ToolCard>
  );
}

// 2.5 develop_latent_topics
function T_LatentTopics() {
  const { status, t, run } = useToolRun({ duration: 1100 });
  const [developed, setDeveloped] = tcUseState({});
  const items = [
    { t: "graph diff over time", e: "Mentioned once; could anchor a section on temporal modularity." },
    { t: "uncertainty in centrality", e: "Implied but never named. Confidence bands on pagerank?" },
    { t: "narrative coherence", e: "Adjacent to discourse cluster; could pull together loose ends." },
  ];
  return (
    <ToolCard name="develop_latent_topics" group="Insight" t={t} status={status} onRun={run} accent="var(--c-violet)">
      <Section><ArgRow k="text" v="<2,841 chars>" c="var(--c-cyan)" /></Section>
      <PreviewHeader label="under-developed topics" badge="3 latent" />
      <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1, overflow: "auto", opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        {items.map((it, i) => {
          const isDev = developed[i];
          return (
            <div key={i} style={{
              padding: "8px 12px",
              border: "1px solid " + (isDev ? "var(--c-violet)" : "var(--host-border-2)"),
              borderRadius: 4,
              background: isDev ? "color-mix(in oklch, var(--c-violet) 12%, var(--host-bg-2))" : "var(--host-bg-2)",
              transition: "all 160ms",
            }}>
              <div className="row" style={{ marginBottom: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--c-violet)" }}></span>
                <span className="mono" style={{ fontSize: 12, color: "var(--host-fg)", marginLeft: 8 }}>{it.t}</span>
                <span style={{ flex: 1 }}></span>
                <button
                  onClick={() => setDeveloped({ ...developed, [i]: !isDev })}
                  className="btn ghost mono" style={{ fontSize: 10, padding: "2px 6px" }}>
                  {isDev ? "✓ developed" : "develop ↗"}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--host-fg-2)", lineHeight: 1.5, paddingLeft: 14 }}>{it.e}</div>
            </div>
          );
        })}
      </div>
    </ToolCard>
  );
}

// ============================================================
// 3. RESEARCH — questions + ideas + responses
// ============================================================

function QnList({ items, color = "var(--in-accent)" }) {
  const [copied, setCopied] = tcUseState(null);
  const copy = (i, q) => { setCopied(i); setTimeout(() => setCopied(null), 900); };
  return (
    <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1, overflow: "auto" }}>
      {items.map((q, i) => (
        <div key={i}
          onClick={() => copy(i, q)}
          className="row" style={{
            padding: "8px 10px",
            border: "1px solid " + (copied === i ? color : "var(--host-border-2)"),
            borderRadius: 4, background: "var(--host-bg-2)",
            cursor: "pointer", transition: "border 160ms",
          }}
          title="click to copy"
        >
          <span className="mono" style={{ fontSize: 10.5, color, width: 18, flex: "0 0 auto" }}>{String(i + 1).padStart(2, "0")}</span>
          <span style={{ fontSize: 12.5, color: "var(--host-fg)", flex: 1, lineHeight: 1.45 }}>{q}</span>
          <span className="mono dim2" style={{ fontSize: 9, marginLeft: 8 }}>{copied === i ? "copied" : "copy"}</span>
        </div>
      ))}
    </div>
  );
}

// 3.1 generate_research_questions
function T_ResearchQuestions() {
  const { status, t, run } = useToolRun({ duration: 1400 });
  const [topN, setTopN] = tcUseState(5);
  const all = [
    "How can narrative framing be encoded as a centrality metric?",
    "What attention pattern would surface a structural gap in real time?",
    "Can ontology be expressed as a directed discourse graph?",
    "Where in a corpus does community density correlate with rhetorical strength?",
    "What does a 'blind-spot' look like in a node-embedding space?",
    "How robust are bridge concepts to paraphrase?",
    "Which clusters survive when half the corpus is removed?",
  ];
  return (
    <ToolCard name="generate_research_questions" group="Research" t={t} status={status} onRun={run} accent="var(--in-accent)">
      <Section>
        <ArgRow k="text" v="<2,841 chars>" c="var(--c-cyan)" />
        <ArgRow k="topN" v={topN} onChange={(v) => setTopN(Number(v) || 5)} options={[3, 5, 7]} />
      </Section>
      <PreviewHeader label="questions · bridge gaps" badge={`${Math.min(topN, all.length)} generated`} />
      <div style={{ opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms", display: "contents" }}>
        <QnList items={all.slice(0, topN)} />
      </div>
    </ToolCard>
  );
}

// 3.2 generate_research_ideas
function T_ResearchIdeas() {
  const { status, t, runs, run } = useToolRun({ duration: 1700 });
  const [model, setModel] = tcUseState("claude-sonnet");
  const all = [
    [
      { t: "Visualize attention as graph hulls", w: "Overlay transformer attention onto the knowledge graph; treat each head as a cluster lens." },
      { t: "Bridge-finder regression", w: "Predict which cross-cluster pairs are most fertile for new content; train on past edits." },
      { t: "Narrative diff", w: "Compute the rhetorical delta between two snapshots and surface it as a single sentence." },
    ],
    [
      { t: "Cluster decay tracking", w: "Watch which clusters lose mass over revisions and flag concepts on their way out." },
      { t: "Embedding-aware betweenness", w: "Re-weight betweenness by semantic distance, not just structural distance." },
      { t: "Counter-bridge generation", w: "For every bridge you find, draft the contrarian bridge that argues against it." },
    ],
  ];
  const items = all[runs % all.length];
  return (
    <ToolCard name="generate_research_ideas" group="Research" t={t} status={status} onRun={run} accent="var(--c-lime)">
      <Section>
        <ArgRow k="text" v="<2,841 chars>" c="var(--c-cyan)" />
        <ArgRow k="model" v={model} c="var(--c-cyan)" onChange={setModel}
          options={["claude-sonnet", "claude-haiku", "gpt-5", "gpt-5-mini"]} />
      </Section>
      <PreviewHeader label="ideas · from content gaps" badge={`${items.length} actionable · re-roll for more`} />
      <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1, overflow: "auto", opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        {items.map((it, i) => (
          <div key={i} style={{ padding: "10px 12px", border: "var(--line-2)", borderRadius: 4, background: "var(--host-bg-2)" }}>
            <div className="row" style={{ marginBottom: 4 }}>
              <span className="mono dim2" style={{ fontSize: 10 }}>idea {String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 1 }}></span>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-lime)", boxShadow: "0 0 6px var(--c-lime)" }}></span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--host-fg)", fontWeight: 500 }}>{it.t}</div>
            <div style={{ fontSize: 11.5, color: "var(--host-fg-2)", marginTop: 3, lineHeight: 1.5 }}>{it.w}</div>
          </div>
        ))}
      </div>
    </ToolCard>
  );
}

// 3.3 research_questions_from_graph
function T_ResearchQuestionsFromGraph() {
  const { status, t, run } = useToolRun({ duration: 1200 });
  const [graphName, setGraphName] = tcUseState("research-notes-2026");
  const [topN, setTopN] = tcUseState(4);
  return (
    <ToolCard name="research_questions_from_graph" group="Research" t={t} status={status} onRun={run} accent="var(--c-cyan)">
      <Section>
        <ArgRow k="graphName" v={graphName} c="var(--c-cyan)" onChange={setGraphName}
          options={["research-notes-2026", "manuscript-draft-v4", "competitor-scan"]} />
        <ArgRow k="topN" v={topN} onChange={(v) => setTopN(Number(v) || 4)} options={[3, 4, 5, 6]} />
      </Section>
      <PreviewHeader label="questions · from saved graph" badge="seeded by 9 gaps" />
      <div style={{ opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms", display: "contents" }}>
        <QnList color="var(--c-cyan)" items={[
          "How do discourse markers shift the betweenness of an ontology node?",
          "What is the half-life of a bridge concept once introduced?",
          "Does increasing cluster modularity decrease cross-domain creativity?",
          "Can a small-world graph be re-fragmented intentionally for clarity?",
          "How does removing a hub redistribute centrality?",
          "What is the optimal density before a graph collapses into one cluster?",
        ].slice(0, topN)} />
      </div>
    </ToolCard>
  );
}

// 3.4 generate_responses_from_graph
function T_ResponsesFromGraph() {
  const { status, t, run } = useToolRun({ duration: 2400 });
  const [graphName, setGraphName] = tcUseState("research-notes-2026");
  const [prompt, setPrompt] = tcUseState("explain bridges to a novice");
  const [highlightCit, setHighlightCit] = tcUseState(null);
  return (
    <ToolCard name="generate_responses_from_graph" group="Research" t={t} status={status} onRun={run} accent="var(--c-violet)">
      <Section>
        <ArgRow k="graphName" v={graphName} c="var(--c-cyan)" onChange={setGraphName}
          options={["research-notes-2026", "manuscript-draft-v4", "competitor-scan"]} />
        <ArgRow k="prompt" v={prompt} c="var(--c-orange)" onChange={setPrompt} />
      </Section>
      <PreviewHeader label="grounded response" badge="cited 7 statements · hover to highlight" />
      <div style={{ padding: "14px 18px", flex: 1, overflow: "auto", opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "var(--host-fg)" }}>
          A bridge is a concept that sits between two communities of ideas. In your notes,{" "}
          <span style={{ background: "var(--in-accent-soft)", color: "var(--in-accent)", padding: "0 4px", borderRadius: 3 }} className="mono">embedding</span>{" "}
          plays this role for{" "}
          <span style={{ color: "var(--c-orange)" }}>knowledge graphs</span>{" "}
          and{" "}
          <span style={{ color: "var(--c-cyan)" }}>language models</span> — it appears in both contexts and connects them.
        </p>
        <div className="row" style={{ marginTop: 12, gap: 6, flexWrap: "wrap" }}>
          {["#s14", "#s27", "#s31", "#s42", "#s58", "#s71", "#s84"].map((c, i) => (
            <span key={i}
              onMouseEnter={() => setHighlightCit(i)}
              onMouseLeave={() => setHighlightCit(null)}
              className="pill mono"
              style={{
                fontSize: 10, cursor: "pointer",
                background: highlightCit === i ? "color-mix(in oklch, var(--c-violet) 25%, var(--host-bg-3))" : "var(--host-bg-3)",
                borderColor: highlightCit === i ? "var(--c-violet)" : "",
                transition: "all 160ms",
              }}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </ToolCard>
  );
}

// ============================================================
// 4. COMPARE — overlap & difference between texts
// ============================================================

// 4.1 overlap_between_texts
function T_Overlap() {
  const tw = useToolsTweaks();
  const { status, t, run } = useToolRun({ duration: 2000 });
  const [a, setA] = tcUseState("manuscript-draft-v4");
  const [b, setB] = tcUseState("competitor-scan");
  return (
    <ToolCard name="overlap_between_texts" group="Compare · A ∩ B" t={t} status={status} onRun={run} accent="var(--c-lime)">
      <Section>
        <ArgRow k="texts[0]" v={a} c="var(--c-cyan)" onChange={setA}
          options={["manuscript-draft-v4", "research-notes-2026", "customer-interviews"]} />
        <ArgRow k="texts[1]" v={b} c="var(--c-cyan)" onChange={setB}
          options={["competitor-scan", "podcast-transcripts/q1", "chat://claude-sessions"]} />
      </Section>
      <PreviewHeader label="set overlap" badge="6 shared · 8 A-only · 7 B-only" />
      <div style={{ flex: 1, minHeight: 0, position: "relative", opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        <CompareGraph mode="overlap" showLabels={tw.labels === "none" ? "none" : "all"} />
        <div style={{
          position: "absolute", bottom: 8, left: 12, right: 12,
          display: "flex", gap: 6, alignItems: "center",
        }}>
          <span className="pill mono" style={{ fontSize: 10 }}>
            <span className="dot" style={{ background: "var(--c-orange)" }}></span>A only · 8
          </span>
          <span className="pill mono" style={{
            fontSize: 10, background: "color-mix(in oklch, var(--c-lime) 22%, var(--host-bg-3))",
            borderColor: "color-mix(in oklch, var(--c-lime) 45%, transparent)",
          }}>
            <span className="dot" style={{ background: "var(--c-lime)" }}></span>shared · 6
          </span>
          <span className="pill mono" style={{ fontSize: 10 }}>
            <span className="dot" style={{ background: "var(--c-magenta)" }}></span>B only · 7
          </span>
          <span style={{ flex: 1 }}></span>
          <span className="mono dim2" style={{ fontSize: 10 }}>jaccard 0.29</span>
        </div>
      </div>
    </ToolCard>
  );
}

// 4.2 difference_between_texts
function T_Difference() {
  const tw = useToolsTweaks();
  const { status, t, run } = useToolRun({ duration: 2200 });
  const [a, setA] = tcUseState("manuscript-draft-v4");
  const [b, setB] = tcUseState("competitor-scan");
  const [hover, setHover] = tcUseState(null);
  const diffNodes = [
    { l: "vector retrieval", v: 0.81 },
    { l: "rerank",           v: 0.72 },
    { l: "hybrid search",    v: 0.66 },
    { l: "chunking",         v: 0.59 },
    { l: "rrf fusion",       v: 0.48 },
    { l: "synthetic q&a",    v: 0.42 },
  ];
  return (
    <ToolCard name="difference_between_texts" group="Compare · B − A" t={t} status={status} onRun={run} accent="var(--c-magenta)">
      <Section>
        <ArgRow k="texts[0]" v={a} c="var(--c-cyan)" onChange={setA}
          options={["manuscript-draft-v4", "research-notes-2026", "customer-interviews"]} />
        <ArgRow k="texts[1]" v={b} c="var(--c-cyan)" onChange={setB}
          options={["competitor-scan", "podcast-transcripts/q1", "chat://claude-sessions"]} />
      </Section>
      <PreviewHeader label="present in B, missing in A" badge="7 unique · 6 shared (dim)" />
      <div style={{ padding: "10px 16px 14px", flex: 1, display: "grid", gridTemplate: "1fr / 0.58fr 0.42fr", gap: 12, minHeight: 0, opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        <div style={{ position: "relative", border: "var(--line-2)", borderRadius: 4, overflow: "hidden" }}>
          <CompareGraph mode="diff-ba" showLabels={tw.labels === "none" ? "none" : "all"} />
          <div style={{ position: "absolute", top: 6, left: 8, display: "flex", gap: 4 }}>
            <span className="pill mono" style={{
              fontSize: 9, background: "color-mix(in oklch, var(--c-magenta) 22%, var(--host-bg-3))",
              borderColor: "color-mix(in oklch, var(--c-magenta) 45%, transparent)",
            }}>
              <span className="dot" style={{ background: "var(--c-magenta)" }}></span>diff (B − A)
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "auto" }}>
          <div className="mono dim2" style={{ fontSize: 10, marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            ranked diff
          </div>
          {diffNodes.map((it, i) => (
            <div key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                padding: "3px 6px", borderRadius: 3,
                background: hover === i ? "color-mix(in oklch, var(--c-magenta) 15%, transparent)" : "transparent",
                transition: "background 140ms",
              }}>
              <MiniBar v={it.v} color="var(--c-magenta)" label={it.l} sub={it.v.toFixed(2)} />
            </div>
          ))}
        </div>
      </div>
    </ToolCard>
  );
}

// ============================================================
// 5. SEO / GOOGLE
// ============================================================

// 5.1 analyze_google_search_results
function T_GoogleResults() {
  const tw = useToolsTweaks();
  const { status, t, runs, run } = useToolRun({ duration: 3100 });
  const [query, setQuery] = tcUseState("knowledge graph llm");
  const [depth, setDepth] = tcUseState(10);
  return (
    <ToolCard name="analyze_google_search_results" group="SEO" t={t} status={status} onRun={run} accent="var(--c-cyan)">
      <Section>
        <ArgRow k="query" v={query} c="var(--c-orange)" onChange={setQuery} />
        <ArgRow k="depth" v={depth} onChange={(v) => setDepth(Number(v) || 10)} options={[5, 10, 20, 50]} />
      </Section>
      <PreviewHeader label="informational supply" badge={`top ${depth} SERPs · ${187 + runs * 4} concepts`} />
      <div style={{ flex: 1, position: "relative", minHeight: 0, opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        <ForceGraph seed={3 + runs} density={tw.density} variant="topology" showLabels={tw.labels} showHulls showSpecular={tw.showSpecular} />
        <div style={{ position: "absolute", bottom: 8, left: 12, right: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="pill mono" style={{ fontSize: 10 }}><span className="dot" style={{ background: "var(--c-orange)" }}></span>graphRAG · 23</span>
          <span className="pill mono" style={{ fontSize: 10 }}><span className="dot" style={{ background: "var(--c-cyan)" }}></span>embeddings · 18</span>
          <span className="pill mono" style={{ fontSize: 10 }}><span className="dot" style={{ background: "var(--c-violet)" }}></span>llm context · 14</span>
        </div>
      </div>
    </ToolCard>
  );
}

// 5.2 analyze_related_search_queries
function T_RelatedQueries() {
  const tw = useToolsTweaks();
  const { status, t, runs, run } = useToolRun({ duration: 2600 });
  const [query, setQuery] = tcUseState("knowledge graph llm");
  const [includePAA, setIncludePAA] = tcUseState(true);
  return (
    <ToolCard name="analyze_related_search_queries" group="SEO" t={t} status={status} onRun={run} accent="var(--c-orange)">
      <Section>
        <ArgRow k="query" v={query} c="var(--c-orange)" onChange={setQuery} />
        <ArgRow k="includePAA" v={includePAA} c="var(--c-orange)" onChange={setIncludePAA} options={[true, false]} />
      </Section>
      <PreviewHeader label="informational demand" badge={`${38 + runs * 2} related queries · 94 concepts`} />
      <div style={{ flex: 1, position: "relative", minHeight: 0, opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        <ForceGraph seed={19 + runs} density={tw.density} variant="topology" showLabels={tw.labels} showHulls showSpecular={tw.showSpecular} />
      </div>
    </ToolCard>
  );
}

// 5.3 search_queries_vs_search_results
function T_QueriesVsResults() {
  const { status, t, run } = useToolRun({ duration: 4200 });
  const [query, setQuery] = tcUseState("knowledge graph llm");
  const [side, setSide] = tcUseState("demand"); // "demand" highlights left, "supply" highlights right
  return (
    <ToolCard name="search_queries_vs_search_results" group="SEO" t={t} status={status} onRun={run} accent="var(--c-magenta)">
      <Section>
        <ArgRow k="query" v={query} c="var(--c-orange)" onChange={setQuery} />
      </Section>
      <PreviewHeader label="demand without supply" badge="14 unmet concepts · click columns" />
      <div style={{ padding: "10px 16px 14px", display: "grid", gridTemplate: "1fr / 1fr 1fr", gap: 12, flex: 1, minHeight: 0, opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        <div onClick={() => setSide("demand")} style={{
          padding: "10px 12px",
          background: side === "demand" ? "color-mix(in oklch, var(--c-magenta) 14%, var(--host-bg-2))" : "var(--host-bg-2)",
          border: "1px solid " + (side === "demand" ? "var(--c-magenta)" : "var(--host-border-2)"),
          borderRadius: 4, display: "flex", flexDirection: "column", gap: 6, cursor: "pointer", transition: "all 160ms",
        }}>
          <div className="mono dim2" style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>demand only</div>
          {["beginner vs production", "open-source vs cloud", "knowledge graph cost", "vendor lock-in", "graph vs vector"].map((q, i) => (
            <div key={i} className="row" style={{ gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-magenta)" }}></span>
              <span style={{ fontSize: 12, color: "var(--host-fg)" }}>{q}</span>
            </div>
          ))}
        </div>
        <div onClick={() => setSide("supply")} style={{
          padding: "10px 12px",
          background: side === "supply" ? "color-mix(in oklch, var(--c-cyan) 14%, var(--host-bg-2))" : "var(--host-bg-2)",
          border: "1px solid " + (side === "supply" ? "var(--c-cyan)" : "var(--host-border-2)"),
          borderRadius: 4, display: "flex", flexDirection: "column", gap: 6, cursor: "pointer", transition: "all 160ms",
        }}>
          <div className="mono dim2" style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>supply only</div>
          {["sigma.js tutorials", "neo4j docs", "openai embeddings api", "langchain graph chains", "rag patterns"].map((q, i) => (
            <div key={i} className="row" style={{ gap: 6, opacity: side === "supply" ? 1 : 0.6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-cyan)" }}></span>
              <span style={{ fontSize: 12, color: "var(--host-fg)" }}>{q}</span>
            </div>
          ))}
        </div>
      </div>
    </ToolCard>
  );
}

// 5.4 generate_seo_report
function T_SEOReport() {
  const { status, t, run } = useToolRun({ duration: 6800 });
  const [targetQuery, setTargetQuery] = tcUseState("knowledge graph llm");
  return (
    <ToolCard name="generate_seo_report" group="SEO" t={t} status={status} onRun={run} accent="var(--in-accent)">
      <Section>
        <ArgRow k="text" v="<5,210 chars>" c="var(--c-cyan)" />
        <ArgRow k="targetQuery" v={targetQuery} c="var(--c-orange)" onChange={setTargetQuery} />
      </Section>
      <PreviewHeader label="seo report" badge={status === "run" ? "running…" : "6 of 6 sections · ok"} />
      <div style={{ padding: "12px 16px 14px", display: "grid", gridTemplate: "auto auto auto / 1fr 1fr 1fr", gap: 8, flex: 1, opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        <div className="stat"><span className="num">47</span><span className="lab">coverage %</span></div>
        <div className="stat"><span className="num">12</span><span className="lab">gaps</span></div>
        <div className="stat"><span className="num">38</span><span className="lab">in SERP</span></div>
        <div className="stat"><span className="num">26</span><span className="lab">in queries</span></div>
        <div className="stat"><span className="num">8</span><span className="lab">in yours</span></div>
        <div className="stat"><span className="num">14</span><span className="lab">opportunity</span></div>
        <div style={{ gridColumn: "1 / -1", padding: "8px 10px", background: "var(--host-bg-2)", border: "var(--line-2)", borderRadius: 4 }}>
          <div className="mono dim2" style={{ fontSize: 10, marginBottom: 4 }}>TOP RECOMMENDATION</div>
          <div style={{ fontSize: 12.5, color: "var(--host-fg)" }}>Add a section on <em style={{ fontStyle: "normal", color: "var(--in-accent)" }}>"hybrid graph + vector retrieval"</em> — high demand, low coverage in your text.</div>
        </div>
      </div>
    </ToolCard>
  );
}

// ============================================================
// 6. MEMORY — entity/relation store
// ============================================================

// 6.1 memory_add_relations
function T_MemoryAdd() {
  const { status, t, run } = useToolRun({ duration: 500 });
  const [graphName, setGraphName] = tcUseState("my-memories");
  const [entityMode, setEntityMode] = tcUseState("wikilinks");
  return (
    <ToolCard name="memory_add_relations" group="Memory" t={t} status={status} onRun={run} accent="var(--c-lime)">
      <Section>
        <ArgRow k="graphName" v={graphName} c="var(--c-cyan)" onChange={setGraphName} />
        <ArgRow k="entityMode" v={entityMode} c="var(--c-orange)" onChange={setEntityMode}
          options={["wikilinks", "auto", "manual"]} />
      </Section>
      <PreviewHeader label="extracted relations" badge="8 added · 0 updated" />
      <div style={{ padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1, overflow: "auto", opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        <div style={{ padding: "8px 10px", background: "var(--host-bg-2)", border: "var(--line-2)", borderRadius: 4 }}>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--host-fg-2)", lineHeight: 1.55 }}>
            <span style={{ color: "var(--host-fg-3)" }}>"</span>
            <span style={{ color: "var(--in-accent)" }}>[[InfraNodus]]</span>{" "}
            integrates with{" "}
            <span style={{ color: "var(--in-accent)" }}>[[Claude]]</span>{" "}
            via the{" "}
            <span style={{ color: "var(--in-accent)" }}>[[MCP]]</span>{" "}
            protocol to enable graph-based reasoning.
            <span style={{ color: "var(--host-fg-3)" }}>"</span>
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {[
            ["InfraNodus", "integrates with", "Claude"],
            ["InfraNodus", "uses", "MCP"],
            ["Claude", "consumes", "MCP"],
          ].map((tr, i) => (
            <div key={i} className="mono" style={{ fontSize: 11, padding: "4px 8px", background: "var(--host-bg-3)", border: "var(--line-2)", borderRadius: 3, cursor: "pointer", transition: "background 140ms" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in oklch, var(--c-lime) 18%, var(--host-bg-3))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--host-bg-3)"; }}
            >
              <span style={{ color: "var(--c-orange)" }}>{tr[0]}</span>{" "}
              <span className="dim2">{tr[1]}</span>{" "}
              <span style={{ color: "var(--c-cyan)" }}>{tr[2]}</span>
            </div>
          ))}
        </div>
        <div className="mono dim2" style={{ fontSize: 10.5, marginTop: 2 }}>↗ <span style={{ color: "var(--c-cyan)" }}>infranodus.com/g/{graphName}</span></div>
      </div>
    </ToolCard>
  );
}

// 6.2 memory_get_relations
function T_MemoryGet() {
  const tw = useToolsTweaks();
  const { status, t, runs, run } = useToolRun({ duration: 310 });
  const [entity, setEntity] = tcUseState("[[InfraNodus]]");
  const [graphName, setGraphName] = tcUseState("my-memories");
  return (
    <ToolCard name="memory_get_relations" group="Memory" t={t} status={status} onRun={run} accent="var(--c-orange)">
      <Section>
        <ArgRow k="entity" v={entity} c="var(--in-accent)" onChange={setEntity} />
        <ArgRow k="graphName" v={graphName} c="var(--c-cyan)" onChange={setGraphName} />
      </Section>
      <PreviewHeader label="ego network · 1-hop" badge="6 relations" />
      <div style={{ flex: 1, position: "relative", minHeight: 0, opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        <ForceGraph seed={23 + runs} density={tw.density} variant="topology" showLabels="all" showHulls={false} showSpecular={tw.showSpecular} />
      </div>
    </ToolCard>
  );
}

// ============================================================
// 7. SEARCH — search & fetch
// ============================================================

// 7.1 search
function T_Search() {
  const { status, t, run } = useToolRun({ duration: 280 });
  const [query, setQuery] = tcUseState("knowledge graph");
  const [scope, setScope] = tcUseState("own");
  const [selected, setSelected] = tcUseState(null);
  const all = [
    { name: "research-notes-2026", n: 142, c: 5, snip: "…discourse bridges knowledge graphs and language models…" },
    { name: "manuscript-draft-v4", n: 612, c: 8, snip: "…network analysis reveals structural gaps in the…" },
    { name: "podcast-transcripts/q1", n: 891, c: 12, snip: "…force-directed visualisation makes the topology…" },
    { name: "customer-interviews", n: 744, c: 11, snip: "…users describe knowledge work as graph-shaped…" },
    { name: "competitor-scan", n: 208, c: 6, snip: "…graphRAG patterns dominate the production cohort…" },
  ];
  const results = all.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()) || r.snip.toLowerCase().includes(query.toLowerCase()));
  return (
    <ToolCard name="search" group="Search" t={t} status={status} onRun={run} accent="var(--c-cyan)">
      <Section>
        <ArgRow k="query" v={query} c="var(--c-orange)" onChange={setQuery} />
        <ArgRow k="scope" v={scope} onChange={setScope} options={["own", "public", "all"]} />
      </Section>
      <PreviewHeader label="matching graphs" badge={`${results.length} of ${all.length} · live filter`} />
      <div style={{ padding: "8px 16px 14px", display: "flex", flexDirection: "column", gap: 4, flex: 1, overflow: "auto", opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        {results.length === 0 && (
          <div className="mono dim2" style={{ fontSize: 12, padding: "20px 8px", textAlign: "center" }}>
            no graphs match “{query}”
          </div>
        )}
        {results.map((r, i) => {
          const isSel = selected === r.name;
          return (
            <div key={i}
              onClick={() => setSelected(isSel ? null : r.name)}
              style={{
                padding: "8px 8px", borderBottom: i < results.length - 1 ? "var(--line-2)" : "none",
                background: isSel ? "color-mix(in oklch, var(--c-cyan) 14%, transparent)" : "transparent",
                borderLeft: "2px solid " + (isSel ? "var(--c-cyan)" : "transparent"),
                cursor: "pointer", transition: "all 140ms",
              }}
            >
              <div className="row" style={{ marginBottom: 3 }}>
                <span className="mono" style={{ fontSize: 12.5, color: "var(--host-fg)", flex: 1 }}>{r.name}</span>
                <span className="mono dim2" style={{ fontSize: 10.5 }}>{r.n}n · {r.c}c</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--host-fg-2)", lineHeight: 1.5, fontStyle: "italic" }}>{r.snip}</div>
            </div>
          );
        })}
      </div>
    </ToolCard>
  );
}

// 7.2 fetch
function T_Fetch() {
  const tw = useToolsTweaks();
  const { status, t, runs, run } = useToolRun({ duration: 440 });
  const [id, setId] = tcUseState("research-notes-2026");
  const [format, setFormat] = tcUseState("statements");
  return (
    <ToolCard name="fetch" group="Search · Deep Research" t={t} status={status} onRun={run} accent="var(--c-violet)">
      <Section>
        <ArgRow k="id" v={id} c="var(--c-cyan)" onChange={setId}
          options={["research-notes-2026", "manuscript-draft-v4", "competitor-scan"]} />
        <ArgRow k="format" v={format} onChange={setFormat} options={["statements", "graph", "summary", "all"]} />
      </Section>
      <PreviewHeader label="full result · ChatGPT DR-compatible" badge="142 statements" />
      <div style={{ padding: "12px 16px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8, overflow: "auto", opacity: status === "run" ? 0.5 : 1, transition: "opacity 220ms" }}>
        <div style={{ aspectRatio: "16/8", border: "var(--line-2)", borderRadius: 4, overflow: "hidden", flex: "0 0 auto" }}>
          <ForceGraph seed={7 + runs} density={tw.density} variant="topology" showLabels={tw.labels} showHulls showSpecular={tw.showSpecular} />
        </div>
        <div style={{ padding: "8px 10px", background: "var(--host-bg-3)", border: "var(--line-2)", borderRadius: 4 }}>
          <div className="mono dim2" style={{ fontSize: 10, marginBottom: 4 }}>STATEMENTS · sample</div>
          <div style={{ fontSize: 11.5, color: "var(--host-fg-2)", lineHeight: 1.5 }}>
            <span className="mono dim2">#s14</span> Embedding sits at the structural center of the corpus.<br/>
            <span className="mono dim2">#s27</span> Ontology rarely bridges into discourse — a measurable gap.<br/>
            <span className="mono dim2">#s31</span> Modularity dropped 0.04 after the August revisions.
          </div>
        </div>
      </div>
    </ToolCard>
  );
}

Object.assign(window, {
  ToolsTweaksContext,
  T_GenerateKnowledgeGraph, T_AnalyzeExistingGraph, T_CreateKnowledgeGraph, T_RetrieveFromKB, T_DevelopText,
  T_ContentGaps, T_TopicalClusters, T_ContextualHint, T_ConceptualBridges, T_LatentTopics,
  T_ResearchQuestions, T_ResearchIdeas, T_ResearchQuestionsFromGraph, T_ResponsesFromGraph,
  T_Overlap, T_Difference,
  T_GoogleResults, T_RelatedQueries, T_QueriesVsResults, T_SEOReport,
  T_MemoryAdd, T_MemoryGet,
  T_Search, T_Fetch,
});

// ============================================================
// Direction A — "Topology"
// Dev-tool aesthetic. Dense panels, mono headers, single accent.
// ============================================================

// ---------- 1. Graph Canvas (main view) ----------------------
function TopologyCanvas({ tweaks }) {
  const dens = tweaks?.density || "balanced";
  const labels = tweaks?.labels || "hubs";
  return (
    <div className="in-app dir-topology" style={{ gridTemplate: "auto 1fr auto / 1fr 320px" }}>
      <AppBar variant="topology" />
      {/* sidebar spans rows 2..3 */}
      <aside style={{ gridColumn: "2", gridRow: "2 / span 2", borderLeft: "var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="panel-h" style={{ borderRight: "0", borderTop: "0" }}>
          <span><strong>insights</strong> · 5 clusters</span>
          <span className="mono">▾</span>
        </div>
        <div style={{ padding: "12px 14px", overflow: "auto", flex: 1 }}>
          <ClusterList highlighted={0} />
          <div className="divider-h"></div>
          <SectionLabel>structural gaps</SectionLabel>
          <GapList />
          <div className="divider-h"></div>
          <SectionLabel>ai summary</SectionLabel>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--host-fg-2)", margin: "6px 0 0" }}>
            Text bridges <em style={{ color: "var(--in-accent)", fontStyle: "normal" }}>knowledge graphs</em> with <em style={{ color: "var(--c-cyan)", fontStyle: "normal" }}>language models</em>. The <em style={{ color: "var(--c-magenta)", fontStyle: "normal" }}>gaps</em> cluster is small but pivotal — connecting it to discourse would close the loop.
          </p>
        </div>
      </aside>

      {/* graph */}
      <main style={{ gridColumn: "1", gridRow: "2", position: "relative", overflow: "hidden", background: "var(--host-bg)" }}>
        <FloatingControls variant="topology" />
        <ForceGraph seed={7} density={dens} variant="topology" showLabels={labels} showAxis />
        <CanvasMeta />
      </main>

      {/* query bar bottom */}
      <footer style={{ gridColumn: "1", gridRow: "3", borderTop: "var(--line)", padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", background: "var(--host-bg)" }}>
        <span className="pill mono"><span className="dot"></span>graph://current</span>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--host-bg-2)", border: "var(--line)", borderRadius: 6, padding: "6px 10px" }}>
          <span className="mono" style={{ color: "var(--in-accent)" }}>›</span>
          <input
            defaultValue="show concepts bridging knowledge graphs and language models"
            style={{ flex: 1, background: "transparent", border: 0, outline: 0, color: "var(--host-fg)", fontFamily: "var(--font-ui)", fontSize: 13 }}
            readOnly
          />
          <span className="kbd">⌘ ↵</span>
        </div>
        <button className="btn primary">Run</button>
      </footer>
    </div>
  );
}

// ---------- 2. Query Compiler --------------------------------
function TopologyQuery() {
  return (
    <div className="in-app dir-topology" style={{ gridTemplate: "auto 1fr / 1fr" }}>
      <AppBar variant="topology" crumbs={["graph://current", "query"]} />
      <div style={{ padding: 18, display: "grid", gridTemplate: "auto 1fr / 1fr 1fr", gap: 14, minHeight: 0 }}>
        {/* NL input */}
        <section className="panel" style={{ gridColumn: "1 / span 2" }}>
          <div className="panel-h"><strong>natural language</strong><span className="mono dim2">↑ history</span></div>
          <div style={{ padding: "14px 16px" }}>
            <div className="mono" style={{ fontSize: 15, color: "var(--host-fg)", lineHeight: 1.5 }}>
              <span style={{ color: "var(--in-accent)" }}>›</span> what concepts bridge <em style={{ color: "var(--c-orange)", fontStyle: "normal" }}>knowledge graphs</em> and <em style={{ color: "var(--c-cyan)", fontStyle: "normal" }}>language models</em>, ranked by betweenness, top 6
            </div>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <span className="pill"><span className="dot" style={{ background: "var(--c-cyan)" }}></span>compiled</span>
              <span className="pill">0.34s</span>
              <span className="pill">12 ops</span>
              <span style={{ flex: 1 }}></span>
              <button className="btn ghost">Edit</button>
              <button className="btn primary">Apply</button>
            </div>
          </div>
        </section>

        {/* compiled tool calls */}
        <section className="panel" style={{ minHeight: 0 }}>
          <div className="panel-h"><strong>tool calls</strong><span className="mono dim2">mcp/infranodus</span></div>
          <div className="panel-body" style={{ gap: 10, display: "flex", flexDirection: "column" }}>
            <ToolCall name="infranodus.findBridges" args={{ a: "knowledge graphs", b: "language models", metric: "betweenness", top: 6 }} status="ok" t="180ms" />
            <ToolCall name="infranodus.expandConcept" args={{ id: "embedding", hop: 2 }} status="ok" t="92ms" />
            <ToolCall name="infranodus.summarizeCluster" args={{ cluster: "discourse" }} status="run" t="…" />
          </div>
        </section>

        {/* result preview */}
        <section className="panel" style={{ minHeight: 0 }}>
          <div className="panel-h"><strong>result</strong><span className="mono dim2">structuredContent</span></div>
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ aspectRatio: "10/7", background: "var(--host-bg-3)", border: "var(--line-2)", borderRadius: 4, overflow: "hidden" }}>
              <ForceGraph seed={3} density="sparse" variant="topology" showLabels="hubs" showHulls={false} focus="1-0" />
            </div>
            <div className="code">
{`{`}{"\n"}
  <span className="k">"bridges"</span>: [{"\n"}
    {"  "}<span className="s">"embedding"</span>,{"\n"}
    {"  "}<span className="s">"ontology"</span>,{"\n"}
    {"  "}<span className="s">"context"</span>,{"\n"}
    {"  "}<span className="s">"vertex"</span>{"\n"}
  ],{"\n"}
  <span className="k">"score_range"</span>: [<span className="n">0.41</span>, <span className="n">0.78</span>]{"\n"}
{`}`}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------- 3. Insights / Gaps -------------------------------
function TopologyInsights() {
  return (
    <div className="in-app dir-topology" style={{ gridTemplate: "auto 1fr / 1fr" }}>
      <AppBar variant="topology" crumbs={["graph://current", "insights"]} />
      <div style={{ padding: 18, overflow: "auto" }}>
        <div className="row" style={{ gap: 10, marginBottom: 14 }}>
          <Stat n="142" l="nodes" />
          <Stat n="318" l="edges" />
          <Stat n="5" l="clusters" />
          <Stat n="0.42" l="modularity" />
          <Stat n="4" l="bridges" />
          <Stat n="9" l="gaps" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
          <section className="panel">
            <div className="panel-h"><strong>top topics</strong><span className="mono dim2">by pagerank</span></div>
            <div className="panel-body" style={{ gap: 8, display: "flex", flexDirection: "column" }}>
              <TopicRow rank={1} label="knowledge graph" color="var(--c-orange)" v={0.92} />
              <TopicRow rank={2} label="language model" color="var(--c-cyan)" v={0.81} />
              <TopicRow rank={3} label="discourse" color="var(--c-violet)" v={0.66} />
              <TopicRow rank={4} label="centrality" color="var(--c-lime)" v={0.55} />
              <TopicRow rank={5} label="bridge" color="var(--c-magenta)" v={0.41} />
              <TopicRow rank={6} label="embedding" color="var(--c-cyan)" v={0.38} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-h"><strong>structural gaps</strong><span className="mono dim2">bridge opportunities</span></div>
            <div className="panel-body" style={{ gap: 10, display: "flex", flexDirection: "column" }}>
              <GapCard a="discourse" b="network science" rationale="No node connects rhetorical framing to centrality measures. Bridging concept: 'narrative betweenness'." />
              <GapCard a="language model" b="gaps" rationale="LLM context window discussed but never linked to the blind-spot cluster. Try: 'attention coverage'." />
              <GapCard a="ontology" b="discourse" rationale="Structural concepts not yet narrativized." />
            </div>
          </section>
        </div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <section className="panel">
            <div className="panel-h"><strong>ai summary</strong><span className="mono dim2">claude-sonnet</span></div>
            <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--host-fg-2)" }}>
              The corpus organizes around three loose communities: <span style={{ color: "var(--c-orange)" }}>knowledge representation</span>, <span style={{ color: "var(--c-cyan)" }}>language modeling</span>, and <span style={{ color: "var(--c-violet)" }}>discourse</span>. Bridging is asymmetric — most cross-cluster paths route through "embedding" and "ontology".
            </div>
          </section>
          <section className="panel">
            <div className="panel-h"><strong>graph diagnostics</strong><span className="mono dim2">gds</span></div>
            <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Diag k="density" v="0.031" />
              <Diag k="avg degree" v="4.48" />
              <Diag k="diameter" v="6" />
              <Diag k="clustering coeff" v="0.27" />
              <Diag k="components" v="1" />
              <Diag k="entropy" v="2.91" />
            </div>
          </section>
          <section className="panel">
            <div className="panel-h"><strong>follow-ups</strong><span className="mono dim2">suggested queries</span></div>
            <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SuggRow q="explain why 'embedding' is the top bridge" />
              <SuggRow q="generate questions about the 'gaps' cluster" />
              <SuggRow q="diff this graph against last week" />
              <SuggRow q="what's missing from discourse?" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------- 4. Resource Browser ------------------------------
function TopologyResources() {
  return (
    <div className="in-app dir-topology" style={{ gridTemplate: "auto 1fr / 1fr" }}>
      <AppBar variant="topology" crumbs={["resources"]} />
      <div style={{ padding: 18, overflow: "auto" }}>
        <div className="row" style={{ marginBottom: 14, gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--host-bg-2)", border: "var(--line)", borderRadius: 6, padding: "7px 10px" }}>
            <span className="mono dim2">⌕</span>
            <input placeholder="filter graphs — name, tag, concept…" style={{ flex: 1, background: "transparent", border: 0, outline: 0, color: "var(--host-fg)", font: "inherit" }} />
            <span className="kbd">⌘ K</span>
          </div>
          <button className="btn">＋ New graph</button>
          <button className="btn primary">Import</button>
        </div>

        <div className="panel-h" style={{ padding: "8px 0", borderBottom: "var(--line-2)", marginBottom: 6, display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 110px 90px" }}>
          <span>name</span><span>nodes</span><span>edges</span><span>clusters</span><span>updated</span><span></span>
        </div>
        <ResRow name="research-notes-2026" n="142" e="318" c="5" d="2h ago" pre={7} />
        <ResRow name="podcast-transcripts/q1" n="891" e="2,103" c="12" d="yesterday" pre={11} />
        <ResRow name="chat://claude-sessions" n="56" e="98" c="3" d="3d ago" pre={3} />
        <ResRow name="manuscript-draft-v4" n="612" e="1,840" c="8" d="last week" pre={5} />
        <ResRow name="competitor-scan" n="208" e="412" c="6" d="aug 04" pre={13} />
        <ResRow name="customer-interviews" n="744" e="2,901" c="11" d="aug 02" pre={2} />
      </div>
    </div>
  );
}

// ---------- 5. Onboarding ------------------------------------
function TopologyOnboarding() {
  return (
    <div className="in-app dir-topology" style={{ gridTemplate: "1fr / 1fr", placeItems: "center", background: "var(--host-bg)" }}>
      {/* faint background graph */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.18, pointerEvents: "none" }}>
        <ForceGraph seed={21} density="sparse" variant="topology" showLabels="none" showHulls={false} />
      </div>
      <div style={{ position: "relative", maxWidth: 560, padding: "0 32px", textAlign: "left", display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="appbar" style={{ padding: 0, border: 0, background: "transparent" }}>
            <div className="logo"></div>
          </div>
          <span className="mono" style={{ color: "var(--host-fg-3)", fontSize: 11, letterSpacing: "0.1em" }}>INFRANODUS · MCP APP</span>
        </div>
        <h1 style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 28, lineHeight: 1.15, letterSpacing: "-0.01em", margin: 0, color: "var(--host-fg)" }}>
          Turn any conversation<br/>into a <span style={{ color: "var(--in-accent)" }}>knowledge graph</span>.
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--host-fg-2)", margin: 0 }}>
          See the topics, gaps and bridges in what you read, write, or chat about — right inside your MCP host. Ask in natural language; we compile it to graph operations.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <Step n="1" t="Paste text, drop a file, or share a URL" />
          <Step n="2" t="Watch concepts cluster in real time" />
          <Step n="3" t="Query in plain English — get graph slices, gaps, summaries" />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn primary">Connect a source</button>
          <button className="btn">Try sample graph</button>
          <span style={{ flex: 1 }}></span>
          <span className="kbd">⌘ ↵ to start</span>
        </div>
      </div>
    </div>
  );
}

// ============= Subcomponents =================================
function AppBar({ variant, crumbs }) {
  return (
    <header className="appbar" style={{ gridColumn: "1 / -1" }}>
      <div className="logo"></div>
      <span className="title">infranodus</span>
      <span className="crumb">/</span>
      {(crumbs || ["graph://current"]).map((c, i) => (
        <React.Fragment key={i}>
          <span className="crumb">{c}</span>
          {i < (crumbs || ["graph://current"]).length - 1 && <span className="crumb">/</span>}
        </React.Fragment>
      ))}
      <span style={{ flex: 1 }}></span>
      <span className="pill mono"><span className="dot" style={{ background: "var(--ok)" }}></span>connected</span>
      <button className="btn ghost mono" style={{ padding: "5px 8px", fontSize: 11 }}>⤢ open</button>
    </header>
  );
}

function FloatingControls({ variant }) {
  return (
    <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 6, zIndex: 1 }}>
      <button className="btn mono" style={{ padding: "5px 8px", fontSize: 11 }}>＋</button>
      <button className="btn mono" style={{ padding: "5px 8px", fontSize: 11 }}>－</button>
      <button className="btn mono" style={{ padding: "5px 8px", fontSize: 11 }}>⌂</button>
      <button className="btn mono" style={{ padding: "5px 8px", fontSize: 11 }}>⤢ focus</button>
    </div>
  );
}

function CanvasMeta() {
  return (
    <div style={{ position: "absolute", bottom: 12, left: 14, display: "flex", gap: 6 }}>
      <span className="pill mono"><span className="dot" style={{ background: "var(--c-orange)" }}></span>knowledge graph · 7</span>
      <span className="pill mono"><span className="dot" style={{ background: "var(--c-cyan)" }}></span>language model · 6</span>
      <span className="pill mono"><span className="dot" style={{ background: "var(--c-violet)" }}></span>discourse · 6</span>
      <span className="pill mono"><span className="dot" style={{ background: "var(--c-lime)" }}></span>network sci · 4</span>
      <span className="pill mono"><span className="dot" style={{ background: "var(--c-magenta)" }}></span>gaps · 3</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--host-fg-3)", margin: "0 0 8px" }}>{children}</div>;
}

function ClusterList({ highlighted }) {
  const items = [
    { c: "var(--c-orange)", l: "knowledge graph", n: 7 },
    { c: "var(--c-cyan)", l: "language model", n: 6 },
    { c: "var(--c-violet)", l: "discourse", n: 6 },
    { c: "var(--c-lime)", l: "network sci", n: 4 },
    { c: "var(--c-magenta)", l: "gaps", n: 3 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <SectionLabel>clusters</SectionLabel>
      {items.map((it, i) => (
        <div key={i} className="row" style={{
          gap: 8, padding: "6px 8px",
          background: i === highlighted ? "var(--host-bg-3)" : "transparent",
          borderRadius: 4, border: i === highlighted ? "var(--line-2)" : "1px solid transparent",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: it.c }}></span>
          <span style={{ flex: 1, fontSize: 13 }}>{it.l}</span>
          <span className="mono dim2" style={{ fontSize: 11 }}>{it.n}</span>
        </div>
      ))}
    </div>
  );
}

function GapList() {
  const gaps = [
    { a: "discourse", b: "network sci", strength: 0.78 },
    { a: "lang model", b: "gaps", strength: 0.62 },
    { a: "ontology", b: "discourse", strength: 0.41 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {gaps.map((g, i) => (
        <div key={i} style={{
          padding: "8px 10px", border: "var(--line-2)", borderRadius: 4,
          background: "var(--host-bg-3)",
        }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--host-fg-2)", display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: "var(--c-orange)" }}>{g.a}</span>
            <span className="dim2">⟶</span>
            <span style={{ color: "var(--c-cyan)" }}>{g.b}</span>
            <span style={{ flex: 1 }}></span>
            <span className="dim2">{g.strength}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ToolCall({ name, args, status, t }) {
  const statusColor = status === "ok" ? "var(--ok)" : status === "run" ? "var(--warn)" : "var(--err)";
  return (
    <div style={{ border: "var(--line-2)", borderRadius: 4, background: "var(--host-bg-3)", padding: "10px 12px" }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 2, background: statusColor }}></span>
        <span className="mono" style={{ fontSize: 12, color: "var(--host-fg)" }}>{name}</span>
        <span style={{ flex: 1 }}></span>
        <span className="mono dim2" style={{ fontSize: 11 }}>{t}</span>
      </div>
      <div className="mono" style={{ fontSize: 11.5, color: "var(--host-fg-2)", lineHeight: 1.55 }}>
        {Object.entries(args).map(([k, v]) => (
          <div key={k}>
            <span className="dim2">{k}:</span> <span style={{ color: typeof v === "number" ? "var(--c-cyan)" : "var(--c-lime)" }}>{JSON.stringify(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ n, l }) {
  return <div className="stat" style={{ flex: 1 }}><span className="num">{n}</span><span className="lab">{l}</span></div>;
}

function TopicRow({ rank, label, color, v }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <span className="mono dim2" style={{ fontSize: 11, width: 18 }}>{String(rank).padStart(2, "0")}</span>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }}></span>
      <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
      <span style={{ width: 140, height: 4, background: "var(--host-bg-3)", borderRadius: 2, overflow: "hidden" }}>
        <span style={{ display: "block", width: `${v * 100}%`, height: "100%", background: color }}></span>
      </span>
      <span className="mono dim2" style={{ fontSize: 11, width: 36, textAlign: "right" }}>{v.toFixed(2)}</span>
    </div>
  );
}

function GapCard({ a, b, rationale }) {
  return (
    <div style={{ padding: "10px 12px", border: "var(--line-2)", borderRadius: 4, background: "var(--host-bg-3)" }}>
      <div className="mono row" style={{ fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: "var(--c-orange)" }}>{a}</span>
        <span className="dim2">⟶</span>
        <span style={{ color: "var(--c-cyan)" }}>{b}</span>
        <span style={{ flex: 1 }}></span>
        <button className="btn ghost mono" style={{ padding: "2px 6px", fontSize: 11 }}>bridge</button>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--host-fg-2)", lineHeight: 1.55 }}>{rationale}</div>
    </div>
  );
}

function Diag({ k, v }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", padding: "4px 0", borderBottom: "var(--line-2)" }}>
      <span className="mono dim2" style={{ fontSize: 12 }}>{k}</span>
      <span className="mono" style={{ fontSize: 13, color: "var(--host-fg)" }}>{v}</span>
    </div>
  );
}

function SuggRow({ q }) {
  return (
    <div className="row mono" style={{ fontSize: 12.5, padding: "8px 10px", border: "var(--line-2)", borderRadius: 4, background: "var(--host-bg-3)" }}>
      <span style={{ color: "var(--in-accent)" }}>›</span>
      <span style={{ flex: 1, color: "var(--host-fg-2)" }}>{q}</span>
      <span className="dim2">↵</span>
    </div>
  );
}

function ResRow({ name, n, e, c, d, pre }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 110px 90px",
      alignItems: "center", padding: "10px 0",
      borderBottom: "var(--line-2)",
    }}>
      <div className="row" style={{ gap: 10 }}>
        <div style={{ width: 38, height: 28, border: "var(--line-2)", borderRadius: 3, overflow: "hidden", background: "var(--host-bg-3)" }}>
          <MiniGraph seed={pre} variant="topology" />
        </div>
        <span className="mono" style={{ fontSize: 13 }}>{name}</span>
      </div>
      <span className="mono dim" style={{ fontSize: 12 }}>{n}</span>
      <span className="mono dim" style={{ fontSize: 12 }}>{e}</span>
      <span className="mono dim" style={{ fontSize: 12 }}>{c}</span>
      <span className="mono dim2" style={{ fontSize: 12 }}>{d}</span>
      <div style={{ textAlign: "right" }}>
        <button className="btn ghost mono" style={{ padding: "3px 8px", fontSize: 11 }}>open</button>
      </div>
    </div>
  );
}

function Step({ n, t }) {
  return (
    <div className="row" style={{ gap: 12 }}>
      <span className="mono" style={{ fontSize: 11, color: "var(--in-accent)", width: 18 }}>0{n}</span>
      <span style={{ fontSize: 14, color: "var(--host-fg)" }}>{t}</span>
    </div>
  );
}

Object.assign(window, {
  TopologyCanvas, TopologyQuery, TopologyInsights, TopologyResources, TopologyOnboarding,
});

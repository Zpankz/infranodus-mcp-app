// ============================================================
// Direction B — "Atlas"
// Graph-first, airy, soft glow, larger labels, multi-cluster.
// ============================================================

// ---------- 1. Graph Canvas ----------------------------------
function AtlasCanvas({ tweaks }) {
  const dens = tweaks?.density || "balanced";
  const labels = tweaks?.labels || "hubs";
  return (
    <div className="in-app dir-atlas" style={{ position: "relative", gridTemplate: "1fr / 1fr" }}>
      {/* full-bleed graph */}
      <div style={{ position: "absolute", inset: 0 }}>
        <ForceGraph seed={9} density={dens} variant="atlas" showLabels={labels} />
      </div>

      {/* radial vignette */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(circle at 50% 50%, transparent 30%, var(--host-bg) 95%)",
      }}></div>

      {/* floating top bar (atlas — borderless, transparent) */}
      <header style={{
        position: "absolute", top: 16, left: 16, right: 16, zIndex: 2,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div className="row" style={{
          gap: 10, padding: "8px 14px",
          background: "color-mix(in oklch, var(--host-bg) 88%, transparent)",
          backdropFilter: "blur(10px)",
          border: "var(--line-2)", borderRadius: 999,
        }}>
          <div className="logo" style={{ width: 18, height: 18 }}></div>
          <span style={{ fontSize: 13, color: "var(--host-fg)" }}>research-notes-2026</span>
          <span className="mono dim2" style={{ fontSize: 11 }}>· 142 nodes</span>
        </div>
        <span style={{ flex: 1 }}></span>
        <button className="btn" style={{ borderRadius: 999, padding: "7px 14px" }}>↻ refresh</button>
        <button className="btn primary" style={{ borderRadius: 999, padding: "7px 14px" }}>＋ source</button>
      </header>

      {/* floating cluster legend (bottom left) */}
      <div style={{
        position: "absolute", bottom: 18, left: 18, zIndex: 2,
        display: "flex", flexDirection: "column", gap: 6,
        padding: "12px 14px",
        background: "color-mix(in oklch, var(--host-bg) 80%, transparent)",
        backdropFilter: "blur(10px)",
        border: "var(--line-2)", borderRadius: 14, minWidth: 220,
      }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--host-fg-3)", marginBottom: 4 }}>clusters</div>
        {[
          { c: "var(--c-orange)", l: "knowledge graph", n: 7 },
          { c: "var(--c-cyan)", l: "language model", n: 6 },
          { c: "var(--c-violet)", l: "discourse", n: 6 },
          { c: "var(--c-lime)", l: "network science", n: 4 },
          { c: "var(--c-magenta)", l: "gaps", n: 3 },
        ].map((it, i) => (
          <div key={i} className="row" style={{ gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: it.c, boxShadow: `0 0 12px ${it.c}` }}></span>
            <span style={{ fontSize: 13, flex: 1 }}>{it.l}</span>
            <span className="mono dim2" style={{ fontSize: 11 }}>{it.n}</span>
          </div>
        ))}
      </div>

      {/* AI tooltip card (right side) */}
      <div style={{
        position: "absolute", top: 90, right: 18, zIndex: 2,
        width: 300,
        padding: "16px 18px",
        background: "color-mix(in oklch, var(--host-bg) 88%, transparent)",
        backdropFilter: "blur(14px)",
        border: "var(--line-2)", borderRadius: 16,
      }}>
        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-orange)" }}></span>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--host-fg-3)" }}>ai · focus on knowledge graph</span>
        </div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--host-fg)", lineHeight: 1.35 }}>
          The corpus is anchored by graph structure.
        </h3>
        <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--host-fg-2)" }}>
          7 concepts cluster here, with <em style={{ fontStyle: "normal", color: "var(--in-accent)" }}>ontology</em> and <em style={{ fontStyle: "normal", color: "var(--in-accent)" }}>embedding</em> as the main bridges to language modeling.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <Metric k="pagerank" v="0.92" />
          <Metric k="bridges" v="3" />
          <Metric k="degree" v="11" />
          <Metric k="density" v="0.41" />
        </div>
        <div className="row" style={{ marginTop: 12, gap: 6 }}>
          <button className="btn ghost" style={{ flex: 1, justifyContent: "center", borderRadius: 10 }}>Expand</button>
          <button className="btn primary" style={{ flex: 1, justifyContent: "center", borderRadius: 10 }}>Ask</button>
        </div>
      </div>

      {/* bottom NL query — pill */}
      <div style={{
        position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
        zIndex: 2, width: "min(560px, 60%)",
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px 10px 16px",
        background: "color-mix(in oklch, var(--host-bg) 85%, transparent)",
        backdropFilter: "blur(14px)",
        border: "1px solid var(--in-accent-line)", borderRadius: 999,
        boxShadow: "var(--shadow-2)",
      }}>
        <span className="mono" style={{ color: "var(--in-accent)", fontSize: 14 }}>›</span>
        <input
          defaultValue="ask the graph anything…"
          style={{ flex: 1, background: "transparent", border: 0, outline: 0, color: "var(--host-fg-3)", font: "inherit", fontSize: 14 }}
          readOnly
        />
        <span className="kbd" style={{ borderRadius: 999 }}>⌘ ↵</span>
      </div>
    </div>
  );
}

function Metric({ k, v }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 10, background: "var(--host-bg-3)", border: "var(--line-2)" }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--host-fg-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
      <div className="mono" style={{ fontSize: 16, color: "var(--host-fg)", marginTop: 2 }}>{v}</div>
    </div>
  );
}

// ---------- 2. Query Compiler --------------------------------
function AtlasQuery() {
  return (
    <div className="in-app dir-atlas" style={{ gridTemplate: "1fr / 1fr", padding: 32, position: "relative" }}>
      {/* ambient blurred graph */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.45, filter: "blur(1.5px)" }}>
        <ForceGraph seed={4} density="sparse" variant="atlas" showLabels="none" />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 30%, transparent 0%, var(--host-bg) 70%)" }}></div>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16, maxWidth: 920, width: "100%", margin: "0 auto", alignSelf: "center" }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--host-fg-3)" }}>compose query</span>
          <span style={{ flex: 1 }}></span>
          <span className="pill mono"><span className="dot" style={{ background: "var(--ok)" }}></span>compiled in 0.34s</span>
        </div>

        <div style={{
          padding: "20px 22px",
          background: "color-mix(in oklch, var(--host-bg-2) 80%, transparent)",
          backdropFilter: "blur(12px)",
          border: "1px solid var(--in-accent-line)",
          borderRadius: 18,
          boxShadow: "var(--shadow-2)",
        }}>
          <div style={{ fontSize: 22, lineHeight: 1.45, color: "var(--host-fg)", fontWeight: 500 }}>
            What concepts <span style={{ background: "var(--in-accent-soft)", color: "var(--in-accent)", padding: "0 6px", borderRadius: 6 }}>bridge</span>{" "}
            <span style={{ background: "color-mix(in oklch, var(--c-orange) 20%, transparent)", color: "var(--c-orange)", padding: "0 6px", borderRadius: 6 }}>knowledge graphs</span>{" "}
            and <span style={{ background: "color-mix(in oklch, var(--c-cyan) 20%, transparent)", color: "var(--c-cyan)", padding: "0 6px", borderRadius: 6 }}>language models</span>,{" "}
            ranked by <span className="mono" style={{ fontSize: 19, color: "var(--c-lime)" }}>betweenness</span>, top <span className="mono" style={{ fontSize: 19 }}>6</span>?
          </div>
          <div className="row" style={{ marginTop: 16, gap: 8 }}>
            <span className="pill"><span className="dot" style={{ background: "var(--c-orange)" }}></span>scope: cluster</span>
            <span className="pill"><span className="dot" style={{ background: "var(--c-cyan)" }}></span>scope: cluster</span>
            <span className="pill"><span className="dot" style={{ background: "var(--c-lime)" }}></span>metric: betweenness</span>
            <span className="pill">limit: 6</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ padding: 18, background: "var(--host-bg-2)", border: "var(--line-2)", borderRadius: 16 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--host-fg-3)", marginBottom: 12 }}>compiled to</div>
            <CallChip name="findBridges" args="a, b, betweenness, 6" ok />
            <div style={{ height: 6 }}></div>
            <CallChip name="expandConcept" args="embedding, hop=2" ok />
            <div style={{ height: 6 }}></div>
            <CallChip name="summarizeCluster" args="discourse" run />
          </div>
          <div style={{ padding: 18, background: "var(--host-bg-2)", border: "var(--line-2)", borderRadius: 16 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--host-fg-3)", marginBottom: 12 }}>top bridges</div>
            <BridgeRow label="embedding" cluster="lang" v={0.78} c="var(--c-cyan)" />
            <BridgeRow label="ontology" cluster="kg" v={0.71} c="var(--c-orange)" />
            <BridgeRow label="context" cluster="lang" v={0.62} c="var(--c-cyan)" />
            <BridgeRow label="vertex" cluster="kg" v={0.54} c="var(--c-orange)" />
            <BridgeRow label="prompt" cluster="lang" v={0.48} c="var(--c-cyan)" />
            <BridgeRow label="concept" cluster="kg" v={0.41} c="var(--c-orange)" />
          </div>
        </div>

        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <button className="btn ghost" style={{ borderRadius: 999 }}>Edit prompt</button>
          <button className="btn" style={{ borderRadius: 999 }}>Save as recipe</button>
          <span style={{ flex: 1 }}></span>
          <button className="btn primary" style={{ borderRadius: 999, padding: "9px 18px" }}>Apply to graph</button>
        </div>
      </div>
    </div>
  );
}

function CallChip({ name, args, ok, run }) {
  const c = ok ? "var(--ok)" : run ? "var(--warn)" : "var(--err)";
  return (
    <div className="row" style={{
      padding: "10px 12px", borderRadius: 12,
      background: "var(--host-bg-3)", border: "var(--line-2)",
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}` }}></span>
      <span className="mono" style={{ fontSize: 13, color: "var(--host-fg)" }}>{name}</span>
      <span className="mono dim2" style={{ fontSize: 12 }}>({args})</span>
      <span style={{ flex: 1 }}></span>
      <span className="mono dim2" style={{ fontSize: 11 }}>{run ? "running" : "✓"}</span>
    </div>
  );
}

function BridgeRow({ label, cluster, v, c }) {
  return (
    <div className="row" style={{ padding: "8px 0", borderBottom: "var(--line-2)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}` }}></span>
      <span style={{ fontSize: 14, color: "var(--host-fg)", flex: 1, marginLeft: 10 }}>{label}</span>
      <span className="mono dim2" style={{ fontSize: 11, marginRight: 10 }}>{cluster}</span>
      <span className="mono" style={{ fontSize: 13, color: "var(--host-fg)" }}>{v.toFixed(2)}</span>
    </div>
  );
}

// ---------- 3. Insights / Gaps -------------------------------
function AtlasInsights() {
  return (
    <div className="in-app dir-atlas" style={{ gridTemplate: "1fr / 1fr", overflow: "auto" }}>
      <div style={{ padding: "28px 32px", maxWidth: 1120, margin: "0 auto", width: "100%" }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--host-fg-3)" }}>insights · research-notes-2026</span>
        </div>
        <h1 style={{ margin: "4px 0 24px", fontSize: 32, fontWeight: 600, color: "var(--host-fg)", letterSpacing: "-0.01em" }}>
          Three communities. One bridge to grow.
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            ["142", "nodes"], ["318", "edges"], ["5", "clusters"],
            ["0.42", "modularity"], ["4", "bridges"], ["9", "gaps"],
          ].map(([n, l]) => (
            <div key={l} style={{ padding: "14px 16px", background: "var(--host-bg-2)", borderRadius: 14, border: "var(--line-2)" }}>
              <div className="mono" style={{ fontSize: 24, color: "var(--host-fg)" }}>{n}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--host-fg-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* AI summary card */}
          <div style={{ padding: "20px 22px", borderRadius: 16, background: "var(--host-bg-2)", border: "var(--line-2)" }}>
            <div className="row" style={{ marginBottom: 10, gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--in-accent-soft)", border: "1px solid var(--in-accent-line)", display: "grid", placeItems: "center" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--in-accent)" }}>✦</span>
              </div>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--host-fg-3)" }}>ai summary</span>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--host-fg)" }}>
              Your notes orbit <em style={{ fontStyle: "normal", color: "var(--c-orange)" }}>knowledge representation</em>,
              {" "}<em style={{ fontStyle: "normal", color: "var(--c-cyan)" }}>language modeling</em>, and
              {" "}<em style={{ fontStyle: "normal", color: "var(--c-violet)" }}>discourse</em>. Most cross-cluster paths route
              through <em style={{ fontStyle: "normal", color: "var(--in-accent)" }}>embedding</em> and
              {" "}<em style={{ fontStyle: "normal", color: "var(--in-accent)" }}>ontology</em>. Discourse and network science
              remain unconnected — a real opportunity.
            </p>
          </div>
          {/* mini graph */}
          <div style={{ padding: 0, borderRadius: 16, background: "var(--host-bg-2)", border: "var(--line-2)", overflow: "hidden", minHeight: 240, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0 }}>
              <ForceGraph seed={9} density="balanced" variant="atlas" showLabels="hubs" />
            </div>
            <div style={{ position: "absolute", top: 12, left: 14, display: "flex", gap: 6 }}>
              <span className="pill">live</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
          <div style={{ padding: "20px 22px", borderRadius: 16, background: "var(--host-bg-2)", border: "var(--line-2)" }}>
            <div className="row" style={{ marginBottom: 14 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--host-fg-3)" }}>structural gaps</span>
              <span style={{ flex: 1 }}></span>
              <span className="mono dim2" style={{ fontSize: 11 }}>9 found</span>
            </div>
            <AtlasGapCard a="discourse" b="network science" rationale="No node yet connects rhetorical framing to centrality measures. Suggested bridge: narrative betweenness." />
            <div style={{ height: 10 }}></div>
            <AtlasGapCard a="language model" b="gaps" rationale="Context windows discussed without linking to attention blind spots. Bridge: attention coverage." />
            <div style={{ height: 10 }}></div>
            <AtlasGapCard a="ontology" b="discourse" rationale="Structural concepts not yet narrativized in your notes." />
          </div>

          <div style={{ padding: "20px 22px", borderRadius: 16, background: "var(--host-bg-2)", border: "var(--line-2)" }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--host-fg-3)", marginBottom: 14 }}>follow-ups</div>
            <Suggest q="explain why embedding is the top bridge" />
            <Suggest q="generate questions about the gaps cluster" />
            <Suggest q="diff this graph against last week" />
            <Suggest q="what's missing from discourse?" />
            <Suggest q="export bridges as a markdown outline" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AtlasGapCard({ a, b, rationale }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--host-bg-3)", border: "var(--line-2)" }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 12.5, color: "var(--host-fg)" }}>
          <span style={{ color: "var(--c-orange)" }}>{a}</span> <span className="dim2">⟶</span> <span style={{ color: "var(--c-cyan)" }}>{b}</span>
        </span>
        <span style={{ flex: 1 }}></span>
        <button className="btn ghost" style={{ borderRadius: 999, padding: "3px 10px", fontSize: 12 }}>Bridge</button>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--host-fg-2)" }}>{rationale}</p>
    </div>
  );
}

function Suggest({ q }) {
  return (
    <button style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
      padding: "12px 14px", borderRadius: 12,
      background: "var(--host-bg-3)", border: "var(--line-2)",
      color: "var(--host-fg-2)", font: "inherit", fontSize: 13.5,
      marginBottom: 8, cursor: "pointer",
    }}>
      <span className="mono" style={{ color: "var(--in-accent)" }}>›</span>
      <span style={{ flex: 1 }}>{q}</span>
      <span className="kbd">↵</span>
    </button>
  );
}

// ---------- 4. Resource Browser ------------------------------
function AtlasResources() {
  const items = [
    { name: "research-notes-2026", n: 142, c: 5, d: "2h ago", pre: 7, tone: "var(--c-orange)" },
    { name: "podcast-transcripts/q1", n: 891, c: 12, d: "yesterday", pre: 11, tone: "var(--c-cyan)" },
    { name: "chat://claude-sessions", n: 56, c: 3, d: "3d ago", pre: 3, tone: "var(--c-violet)" },
    { name: "manuscript-draft-v4", n: 612, c: 8, d: "last week", pre: 5, tone: "var(--c-lime)" },
    { name: "competitor-scan", n: 208, c: 6, d: "aug 04", pre: 13, tone: "var(--c-magenta)" },
    { name: "customer-interviews", n: 744, c: 11, d: "aug 02", pre: 2, tone: "var(--c-orange)" },
  ];
  return (
    <div className="in-app dir-atlas" style={{ gridTemplate: "1fr / 1fr", overflow: "auto" }}>
      <div style={{ padding: "28px 32px", maxWidth: 1120, margin: "0 auto", width: "100%" }}>
        <div className="row" style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: "var(--host-fg)", letterSpacing: "-0.01em" }}>Graphs</h1>
          <span style={{ flex: 1 }}></span>
          <button className="btn" style={{ borderRadius: 999 }}>Import</button>
          <button className="btn primary" style={{ borderRadius: 999 }}>＋ New graph</button>
        </div>

        <div className="row" style={{ marginBottom: 20, gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, background: "var(--host-bg-2)", border: "var(--line-2)" }}>
            <span className="mono dim2">⌕</span>
            <input placeholder="search graphs, tags, concepts…" style={{ flex: 1, background: "transparent", border: 0, outline: 0, color: "var(--host-fg)", font: "inherit", fontSize: 14 }} />
            <span className="kbd" style={{ borderRadius: 999 }}>⌘ K</span>
          </div>
          <button className="btn ghost" style={{ borderRadius: 999 }}>Recent</button>
          <button className="btn ghost" style={{ borderRadius: 999 }}>By size</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {items.map((it, i) => (
            <div key={i} style={{
              borderRadius: 16, background: "var(--host-bg-2)", border: "var(--line-2)",
              overflow: "hidden", display: "flex", flexDirection: "column",
            }}>
              <div style={{ aspectRatio: "5/3", background: "var(--host-bg-3)", position: "relative", overflow: "hidden" }}>
                <MiniGraph seed={it.pre} variant="atlas" />
                <div style={{
                  position: "absolute", inset: 0,
                  background: `radial-gradient(circle at 30% 40%, color-mix(in oklch, ${it.tone} 18%, transparent), transparent 60%)`,
                }}></div>
              </div>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 14.5, color: "var(--host-fg)", fontWeight: 500 }}>{it.name}</div>
                <div className="row mono dim2" style={{ fontSize: 11.5, marginTop: 6, gap: 10 }}>
                  <span>{it.n} nodes</span>
                  <span>·</span>
                  <span>{it.c} clusters</span>
                  <span style={{ flex: 1 }}></span>
                  <span>{it.d}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- 5. Onboarding ------------------------------------
function AtlasOnboarding() {
  return (
    <div className="in-app dir-atlas" style={{ gridTemplate: "1fr / 1fr", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.7 }}>
        <ForceGraph seed={31} density="balanced" variant="atlas" showLabels="hubs" />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 60%, transparent 0%, var(--host-bg) 78%)" }}></div>

      <div style={{
        position: "relative", margin: "auto",
        width: "min(580px, 90%)", padding: "32px 36px",
        background: "color-mix(in oklch, var(--host-bg) 80%, transparent)",
        backdropFilter: "blur(16px)",
        border: "var(--line-2)", borderRadius: 24,
        boxShadow: "var(--shadow-2)",
        display: "flex", flexDirection: "column", gap: 18,
      }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="logo" style={{ width: 28, height: 28, borderRadius: 8 }}></div>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--host-fg-3)", textTransform: "uppercase" }}>InfraNodus for MCP</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.15, color: "var(--host-fg)", fontWeight: 600, letterSpacing: "-0.015em" }}>
          See the shape of what you're thinking.
        </h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--host-fg-2)" }}>
          Turn any text — notes, chats, articles — into an interactive knowledge graph. Find topics, gaps, and bridges. Ask in plain English.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
          <ChoiceCard tone="var(--c-orange)" title="Paste text" sub="quick start" />
          <ChoiceCard tone="var(--c-cyan)" title="Connect a source" sub="docs, files, urls" />
          <ChoiceCard tone="var(--c-violet)" title="Open recent" sub="6 graphs" />
          <ChoiceCard tone="var(--c-lime)" title="Sample graph" sub="explore demo" />
        </div>
        <div className="row" style={{ marginTop: 4, gap: 8 }}>
          <span className="mono dim2" style={{ fontSize: 11 }}>or just type to begin</span>
          <span style={{ flex: 1 }}></span>
          <span className="kbd">⌘ ↵</span>
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({ tone, title, sub }) {
  return (
    <button style={{
      textAlign: "left", padding: "14px 16px", borderRadius: 14,
      background: "var(--host-bg-2)", border: "var(--line-2)",
      color: "var(--host-fg)", font: "inherit", cursor: "pointer",
      display: "flex", flexDirection: "column", gap: 4,
      position: "relative", overflow: "hidden",
    }}>
      <span style={{ position: "absolute", top: 14, right: 14, width: 8, height: 8, borderRadius: "50%", background: tone, boxShadow: `0 0 10px ${tone}` }}></span>
      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</span>
      <span className="mono dim2" style={{ fontSize: 11 }}>{sub}</span>
    </button>
  );
}

Object.assign(window, {
  AtlasCanvas, AtlasQuery, AtlasInsights, AtlasResources, AtlasOnboarding,
});

// ============================================================
// InfraNodus MCP App — Mockups canvas root
// Composes 2 directions × 5 surfaces into a design_canvas.
// ============================================================

const { useState, useEffect } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "oklch(0.74 0.155 52)",
  "density": "balanced",
  "labels": "hubs",
  "layout": "split",
  "typeScale": 100
}/*EDITMODE-END*/;

const ACCENTS = [
  "oklch(0.74 0.155 52)",   // signal orange — InfraNodus-feel
  "oklch(0.74 0.14 220)",   // cobalt
  "oklch(0.72 0.16 295)",   // iris
  "oklch(0.80 0.14 140)",   // filament
];

function App() {
  const [tweaks, setTweak] = useTweaks(DEFAULTS);

  // Apply tweaks to root document
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--in-accent", tweaks.accent);
    if (tweaks.theme === "light") {
      root.style.setProperty("--host-bg",       "oklch(0.985 0.003 80)");
      root.style.setProperty("--host-bg-2",     "oklch(0.965 0.004 80)");
      root.style.setProperty("--host-bg-3",     "oklch(0.94  0.005 80)");
      root.style.setProperty("--host-fg",       "oklch(0.18  0.01  250)");
      root.style.setProperty("--host-fg-2",     "oklch(0.36  0.008 250)");
      root.style.setProperty("--host-fg-3",     "oklch(0.55  0.008 250)");
      root.style.setProperty("--host-border",   "oklch(0.86  0.008 250)");
      root.style.setProperty("--host-border-2", "oklch(0.91  0.006 250)");
    } else {
      ["--host-bg","--host-bg-2","--host-bg-3","--host-fg","--host-fg-2","--host-fg-3","--host-border","--host-border-2"].forEach(p => root.style.removeProperty(p));
    }
    root.style.setProperty("--type-scale", String(tweaks.typeScale / 100));
  }, [tweaks.theme, tweaks.accent, tweaks.typeScale]);

  return (
    <>
      <DesignCanvas>
        <DCSection id="topology" title="Direction A — Topology" subtitle="Terminal/dev-tool. Dense panels, mono headers, single accent. Use when the app sits next to code.">
          <DCArtboard id="t-canvas"    label="01 · Graph canvas"    width={1200} height={780}><TopologyCanvas tweaks={tweaks} /></DCArtboard>
          <DCArtboard id="t-query"     label="02 · Query compiler"  width={1200} height={780}><TopologyQuery /></DCArtboard>
          <DCArtboard id="t-insights"  label="03 · Insights & gaps" width={1200} height={780}><TopologyInsights /></DCArtboard>
          <DCArtboard id="t-resources" label="04 · Resource browser" width={1200} height={780}><TopologyResources /></DCArtboard>
          <DCArtboard id="t-onboard"   label="05 · Onboarding"      width={1200} height={780}><TopologyOnboarding /></DCArtboard>
        </DCSection>

        <DCSection id="atlas" title="Direction B — Atlas" subtitle="Graph-first. Airy, soft node glow, multi-cluster palette, larger labels. Use when the graph is the product.">
          <DCArtboard id="a-canvas"    label="01 · Graph canvas"    width={1200} height={780}><AtlasCanvas tweaks={tweaks} /></DCArtboard>
          <DCArtboard id="a-query"     label="02 · Query compiler"  width={1200} height={780}><AtlasQuery /></DCArtboard>
          <DCArtboard id="a-insights"  label="03 · Insights & gaps" width={1200} height={780}><AtlasInsights /></DCArtboard>
          <DCArtboard id="a-resources" label="04 · Resource browser" width={1200} height={780}><AtlasResources /></DCArtboard>
          <DCArtboard id="a-onboard"   label="05 · Onboarding"      width={1200} height={780}><AtlasOnboarding /></DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio
            label="Mode"
            value={tweaks.theme}
            onChange={(v) => setTweak("theme", v)}
            options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]}
          />
        </TweakSection>
        <TweakSection label="Brand">
          <TweakColor
            label="Accent"
            value={tweaks.accent}
            onChange={(v) => setTweak("accent", v)}
            options={ACCENTS}
          />
        </TweakSection>
        <TweakSection label="Graph">
          <TweakRadio
            label="Density"
            value={tweaks.density}
            onChange={(v) => setTweak("density", v)}
            options={[
              { value: "sparse",   label: "Sparse" },
              { value: "balanced", label: "Balanced" },
              { value: "dense",    label: "Dense" },
            ]}
          />
          <TweakRadio
            label="Labels"
            value={tweaks.labels}
            onChange={(v) => setTweak("labels", v)}
            options={[
              { value: "none", label: "None" },
              { value: "hubs", label: "Hubs" },
              { value: "all",  label: "All" },
            ]}
          />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio
            label="Canvas"
            value={tweaks.layout}
            onChange={(v) => setTweak("layout", v)}
            options={[
              { value: "split", label: "Split" },
              { value: "full",  label: "Full" },
            ]}
          />
          <TweakSlider
            label="Type scale"
            value={tweaks.typeScale}
            onChange={(v) => setTweak("typeScale", v)}
            min={85} max={120} step={5} unit="%"
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

// ============================================================
// Tool UI canvas — lays out 24 tool-result cards by capability,
// wraps everything in a Tweaks context so every card responds
// live to a single panel of global controls.
// ============================================================

const TOOLS_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density":      "balanced",
  "labels":       "hubs",
  "speed":        1,
  "hover":        true,
  "showSpecular": true,
  "accent":       "oklch(0.74 0.155 52)"
}/*EDITMODE-END*/;

function ToolsApp() {
  const [tweaks, setTweak] = useTweaks(TOOLS_TWEAK_DEFAULTS);

  // Push the accent token to the document root so every tool card
  // (and the cluster hulls) re-tint live.
  React.useEffect(() => {
    document.documentElement.style.setProperty("--in-accent", tweaks.accent);
  }, [tweaks.accent]);

  return (
    <ToolsTweaksContext.Provider value={tweaks}>
      <DesignCanvas>
        <DCSection id="analysis" title="Analysis · text ↔ graph" subtitle="Tools that build, load, save, or query a knowledge graph. Edit any arg in mono · click ⟳ run to re-execute.">
          <DCArtboard id="t-01" label="01 · generate_knowledge_graph"      width={560} height={420}><T_GenerateKnowledgeGraph /></DCArtboard>
          <DCArtboard id="t-02" label="02 · analyze_existing_graph_by_name" width={560} height={420}><T_AnalyzeExistingGraph /></DCArtboard>
          <DCArtboard id="t-03" label="03 · create_knowledge_graph"         width={560} height={420}><T_CreateKnowledgeGraph /></DCArtboard>
          <DCArtboard id="t-04" label="04 · retrieve_from_knowledge_base"   width={560} height={420}><T_RetrieveFromKB /></DCArtboard>
          <DCArtboard id="t-05" label="05 · develop_text_tool"              width={560} height={420}><T_DevelopText /></DCArtboard>
        </DCSection>

        <DCSection id="insight" title="Insight · graph → meaning" subtitle="Click rows and chips to interact; hover gap cards to highlight.">
          <DCArtboard id="t-06" label="06 · generate_content_gaps"      width={560} height={420}><T_ContentGaps /></DCArtboard>
          <DCArtboard id="t-07" label="07 · generate_topical_clusters"  width={560} height={420}><T_TopicalClusters /></DCArtboard>
          <DCArtboard id="t-08" label="08 · generate_contextual_hint"   width={560} height={420}><T_ContextualHint /></DCArtboard>
          <DCArtboard id="t-09" label="09 · develop_conceptual_bridges" width={560} height={420}><T_ConceptualBridges /></DCArtboard>
          <DCArtboard id="t-10" label="10 · develop_latent_topics"      width={560} height={420}><T_LatentTopics /></DCArtboard>
        </DCSection>

        <DCSection id="research" title="Research · questions, ideas, grounded responses" subtitle="Re-run for fresh ideas · click a question to copy.">
          <DCArtboard id="t-11" label="11 · generate_research_questions"      width={560} height={420}><T_ResearchQuestions /></DCArtboard>
          <DCArtboard id="t-12" label="12 · generate_research_ideas"          width={560} height={420}><T_ResearchIdeas /></DCArtboard>
          <DCArtboard id="t-13" label="13 · research_questions_from_graph"    width={560} height={420}><T_ResearchQuestionsFromGraph /></DCArtboard>
          <DCArtboard id="t-14" label="14 · generate_responses_from_graph"    width={560} height={420}><T_ResponsesFromGraph /></DCArtboard>
        </DCSection>

        <DCSection id="compare" title="Compare · overlap & difference" subtitle="Set hulls are computed from the actual node positions — A∩B is geometric, not decorative.">
          <DCArtboard id="t-15" label="15 · overlap_between_texts"    width={560} height={420}><T_Overlap /></DCArtboard>
          <DCArtboard id="t-16" label="16 · difference_between_texts" width={560} height={420}><T_Difference /></DCArtboard>
        </DCSection>

        <DCSection id="seo" title="SEO · search supply vs demand" subtitle="Edit the query and re-run to remap supply vs demand.">
          <DCArtboard id="t-17" label="17 · analyze_google_search_results"     width={560} height={420}><T_GoogleResults /></DCArtboard>
          <DCArtboard id="t-18" label="18 · analyze_related_search_queries"    width={560} height={420}><T_RelatedQueries /></DCArtboard>
          <DCArtboard id="t-19" label="19 · search_queries_vs_search_results"  width={560} height={420}><T_QueriesVsResults /></DCArtboard>
          <DCArtboard id="t-20" label="20 · generate_seo_report"               width={560} height={420}><T_SEOReport /></DCArtboard>
        </DCSection>

        <DCSection id="memory" title="Memory · entities & relations" subtitle="[[Wikilink]]-marked triples saved into named memory graphs.">
          <DCArtboard id="t-21" label="21 · memory_add_relations" width={560} height={420}><T_MemoryAdd /></DCArtboard>
          <DCArtboard id="t-22" label="22 · memory_get_relations" width={560} height={420}><T_MemoryGet /></DCArtboard>
        </DCSection>

        <DCSection id="search" title="Search · find & fetch graphs" subtitle="Live-filter as you edit the query.">
          <DCArtboard id="t-23" label="23 · search" width={560} height={420}><T_Search /></DCArtboard>
          <DCArtboard id="t-24" label="24 · fetch"  width={560} height={420}><T_Fetch /></DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Graph layout">
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
        <TweakSection label="Brand">
          <TweakColor
            label="Accent"
            value={tweaks.accent}
            onChange={(v) => setTweak("accent", v)}
            options={[
              "oklch(0.74 0.155 52)",
              "oklch(0.74 0.14 220)",
              "oklch(0.72 0.16 295)",
              "oklch(0.80 0.14 140)",
            ]}
          />
        </TweakSection>
        <TweakSection label="Simulated tools">
          <TweakSlider
            label="Speed"
            value={tweaks.speed * 100}
            onChange={(v) => setTweak("speed", Math.max(0.1, v / 100))}
            min={25} max={300} step={25} unit="%"
          />
          <TweakToggle
            label="Node specular"
            value={tweaks.showSpecular}
            onChange={(v) => setTweak("showSpecular", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </ToolsTweaksContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ToolsApp />);

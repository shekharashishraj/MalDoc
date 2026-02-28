import React, { useState, useCallback, useEffect } from "react";
import { useAppState } from "./AppContext.js";
import { apiGet } from "./api.js";
import { DEFAULT_PIPELINE_RUN_ROOT } from "./constants.js";
import { MetricsChart, FieldDiffSection } from "./EvaluationTab.js";

const h = React.createElement;

/* ── Scenario metadata ─────────────────────────────────────── */
const SCENARIO_META = {
  decision:   { label: "Decision-making Agent",          icon: "⚖️",  color: "#6366f1" },
  scheduling: { label: "Scheduling Agent",               icon: "📅",  color: "#06b6d4" },
  credential: { label: "Credential Verification Agent",  icon: "🪪",  color: "#f59e0b" },
  survey:     { label: "Survey / Link Routing Agent",    icon: "🔗",  color: "#10b981" },
  db:         { label: "Database Agent",                 icon: "🗄️",  color: "#a78bfa" },
};

const SEVERITY_STYLE = {
  high:   { bg: "rgba(248,113,113,0.15)", border: "#f87171", text: "#f87171",  label: "HIGH" },
  medium: { bg: "rgba(251,191,36,0.15)",  border: "#fbbf24", text: "#fbbf24",  label: "MED"  },
  low:    { bg: "rgba(52,211,153,0.15)",  border: "#34d399", text: "#34d399",  label: "LOW"  },
};

const VECTOR_LABELS = {
  decision_flip:            { label: "Decision Flip",    icon: "⚖️" },
  tool_parameter_corruption:{ label: "Tool Corruption",  icon: "🔧" },
  unsafe_routing:           { label: "Unsafe Routing",   icon: "🔀" },
  wrong_entity_binding:     { label: "Entity Binding",   icon: "🔗" },
  persistence_poisoning:    { label: "Persistence",      icon: "💾" },
  resource_inflation:       { label: "Resource Inflate", icon: "📈" },
};

/* ── Run Detail Drawer ─────────────────────────────────────── */
function RunDetailDrawer({ run, onClose }) {
  const doc = run.raw || run;
  const meta = SCENARIO_META[run.scenario] || { label: run.scenario || "Unknown", icon: "📋", color: "#6366f1" };
  const sev = SEVERITY_STYLE[run.severity] || SEVERITY_STYLE.medium;

  const changedRows = Object.entries(doc.targeted_field_diffs || {})
    .filter(([, p]) => p && p.changed)
    .map(([field, p]) => ({ field, clean: String(p.clean ?? ""), attacked: String(p.attacked ?? "") }));
  const changedFallback = [];

  return h("div", { className: "run-detail-overlay", onClick: (e) => { if (e.target.className === "run-detail-overlay") onClose(); } },
    h("div", { className: "run-detail-drawer" },

      /* Header */
      h("div", { className: "run-detail-header" },
        h("div", { className: "run-detail-title-row" },
          h("span", { className: "run-detail-icon" }, meta.icon),
          h("div", null,
            h("h3", null, meta.label),
            h("code", { className: "run-detail-docid" }, run.doc_id || ""),
          ),
        ),
        h("div", { className: "run-detail-header-right" },
          h("span", {
            className: "run-sev-badge",
            style: { background: sev.bg, borderColor: sev.border, color: sev.text },
          }, sev.label),
          h("span", {
            className: `run-compromised-badge${run.compromised ? " yes" : " no"}`,
          }, run.compromised ? "⚠ COMPROMISED" : "✓ SAFE"),
          h("button", { className: "run-detail-close", onClick: onClose }, "×"),
        ),
      ),

      /* Scrollable body */
      h("div", { className: "run-detail-body" },

        /* Quick stats strip */
        h("div", { className: "run-stats-strip" },
          h("div", { className: "run-stat-item" },
            h("span", { className: "run-stat-label" }, "Changed Fields"),
            h("span", { className: "run-stat-value" }, run.changed_target_fields ?? 0),
          ),
          h("div", { className: "run-stat-item" },
            h("span", { className: "run-stat-label" }, "Risk Vectors"),
            h("span", { className: "run-stat-value" }, `${run.fired_vector_count ?? 0} / ${Object.keys(VECTOR_LABELS).length}`),
          ),
          h("div", { className: "run-stat-item" },
            h("span", { className: "run-stat-label" }, "Risk Coverage"),
            h("span", { className: `run-stat-value${(run.risk_pct || 0) > 50 ? " danger" : ""}` }, `${run.risk_pct ?? 0}%`),
          ),
          h("div", { className: "run-stat-item" },
            h("span", { className: "run-stat-label" }, "Latency Ratio"),
            h("span", { className: "run-stat-value" }, `${(run.latency_inflation_ratio || 1.0).toFixed(2)}×`),
          ),
          h("div", { className: "run-stat-item" },
            h("span", { className: "run-stat-label" }, "Clean=Gold"),
            h("span", { className: "run-stat-value" }, run.clean_matches_gold ? "Yes" : "No"),
          ),
          h("div", { className: "run-stat-item" },
            h("span", { className: "run-stat-label" }, "Baseline Fail"),
            h("span", { className: "run-stat-value" }, run.baseline_failure ? "Yes" : "No"),
          ),
        ),

        /* Attack vector chips full list */
        h("div", { className: "run-detail-section" },
          h("h4", null, "Attack Vectors"),
          h("div", { className: "run-vectors-full" },
            Object.entries(run.attack_vectors || {}).map(([key, fired]) => {
              const v = VECTOR_LABELS[key] || { label: key, icon: "⚙️" };
              return h("div", { key, className: `run-vector-chip-full${fired ? " fired" : " clear"}` },
                h("span", null, v.icon, " ", v.label),
                h("span", { className: "chip-status" }, fired ? "FIRED" : "CLEAR"),
              );
            }),
          ),
        ),

        /* Metrics chart */
        h("div", { className: "run-detail-section" },
          h(MetricsChart, { doc }),
        ),

        /* Field diffs */
        h("div", { className: "run-detail-section" },
          h(FieldDiffSection, { changedRows, changedFallback, doc, scenario: run.scenario }),
        ),

        /* Raw JSON */
        h("div", { className: "run-detail-section" },
          h("details", { className: "run-raw-json" },
            h("summary", null, "Raw Metrics JSON"),
            h("pre", { className: "inspect-content json" }, JSON.stringify(doc, null, 2)),
          ),
        ),
      ),
    ),
  );
}

/* ── Run Card ──────────────────────────────────────────────── */
function RunCard({ run, onClick }) {
  const meta = SCENARIO_META[run.scenario] || { label: run.scenario || "Unknown", icon: "📋", color: "#6366f1" };
  const sev  = SEVERITY_STYLE[run.severity] || SEVERITY_STYLE.medium;
  const firedVectors = Object.entries(run.attack_vectors || {}).filter(([, v]) => v);
  const docIdShort   = (run.doc_id || "").slice(0, 8) + "…";

  return h("article", { className: `run-card${run.compromised ? " compromised" : ""}`, onClick },
    /* Top row: scenario icon + severity tag */
    h("div", { className: "run-card-top" },
      h("span", { className: "run-card-icon" }, meta.icon),
      h("span", {
        className: "run-sev-badge",
        style: { background: sev.bg, borderColor: sev.border, color: sev.text },
      }, sev.label),
    ),

    /* Title */
    h("h4", { className: "run-card-title" }, meta.label),

    /* Doc ID */
    h("code", { className: "run-card-docid" }, docIdShort),

    /* Fired attack vector chips */
    h("div", { className: "run-card-chips" },
      firedVectors.length === 0
        ? h("span", { className: "run-chip clear" }, "✓ No vectors fired")
        : firedVectors.slice(0, 3).map(([key]) => {
            const v = VECTOR_LABELS[key] || { label: key, icon: "⚙️" };
            return h("span", { key, className: "run-chip fired" }, v.icon, " ", v.label);
          }),
      firedVectors.length > 3 && h("span", { className: "run-chip fired" }, `+${firedVectors.length - 3} more`),
    ),

    /* Stats row */
    h("div", { className: "run-card-stats" },
      h("div", { className: "run-card-stat" },
        h("span", { className: "rcs-val" }, run.changed_target_fields ?? 0),
        h("span", { className: "rcs-label" }, "Changed"),
      ),
      h("div", { className: "run-card-stat" },
        h("span", { className: "rcs-val" }, `${run.risk_pct ?? 0}%`),
        h("span", { className: "rcs-label" }, "Risk"),
      ),
      h("div", { className: "run-card-stat" },
        h("span", { className: "rcs-val" }, `${(run.latency_inflation_ratio || 1.0).toFixed(2)}×`),
        h("span", { className: "rcs-label" }, "Latency"),
      ),
    ),

    /* Footer */
    h("div", { className: "run-card-footer" },
      h("span", { className: `run-compromised-badge${run.compromised ? " yes" : " no"}` },
        run.compromised ? "⚠ COMPROMISED" : "✓ SAFE",
      ),
      h("button", { className: "btn-run-detail", onClick: (e) => { e.stopPropagation(); onClick(); } }, "View Details →"),
    ),
  );
}

/* ── RunsTab ───────────────────────────────────────────────── */
export default function RunsTab() {
  const { state, dispatch } = useAppState();
  const items = state.runs || [];
  const [selected, setSelected] = useState(null);

  const refreshRuns = useCallback(async () => {
    try {
      const root = encodeURIComponent(state.baseRoot || DEFAULT_PIPELINE_RUN_ROOT);
      const payload = await apiGet(`/api/runs/docs?base_root=${root}`);
      dispatch({ type: "SET_RUNS", payload: payload.items || [] });
    } catch (_) {
      dispatch({ type: "SET_RUNS", payload: [] });
    }
  }, [state.baseRoot, dispatch]);

  /* Auto-refresh on mount */
  useEffect(() => { refreshRuns(); }, []);

  return h("section", { id: "runs", className: "tab-panel active" },
    h("div", { className: "panel-header" },
      h("div", { className: "panel-title-row" },
        h("h2", null, "Runs"),
        h("span", { className: "runs-count-badge" }, `${items.length} run${items.length !== 1 ? "s" : ""}`),
      ),
    ),

    h("div", { className: "runs-toolbar" },
      h("button", { className: "btn btn-secondary", onClick: refreshRuns }, "↺  Refresh Runs"),
    ),

    items.length === 0
      ? h("div", { className: "runs-empty" },
          h("div", { className: "runs-empty-icon" }, "📋"),
          h("p", null, "No evaluation runs yet."),
          h("p", { className: "hint" }, "Run a pipeline then evaluate to see results here."),
        )
      : h("div", { className: "runs-grid" },
          items.map((run, i) =>
            h(RunCard, {
              key: run.doc_id || i,
              run,
              onClick: () => setSelected(run),
            }),
          ),
        ),

    selected && h(RunDetailDrawer, { run: selected, onClose: () => setSelected(null) }),
  );
}

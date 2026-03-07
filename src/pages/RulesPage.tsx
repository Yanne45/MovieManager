import { useState } from "react";
import { SectionTitle, EmptyState, UnderlineInput } from "../components/ui";

// ============================================================================
// Types (matching Rust RuleCondition / RuleAction)
// ============================================================================

export interface RuleItem {
  id: number;
  name: string;
  enabled: boolean;
  condition: { field: string; operator: string; value: string };
  action: { action_type: string; value: string };
  priority: number;
}

interface RulesPageProps {
  rules: RuleItem[];
  onToggle?: (id: number, enabled: boolean) => void;
  onDelete?: (id: number) => void;
  onCreate?: (rule: Omit<RuleItem, "id" | "enabled" | "priority">) => void;
  onApplyAll?: () => void;
}

// ============================================================================
// Rules Page
// ============================================================================

export function RulesPage({ rules, onToggle, onDelete, onCreate, onApplyAll }: RulesPageProps) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20, maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionTitle>Règles d'automatisation</SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onApplyAll}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Appliquer toutes
          </button>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              background: "var(--color-primary)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Nouvelle règle
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateRuleForm
          onSave={(rule) => {
            onCreate?.(rule);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {rules.length === 0 && !showCreate && (
        <EmptyState message="Aucune règle — créez des automatisations pour taguer vos fichiers" />
      )}

      {rules.map((rule) => (
        <div
          key={rule.id}
          style={{
            padding: "12px 16px",
            marginBottom: 8,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            opacity: rule.enabled ? 1 : 0.5,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Toggle */}
            <button
              onClick={() => onToggle?.(rule.id, !rule.enabled)}
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                border: "none",
                background: rule.enabled ? "var(--color-primary)" : "var(--bg-surface-alt)",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  background: "#fff",
                  position: "absolute",
                  top: 2,
                  left: rule.enabled ? 18 : 2,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                }}
              />
            </button>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{rule.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Si{" "}
                <code style={{ background: "var(--bg-surface-alt)", padding: "1px 4px", borderRadius: 3 }}>
                  {rule.condition.field}
                </code>{" "}
                <span style={{ color: "var(--color-primary)" }}>{OPERATOR_LABELS[rule.condition.operator] || rule.condition.operator}</span>{" "}
                <code style={{ background: "var(--bg-surface-alt)", padding: "1px 4px", borderRadius: 3 }}>
                  {rule.condition.value}
                </code>{" "}
                → {ACTION_LABELS[rule.action.action_type] || rule.action.action_type}{" "}
                <strong>{rule.action.value}</strong>
              </div>
            </div>

            <button
              onClick={() => onDelete?.(rule.id)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Create Rule Form
// ============================================================================

const FIELDS = [
  { value: "codec", label: "Codec vidéo" },
  { value: "resolution", label: "Résolution" },
  { value: "height", label: "Hauteur (px)" },
  { value: "bitrate", label: "Bitrate vidéo" },
  { value: "audio_codec", label: "Codec audio" },
  { value: "audio_channels", label: "Canaux audio" },
  { value: "hdr", label: "HDR" },
  { value: "container", label: "Conteneur" },
  { value: "path", label: "Chemin fichier" },
];

const OPERATORS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "contains", label: "contient" },
  { value: "not_contains", label: "ne contient pas" },
];

const ACTIONS = [
  { value: "add_tag", label: "Ajouter tag" },
  { value: "set_genre", label: "Ajouter genre" },
  { value: "set_quality_score", label: "Forcer score qualité" },
];

const OPERATOR_LABELS: Record<string, string> = {
  eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤",
  contains: "contient", not_contains: "ne contient pas",
};

const ACTION_LABELS: Record<string, string> = {
  add_tag: "Tag →", set_genre: "Genre →", set_quality_score: "Score →",
};

function CreateRuleForm({
  onSave,
  onCancel,
}: {
  onSave: (rule: { name: string; condition: { field: string; operator: string; value: string }; action: { action_type: string; value: string } }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [field, setField] = useState("codec");
  const [operator, setOperator] = useState("eq");
  const [condValue, setCondValue] = useState("");
  const [actionType, setActionType] = useState("add_tag");
  const [actionValue, setActionValue] = useState("");

  const canSave = name.trim() && condValue.trim() && actionValue.trim();

  return (
    <div
      style={{
        padding: 16,
        marginBottom: 16,
        borderRadius: 8,
        border: "2px solid var(--color-primary)",
        background: "var(--bg-surface)",
      }}
    >
      <UnderlineInput label="Nom de la règle" value={name} onChange={setName} />

      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
        Condition
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Select value={field} options={FIELDS} onChange={setField} />
        <Select value={operator} options={OPERATORS} onChange={setOperator} />
        <input
          value={condValue}
          onChange={(e) => setCondValue(e.target.value)}
          placeholder="Valeur"
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            fontSize: 13,
            background: "var(--bg-surface)",
            color: "var(--text-main)",
          }}
        />
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
        Action
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Select value={actionType} options={ACTIONS} onChange={setActionType} />
        <input
          value={actionValue}
          onChange={(e) => setActionValue(e.target.value)}
          placeholder="Valeur"
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            fontSize: 13,
            background: "var(--bg-surface)",
            color: "var(--text-main)",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Annuler
        </button>
        <button
          onClick={() =>
            canSave &&
            onSave({
              name: name.trim(),
              condition: { field, operator, value: condValue.trim() },
              action: { action_type: actionType, value: actionValue.trim() },
            })
          }
          disabled={!canSave}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: canSave ? "var(--color-primary)" : "var(--bg-surface-alt)",
            color: canSave ? "#fff" : "var(--text-muted)",
            fontSize: 12,
            fontWeight: 600,
            cursor: canSave ? "pointer" : "default",
          }}
        >
          Créer
        </button>
      </div>
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "6px 10px",
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        color: "var(--text-main)",
        fontSize: 13,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

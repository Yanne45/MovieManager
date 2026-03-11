import { useState } from "react";
import { SectionTitle, EmptyState, UnderlineInput } from "../components/ui";
import { COLORS, SP, FONT, WEIGHT, RADIUS, TRANSITION, flex, btn, input } from "../lib/tokens";

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
    <div style={{ flex: 1, overflowY: "auto", padding: SP.huge, maxWidth: 800 }}>
      <div style={{ ...flex.rowBetween, marginBottom: SP.xxxl }}>
        <SectionTitle>Règles d'automatisation</SectionTitle>
        <div style={{ ...flex.rowGap(SP.base) }}>
          <button
            onClick={onApplyAll}
            style={{
              ...btn.base,
              background: "transparent",
              color: COLORS.textSecondary,
            }}
          >
            Appliquer toutes
          </button>
          <button
            onClick={() => setShowCreate(true)}
            style={btn.primary}
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
            padding: `${SP.xl}px ${SP.xxxl}px`,
            marginBottom: SP.base,
            borderRadius: RADIUS.lg,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bgSurface,
            opacity: rule.enabled ? 1 : 0.5,
          }}
        >
          <div style={flex.rowGap(SP.lg)}>
            {/* Toggle */}
            <button
              onClick={() => onToggle?.(rule.id, !rule.enabled)}
              style={{
                width: 36,
                height: 20,
                borderRadius: SP.lg,
                border: "none",
                background: rule.enabled ? COLORS.primary : COLORS.bgSurfaceAlt,
                cursor: "pointer",
                position: "relative",
                transition: `background ${TRANSITION.normal}`,
              }}
            >
              <div
                style={{
                  width: SP.xxxl,
                  height: SP.xxxl,
                  borderRadius: RADIUS.lg,
                  background: "#fff",
                  position: "absolute",
                  top: 2,
                  left: rule.enabled ? 18 : 2,
                  transition: `left ${TRANSITION.normal}`,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                }}
              />
            </button>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: FONT.md, fontWeight: WEIGHT.medium }}>{rule.name}</div>
              <div style={{ fontSize: FONT.sm, color: COLORS.textMuted, marginTop: SP.xs }}>
                Si{" "}
                <code style={{ background: COLORS.bgSurfaceAlt, padding: `1px ${SP.s}px`, borderRadius: RADIUS.sm }}>
                  {rule.condition.field}
                </code>{" "}
                <span style={{ color: COLORS.primary }}>{OPERATOR_LABELS[rule.condition.operator] || rule.condition.operator}</span>{" "}
                <code style={{ background: COLORS.bgSurfaceAlt, padding: `1px ${SP.s}px`, borderRadius: RADIUS.sm }}>
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
                color: COLORS.textMuted,
                cursor: "pointer",
                fontSize: FONT.xl,
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
        padding: SP.xxxl,
        marginBottom: SP.xxxl,
        borderRadius: RADIUS.lg,
        border: `2px solid ${COLORS.primary}`,
        background: COLORS.bgSurface,
      }}
    >
      <UnderlineInput label="Nom de la règle" value={name} onChange={setName} />

      <div style={{ fontSize: FONT.base, fontWeight: WEIGHT.semi, color: COLORS.textMuted, marginBottom: SP.m }}>
        Condition
      </div>
      <div style={{ ...flex.rowGap(SP.base), marginBottom: SP.xxl }}>
        <Select value={field} options={FIELDS} onChange={setField} />
        <Select value={operator} options={OPERATORS} onChange={setOperator} />
        <input
          value={condValue}
          onChange={(e) => setCondValue(e.target.value)}
          placeholder="Valeur"
          style={{
            ...input.base,
            flex: 1,
            padding: `${SP.m}px ${SP.lg}px`,
            fontSize: FONT.md,
          }}
        />
      </div>

      <div style={{ fontSize: FONT.base, fontWeight: WEIGHT.semi, color: COLORS.textMuted, marginBottom: SP.m }}>
        Action
      </div>
      <div style={{ ...flex.rowGap(SP.base), marginBottom: SP.xxxl }}>
        <Select value={actionType} options={ACTIONS} onChange={setActionType} />
        <input
          value={actionValue}
          onChange={(e) => setActionValue(e.target.value)}
          placeholder="Valeur"
          style={{
            ...input.base,
            flex: 1,
            padding: `${SP.m}px ${SP.lg}px`,
            fontSize: FONT.md,
          }}
        />
      </div>

      <div style={{ display: "flex", gap: SP.base, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            ...btn.base,
            background: "transparent",
            color: COLORS.textSecondary,
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
            ...btn.primary,
            background: canSave ? COLORS.primary : COLORS.bgSurfaceAlt,
            color: canSave ? "#fff" : COLORS.textMuted,
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
        ...input.select,
        fontSize: FONT.md,
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

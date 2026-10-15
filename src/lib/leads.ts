// Etapas do funil de leads (playbook: Novo, Contato feito, Proposta, Ganho, Perdido).
export type LeadStage = "novo" | "contato_feito" | "proposta" | "ganho" | "perdido";

export const LEAD_STAGES: { value: LeadStage; label: string; dot: string }[] = [
  { value: "novo", label: "Novo", dot: "bg-faint" },
  { value: "contato_feito", label: "Contato feito", dot: "bg-info" },
  { value: "proposta", label: "Proposta", dot: "bg-warn-dot" },
  { value: "ganho", label: "Ganho", dot: "bg-ok" },
  { value: "perdido", label: "Perdido", dot: "bg-alert" },
];

export const stageLabel = (s: string) => LEAD_STAGES.find((x) => x.value === s)?.label ?? s;

export const LEAD_SOURCES = [
  "Indicação", "Instagram", "WhatsApp", "Site", "Feira", "Visita", "Ligação", "Google", "Outro",
];

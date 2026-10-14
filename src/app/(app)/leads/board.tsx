"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { moveLead } from "./actions";
import { LEAD_STAGES, type LeadStage } from "@/lib/leads";
import { brl, formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";

export type BoardLead = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  source: string | null;
  stage: LeadStage;
  next_contact: string | null;
  estimated_value: number | null;
  customer_id: string | null;
};

// Quadro do funil. No computador, arraste o cartão para outra coluna.
export function LeadBoard({ leads, today, qs }: { leads: BoardLead[]; today: string; qs: string }) {
  const [items, setItems] = useState(leads);
  const [over, setOver] = useState<LeadStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  // Quando o servidor manda a lista atualizada (ex.: depois de salvar), o quadro acompanha.
  const [seen, setSeen] = useState(leads);
  if (seen !== leads) {
    setSeen(leads);
    setItems(leads);
  }

  function drop(stage: LeadStage, id: string) {
    const lead = items.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    const before = items;
    setItems((ls) => ls.map((l) => (l.id === id ? { ...l, stage } : l)));
    setError(null);
    start(async () => {
      const r = await moveLead(id, stage);
      if (r.error) {
        setItems(before);
        setError(`Não foi possível mover: ${r.error}`);
      }
    });
  }

  return (
    <>
      {error ? <p className="mb-3 rounded-lg bg-alert-soft px-3 py-2 text-[13px] text-alert">{error}</p> : null}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {LEAD_STAGES.map((s) => {
          const col = items.filter((l) => l.stage === s.value);
          const total = col.reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0);
          return (
            <section
              key={s.value}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.value);
              }}
              onDragLeave={() => setOver((o) => (o === s.value ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                drop(s.value, e.dataTransfer.getData("text/plain"));
              }}
              className={`flex w-[78vw] max-w-xs shrink-0 snap-start flex-col rounded-xl border p-2 transition-colors sm:w-72 lg:w-auto lg:max-w-none ${
                over === s.value ? "border-pen bg-pen-soft/60" : "border-line bg-subtle"
              }`}
            >
              <header className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                <h2 className="whitespace-nowrap text-[13px] font-semibold">{s.label}</h2>
                <span className="text-xs tabular-nums text-muted">{col.length}</span>
                {total ? <span className="ml-auto truncate text-[11px] tabular-nums text-muted">{brl(total)}</span> : null}
              </header>
              <ul className="grid min-h-24 content-start gap-2">
                {col.map((l) => {
                  const late = l.next_contact && l.next_contact < today && s.value !== "ganho" && s.value !== "perdido";
                  const isToday = l.next_contact === today;
                  return (
                    <li
                      key={l.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", l.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <Link
                        href={`/leads?lead=${l.id}${qs ? `&${qs}` : ""}`}
                        scroll={false}
                        className={`block rounded-lg border bg-white p-3 shadow-field transition hover:border-line-strong hover:shadow-panel ${
                          late ? "border-alert/40" : "border-line"
                        }`}
                      >
                        <p className="truncate text-sm font-medium text-ink">{l.name}</p>
                        {l.company ? <p className="truncate text-xs text-muted">{l.company}</p> : null}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {l.next_contact && s.value !== "ganho" && s.value !== "perdido" ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                                late ? "bg-alert-soft text-alert" : isToday ? "bg-warn-soft text-warn" : "bg-hover text-ink-2"
                              }`}
                            >
                              <Icon name="calendar" size={11} />
                              {late ? "Atrasado · " : isToday ? "Hoje · " : ""}
                              {formatDate(l.next_contact).slice(0, 5)}
                            </span>
                          ) : null}
                          {l.source ? (
                            <span className="rounded-md bg-hover px-1.5 py-0.5 text-[11px] text-muted">{l.source}</span>
                          ) : null}
                          {l.customer_id ? (
                            <span className="rounded-md bg-ok-soft px-1.5 py-0.5 text-[11px] font-medium text-ok">Cliente</span>
                          ) : null}
                          {l.estimated_value ? (
                            <span className="ml-auto text-xs font-medium tabular-nums text-ink-2">{brl(Number(l.estimated_value))}</span>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
                {col.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-line-strong px-3 py-6 text-center text-xs text-faint">
                    Arraste um lead para cá
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

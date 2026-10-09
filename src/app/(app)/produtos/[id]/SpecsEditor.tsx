"use client";

import { useState } from "react";
import { inputCls, ghostBtn } from "@/components/ui";

const SUGGESTIONS = [
  "Cor", "Tamanho", "Material", "Voltagem", "Potência", "Capacidade", "Sabor", "Validade",
  "Peso líquido", "Composição", "Largura", "Altura", "Acabamento", "Modelo", "Garantia",
  "Registro Anvisa", "Teor", "Gramatura", "Embalagem", "Origem",
];

export default function SpecsEditor({ initial, disabled }: { initial: [string, string][]; disabled?: boolean }) {
  const [rows, setRows] = useState<[string, string][]>(initial.length ? initial : [["", ""]]);
  const set = (i: number, j: 0 | 1, v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? (j === 0 ? [v, row[1]] : [row[0], v]) : row)) as [string, string][]);

  return (
    <div className="grid gap-3">
      <datalist id="spec-suggestions">
        {SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            name="spec_name"
            list="spec-suggestions"
            placeholder="Característica (ex.: Cor)"
            value={row[0]}
            onChange={(e) => set(i, 0, e.target.value)}
            className={inputCls}
            disabled={disabled}
          />
          <input
            name="spec_value"
            placeholder="Valor (ex.: Azul)"
            value={row[1]}
            onChange={(e) => set(i, 1, e.target.value)}
            className={inputCls}
            disabled={disabled}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRows((r) => (r.length > 1 ? r.filter((_, idx) => idx !== i) : [["", ""]]))}
            className="h-12 rounded-xl px-3 text-sm text-muted hover:bg-subtle"
            aria-label="Remover"
          >
            ✕
          </button>
        </div>
      ))}
      {!disabled && rows.length < 30 ? (
        <button type="button" onClick={() => setRows((r) => [...r, ["", ""]])} className={`${ghostBtn} justify-self-start`}>
          + Adicionar característica
        </button>
      ) : null}
    </div>
  );
}

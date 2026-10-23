"use client";

import { useMemo, useState } from "react";
import { inputCls, quietBtn } from "@/components/ui";

export type PickProduct = { id: string; code: string; name: string; principal: string; checked: boolean; full: boolean };

// Marca em lote os produtos que usam a lista. Busca por nome ou código e "marcar todos" do que está na tela.
export function ProductPicker({ products, disabled }: { products: PickProduct[]; disabled?: boolean }) {
  const [q, setQ] = useState("");
  const [on, setOn] = useState(() => new Set(products.filter((p) => p.checked).map((p) => p.id)));
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? products.filter((p) => `${p.name} ${p.code} ${p.principal}`.toLowerCase().includes(t)) : products;
  }, [q, products]);
  const toggle = (id: string, v: boolean) =>
    setOn((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou código"
          className={`${inputCls} min-w-0 flex-1 sm:max-w-xs`}
        />
        <button type="button" disabled={disabled} onClick={() => shown.forEach((p) => !p.full && toggle(p.id, true))} className={quietBtn}>
          Marcar {q ? "os encontrados" : "todos"}
        </button>
        <button type="button" disabled={disabled} onClick={() => shown.forEach((p) => toggle(p.id, false))} className={quietBtn}>
          Desmarcar
        </button>
        <span className="ml-auto text-[13px] tabular-nums text-muted">{on.size} marcados</span>
      </div>

      {/* Todos os produtos vão no envio, para saber quem foi desmarcado. */}
      {products.map((p) => (
        <input key={p.id} type="hidden" name="shown_id" value={p.id} />
      ))}
      {products
        .filter((p) => on.has(p.id))
        .map((p) => (
          <input key={p.id} type="hidden" name="product_id" value={p.id} />
        ))}

      <ul className="scroll-thin max-h-[26rem] divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {shown.map((p) => {
          const blocked = p.full && !on.has(p.id);
          return (
            <li key={p.id}>
              <label className={`flex items-center gap-3 px-3 py-2.5 text-sm ${blocked ? "opacity-60" : "cursor-pointer hover:bg-subtle"}`}>
                <input
                  type="checkbox"
                  checked={on.has(p.id)}
                  disabled={disabled || blocked}
                  onChange={(e) => toggle(p.id, e.target.checked)}
                  className="h-[18px] w-[18px] shrink-0 rounded border-line-strong sm:h-4 sm:w-4"
                />
                <span className="w-20 shrink-0 truncate font-mono text-xs text-muted">{p.code}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="hidden shrink-0 truncate text-xs text-muted sm:block">
                  {blocked ? "já usa 2 listas" : p.principal}
                </span>
              </label>
            </li>
          );
        })}
        {shown.length === 0 ? <li className="px-3 py-3 text-[13px] text-muted">Nenhum produto encontrado.</li> : null}
      </ul>
    </div>
  );
}

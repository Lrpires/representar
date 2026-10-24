"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { saveOrder, type OrderInput, type ItemInput } from "./save";
import { lineTotals, orderTotals, PAYMENT_TERMS } from "@/lib/orders";
import { Combobox, type ComboOption } from "@/components/combobox";
import { Icon } from "@/components/icons";
import { ErrorNote, Field, SaveBar, ghostBtn, iconBtn, inputCls, primaryBtn, textareaCls } from "@/components/ui";
import { useNumberFormat } from "@/components/number-format";
import { describeWithOptions, optionsText, type OptionList } from "@/lib/options";
import { OptionGrid, type GridLine } from "./option-grid";

export type EditorCustomer = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  cnpj: string | null;
  last_principal_id: string | null;
  seller_id: string | null; // vendedor padrão do cliente
};
export type EditorPrincipal = { id: string; name: string; commission: number | null };
export type EditorProduct = {
  id: string;
  principal_id: string;
  code: string;
  name: string;
  unit: string;
  tablePrice: number | null; // preço da tabela vigente (só quando o escritório usa tabelas)
  lists: OptionList[]; // listas de opções (cor, tamanho…): abrem a grade no pedido
};
// Cliente → produto → [opções ("Azul / M" ou ""), preço], do pedido mais recente para o mais antigo.
export type PriceHistory = Record<string, Record<string, [string, number][]>>;
export type EditorUnit = { value: string; label: string };

type Row = ItemInput & { key: string };

const newRow = (unit: string, key: string = crypto.randomUUID()): Row => ({
  key,
  variant_id: null,
  options: null,
  code: "",
  description: "",
  unit,
  qty: "",
  price: "",
  discount: "",
});

// Campos compactos da grade de itens.
const cell =
  "h-11 w-full rounded-md border border-transparent bg-transparent px-2 text-base text-ink outline-none transition-[border-color,box-shadow,background-color] placeholder:text-faint hover:border-line-strong focus:border-accent focus:bg-surface focus:ring-[3px] focus:ring-accent/25 sm:h-9 sm:text-sm";

export function OrderEditor({
  initial,
  customers,
  principals,
  products,
  sellers = [],
  priceHistory = {},
  principalLists = {},
  units,
  defaultUnit,
  showCommission = true,
  sentEdit,
}: {
  initial: OrderInput;
  customers: EditorCustomer[];
  principals: EditorPrincipal[];
  products: EditorProduct[];
  sellers?: { id: string; name: string }[]; // só para quem escolhe o vendedor (administrador e gerente)
  priceHistory?: PriceHistory;
  principalLists?: Record<string, OptionList[]>; // listas de cada representada (cor, tamanho…)
  units: EditorUnit[];
  defaultUnit: string;
  showCommission?: boolean; // vendedor e gerente não veem a comissão (o % segue o padrão da representada)
  sentEdit?: { cancelHref: string }; // alterando pedido já enviado: só "Salvar alterações" (o pedido segue enviado)
}) {
  const { brl, num, numText, priceText } = useNumberFormat();
  const [f, setF] = useState(initial);
  const [rows, setRows] = useState<Row[]>(() =>
    // Chaves fixas nas linhas iniciais: iguais no servidor e no navegador.
    initial.items.length ? initial.items.map((i, n) => ({ ...i, key: `linha-${n}` })) : [newRow(defaultUnit, "linha-0")],
  );
  const [customerText, setCustomerText] = useState(
    customers.find((c) => c.id === initial.customer_id)?.name ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // A representada veio da sugestão (última compra)? Então troca junto se trocar de cliente.
  const [principalAuto, setPrincipalAuto] = useState(false);
  const [pending, start] = useTransition();
  // Produto com cores/tamanhos: a grade aberta para a linha em que ele foi escolhido.
  const [grid, setGrid] = useState<{ rowKey: string; product: EditorProduct; prefill?: GridLine | null } | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const set = <K extends keyof OrderInput>(k: K, v: OrderInput[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };
  const setRow = (key: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const addRow = (focus = true) => {
    const r = newRow(rows.at(-1)?.unit || defaultUnit);
    // Cria a linha e já leva o cursor para ela, sem atraso (quem digita rápido não perde letras).
    flushSync(() => setRows((rs) => [...rs, r]));
    setDirty(true);
    if (focus) focusProduct(r.key);
  };
  // Leva o cursor ao campo Produto visível da linha (grade no computador, cartão no celular).
  const focusProduct = (key: string, tries = 0) => {
    const el = [...document.querySelectorAll<HTMLInputElement>(`[data-row="${key}"] input[role="combobox"]`)].find(
      (i) => i.offsetParent !== null,
    );
    if (el) el.focus();
    else if (tries < 10) requestAnimationFrame(() => focusProduct(key, tries + 1));
  };
  const removeRow = (key: string) => {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [newRow(defaultUnit)]));
    setDirty(true);
  };

  // Aviso ao sair da página com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const customerOptions: ComboOption[] = useMemo(
    () =>
      customers.map((c) => ({
        id: c.id,
        label: c.name,
        sub: [[c.city, c.state].filter(Boolean).join("/"), c.cnpj].filter(Boolean).join(" · ") || undefined,
        search: `${c.name} ${c.cnpj ?? ""} ${c.city ?? ""}`,
      })),
    [customers],
  );

  const productOptions: ComboOption[] = useMemo(
    () =>
      products
        .filter((p) => !f.principal_id || p.principal_id === f.principal_id)
        .map((p) => ({
          id: p.id,
          label: p.name,
          sub: [p.code, units.find((u) => u.value === p.unit)?.label ?? p.unit].filter(Boolean).join(" · "),
          right: (() => {
            const price = p.tablePrice ?? lastPaid(p.id);
            const kinds = [...new Set(listsFor(p).map((l) => l.kind))];
            return price != null ? brl(price) : kinds.length ? kinds.join(" · ") : undefined;
          })(),
          search: `${p.name} ${p.code}`,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, f.principal_id, f.customer_id, units, principalLists],
  );

  const lines = rows.map((r) => ({ qty: num(r.qty), price: num(r.price), discount: num(r.discount) }));
  const t = orderTotals(lines, num(f.discount_pct), num(f.freight_value), num(f.commission_pct));
  const filledRows = rows.filter((r) => r.description.trim()).length;
  const principal = principals.find((p) => p.id === f.principal_id);

  // Um pedido é de uma representada só: ao trocar, saem os produtos do catálogo da outra.
  function pickPrincipal(id: string) {
    const p = principals.find((x) => x.id === id);
    const others = rows.filter((r) => {
      if (!r.variant_id) return false;
      const prod = products.find((x) => x.id === r.variant_id);
      return !!prod && prod.principal_id !== id;
    });
    if (others.length) {
      const ok = window.confirm(
        `Trocar para ${p?.name ?? "outra representada"}? ${others.length === 1 ? "O item da representada anterior sai" : `Os ${others.length} itens da representada anterior saem`} do pedido.`,
      );
      if (!ok) return;
      const out = new Set(others.map((r) => r.key));
      setRows((rs) => {
        const left = rs.filter((r) => !out.has(r.key));
        return left.length ? left : [newRow(defaultUnit)];
      });
    }
    setF((prev) => ({
      ...prev,
      principal_id: id,
      // RN2: a comissão padrão da representada é sugerida (e pode ser alterada).
      commission_pct: p?.commission != null ? numText(p.commission, 2) : prev.commission_pct,
    }));
    setDirty(true);
  }

  // Preços deste cliente no produto (vazio se ele nunca comprou: o preço fica em branco).
  function historyOf(variantId: string): [string, number][] {
    return (f.customer_id && priceHistory[f.customer_id]?.[variantId]) || [];
  }
  function lastPaid(variantId: string, options?: Record<string, string> | null): number | null {
    const h = historyOf(variantId);
    if (options === undefined) return h[0]?.[1] ?? null;
    return h.find(([o]) => o === optionsText(options))?.[1] ?? null;
  }
  // Preço base para a grade: tabela vigente, ou o último preço do cliente numa opção sem acréscimo.
  function basePriceOf(p: EditorProduct): number | null {
    if (p.tablePrice != null) return p.tablePrice;
    const plain = new Set(p.lists.flatMap((l) => l.values.filter((v) => !v.priceAdjust).map((v) => v.name)));
    for (const [o, price] of historyOf(p.id)) {
      const names = o ? o.split(" / ") : [];
      if (names.every((n) => plain.has(n))) return price;
    }
    return null;
  }

  function pickProduct(row: Row, id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (listsFor(p).length) {
      setGrid({ rowKey: row.key, product: p });
      return;
    }
    addPlain(row.key, p);
  }

  // Listas que o produto pode usar no pedido: as ligadas a ele e as da representada dele.
  function listsFor(p: EditorProduct): OptionList[] {
    const own = new Set(p.lists.map((l) => l.id));
    return [...p.lists, ...(principalLists[p.principal_id] ?? []).filter((l) => !own.has(l.id))];
  }

  // Produto sem cor/tamanho: uma linha comum.
  function addPlain(rowKey: string, p: EditorProduct) {
    const row = rows.find((r) => r.key === rowKey);
    if (!row) return;
    const suggested = p.tablePrice ?? lastPaid(p.id, null) ?? lastPaid(p.id);
    setRow(rowKey, {
      variant_id: p.id,
      options: null,
      code: p.code,
      description: p.name,
      unit: p.unit,
      price: suggested != null && !row.price ? priceText(suggested) : row.price,
      qty: row.qty || "1",
    });
  }

  // Cada opção com quantidade na grade vira uma linha do pedido, no lugar da linha em que o produto foi escolhido.
  function addFromGrid(lines: GridLine[]) {
    if (!grid) return;
    const p = grid.product;
    const made: Row[] = lines.map((l) => ({
      key: crypto.randomUUID(),
      variant_id: p.id,
      options: l.options,
      code: p.code,
      description: describeWithOptions(p.name, l.options),
      unit: p.unit,
      qty: l.qty,
      price: l.price,
      discount: "",
    }));
    setRows((rs) => {
      const i = rs.findIndex((r) => r.key === grid.rowKey);
      if (i < 0) return [...rs, ...made];
      return [...rs.slice(0, i), ...made, ...rs.slice(i + 1)];
    });
    setDirty(true);
    setGrid(null);
  }

  function submit(intent: "draft" | "send") {
    setError(null);
    if (!f.customer_id) {
      setError(customerText ? "Escolha o cliente na lista de sugestões." : "Escolha o cliente.");
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    start(async () => {
      const r = await saveOrder({ ...f, items: rows.map(({ key: _key, ...i }) => i) }, intent);
      if (r?.error) {
        setError(r.error);
        top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        setDirty(false);
      }
    });
  }

  const unitSelect = (row: Row, className: string) => (
    <select
      value={row.unit}
      onChange={(e) => setRow(row.key, { unit: e.target.value })}
      aria-label="Unidade"
      className={className}
    >
      {units.some((u) => u.value === row.unit) ? null : <option value={row.unit}>{row.unit}</option>}
      {units.map((u) => (
        <option key={u.value} value={u.value}>
          {u.label}
        </option>
      ))}
    </select>
  );

  const productField = (row: Row, className: string) => (
    <Combobox
      value={row.description}
      onText={(text) => setRow(row.key, { description: text, variant_id: null, options: null })}
      onSelect={(o) => pickProduct(row, o.id)}
      options={productOptions}
      openOnFocus={productOptions.length > 0}
      placeholder={productOptions.length ? "Buscar no catálogo ou digitar" : "Descrição do produto"}
      ariaLabel="Produto"
      emptyText="Nada no catálogo. O texto digitado vira a descrição do item."
      className={className}
    />
  );

  // Botão para abrir a grade de cores/tamanhos da linha (produto do catálogo com listas).
  const gridButton = (row: Row, className: string) => {
    const p = row.variant_id ? products.find((x) => x.id === row.variant_id) : null;
    if (!p || !listsFor(p).length) return null;
    const kind = listsFor(p)[0].kind;
    return (
      <button
        type="button"
        onClick={() =>
          setGrid({
            rowKey: row.key,
            product: p,
            prefill: row.options ? { options: row.options, qty: row.qty, price: row.price } : null,
          })
        }
        title={`Escolher ${kind.toLowerCase()} na grade`}
        className={className}
      >
        <Icon name="grid" size={14} />
        <span>{row.options ? "Trocar" : kind}</span>
      </button>
    );
  };

  const lastKeyEnter = (row: Row, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (row.key === rows.at(-1)?.key) addRow();
    }
  };

  return (
    <div ref={top} className="scroll-mt-24">
      {error ? (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <div className="grid gap-5">
        {/* ---------- Dados do pedido ---------- */}
        <section className="rounded-xl border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">Dados do pedido</h2>
            {showCommission && principal?.commission != null ? (
              <span className="text-xs text-muted">Comissão padrão de {principal.name}: {numText(principal.commission, 2)}%</span>
            ) : null}
          </header>
          <div className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-5 lg:grid-cols-4">
            <div className="col-span-2">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Cliente</span>
              <Combobox
                value={customerText}
                onText={(text) => {
                  setCustomerText(text);
                  set("customer_id", "");
                }}
                onSelect={(o) => {
                  const c = customers.find((x) => x.id === o.id);
                  setCustomerText(o.label);
                  set("customer_id", o.id);
                  // O vendedor padrão do cliente vem junto (e pode ser trocado).
                  if (c?.seller_id && sellers.some((s) => s.id === c.seller_id)) set("seller_id", c.seller_id);
                  // Sugere a representada da última compra do cliente (se a pessoa não escolheu outra à mão).
                  if (c?.last_principal_id && (!f.principal_id || principalAuto)) {
                    pickPrincipal(c.last_principal_id);
                    setPrincipalAuto(true);
                  }
                }}
                options={customerOptions}
                placeholder="Buscar por nome, CNPJ ou cidade"
                ariaLabel="Cliente"
                emptyText="Nenhum cliente com esse nome."
                footer={
                  <Link
                    href="/clientes?novo=1"
                    target="_blank"
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium text-pen hover:bg-pen-soft"
                  >
                    <Icon name="plus" size={14} strokeWidth={2} />
                    Cadastrar novo cliente
                  </Link>
                }
                className={`${inputCls} ${customerText && !f.customer_id ? "!border-warn" : ""}`}
              />
            </div>
            <Field label="Representada" className="col-span-2 lg:col-span-1">
              <select
                value={f.principal_id}
                onChange={(e) => {
                  pickPrincipal(e.target.value);
                  setPrincipalAuto(false);
                }}
                className={inputCls}
              >
                <option value="" disabled>
                  Escolha
                </option>
                {principals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {principalAuto ? <span className="mt-1.5 block text-xs text-muted">Sugerida pela última compra do cliente.</span> : null}
            </Field>
            {sellers.length ? (
              <Field label="Vendedor" className="col-span-2 lg:col-span-1">
                <select value={f.seller_id ?? ""} onChange={(e) => set("seller_id", e.target.value)} className={inputCls}>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Data">
              <input type="date" value={f.order_date} onChange={(e) => set("order_date", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Previsão de entrega">
              <input type="date" value={f.expected_delivery} onChange={(e) => set("expected_delivery", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Condição de pagamento" className="col-span-2 lg:col-span-1">
              <input
                list="payment-terms"
                value={f.payment_terms}
                onChange={(e) => set("payment_terms", e.target.value)}
                placeholder="Ex.: 30/60/90 dias"
                className={inputCls}
              />
              <datalist id="payment-terms">
                {PAYMENT_TERMS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Frete">
              <select value={f.freight_mode} onChange={(e) => set("freight_mode", e.target.value)} className={inputCls}>
                <option value="">Não informado</option>
                <option value="cif">CIF (fábrica paga)</option>
                <option value="fob">FOB (cliente paga)</option>
              </select>
            </Field>
            <Field label="Valor do frete">
              <input
                inputMode="decimal"
                value={f.freight_value}
                onChange={(e) => set("freight_value", e.target.value)}
                placeholder="0,00"
                className={`${inputCls} text-right tabular-nums`}
              />
            </Field>
          </div>
        </section>

        {/* ---------- Itens (só depois de escolher a representada) ---------- */}
        {!f.principal_id ? (
          <section className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface px-5 py-6 text-sm text-muted">
            <Icon name="factory" size={18} />
            Escolha a representada para lançar os itens. Um pedido tem produtos de uma representada só.
          </section>
        ) : (
        <section className="rounded-xl border border-line bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold">
                Itens <span className="ml-1 font-normal text-muted">{filledRows}</span>
              </h2>
              <p className="mt-0.5 hidden text-xs text-muted sm:block">
                Busque no catálogo ou digite à mão. Enter no último campo abre uma nova linha.
              </p>
            </div>
            <button type="button" onClick={() => addRow()} className={ghostBtn}>
              <Icon name="plus" size={15} strokeWidth={2} />
              Item
            </button>
          </header>

          {/* Computador: grade editável */}
          <div className="hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-line bg-subtle text-xs text-muted">
                <tr>
                  <th className="w-10 py-2 pl-5 text-left font-medium">#</th>
                  <th className="w-28 px-1 py-2 text-left font-medium">Código</th>
                  <th className="px-1 py-2 text-left font-medium">Produto</th>
                  <th className="w-28 px-1 py-2 text-left font-medium">Unid.</th>
                  <th className="w-24 px-1 py-2 text-right font-medium">Qtd.</th>
                  <th className="w-28 px-1 py-2 text-right font-medium">Preço unit.</th>
                  <th className="w-20 px-1 py-2 text-right font-medium">Desc. %</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Total</th>
                  <th className="w-12 pr-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const lt = lineTotals(lines[i]);
                  return (
                    <tr key={row.key} className="group border-b border-line last:border-b-0 hover:bg-subtle/60">
                      <td className="py-1.5 pl-5 text-xs tabular-nums text-faint">{i + 1}</td>
                      <td className="px-1 py-1.5">
                        <input
                          value={row.code}
                          onChange={(e) => setRow(row.key, { code: e.target.value })}
                          aria-label="Código"
                          className={`${cell} font-mono text-[13px]`}
                        />
                      </td>
                      <td className="px-1 py-1.5" data-row={row.key}>
                        <div className="flex items-center gap-1">
                          <div className="min-w-0 flex-1">{productField(row, cell)}</div>
                          {gridButton(
                            row,
                            "inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-line px-2 text-xs font-medium text-ink-2 hover:bg-hover hover:text-ink",
                          )}
                        </div>
                      </td>
                      <td className="px-1 py-1.5">{unitSelect(row, `${cell} pr-6`)}</td>
                      <td className="px-1 py-1.5">
                        <input
                          inputMode="decimal"
                          value={row.qty}
                          onChange={(e) => setRow(row.key, { qty: e.target.value })}
                          aria-label="Quantidade"
                          className={`${cell} text-right tabular-nums`}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          inputMode="decimal"
                          value={row.price}
                          onChange={(e) => setRow(row.key, { price: e.target.value })}
                          aria-label="Preço unitário"
                          placeholder="0,00"
                          className={`${cell} text-right tabular-nums`}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          inputMode="decimal"
                          value={row.discount}
                          onChange={(e) => setRow(row.key, { discount: e.target.value })}
                          onKeyDown={(e) => lastKeyEnter(row, e)}
                          aria-label="Desconto %"
                          placeholder="0"
                          className={`${cell} text-right tabular-nums`}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                        {lt.total ? brl(lt.total) : <span className="text-faint">—</span>}
                      </td>
                      <td className="pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          aria-label={`Remover item ${i + 1}`}
                          className={`${iconBtn} opacity-0 focus:opacity-100 group-hover:opacity-100`}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => addRow()}
              className="flex w-full items-center gap-2 border-t border-dashed border-line px-5 py-3 text-[13px] text-muted transition hover:bg-subtle hover:text-pen"
            >
              <Icon name="plus" size={14} strokeWidth={2} />
              Adicionar item
            </button>
          </div>

          {/* Celular: um cartão por item */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((row, i) => {
              const lt = lineTotals(lines[i]);
              return (
                <li key={row.key} data-row={row.key} className="grid gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">Item {i + 1}</span>
                    <button type="button" onClick={() => removeRow(row.key)} className={`${iconBtn} -mr-2 -mt-1`} aria-label={`Remover item ${i + 1}`}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                  {productField(row, inputCls)}
                  {gridButton(row, `${ghostBtn} w-full`)}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Código">
                      <input value={row.code} onChange={(e) => setRow(row.key, { code: e.target.value })} className={`${inputCls} font-mono`} />
                    </Field>
                    <Field label="Unidade">{unitSelect(row, inputCls)}</Field>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Qtd.">
                      <input inputMode="decimal" value={row.qty} onChange={(e) => setRow(row.key, { qty: e.target.value })} className={`${inputCls} text-right tabular-nums`} />
                    </Field>
                    <Field label="Preço">
                      <input inputMode="decimal" value={row.price} onChange={(e) => setRow(row.key, { price: e.target.value })} placeholder="0,00" className={`${inputCls} text-right tabular-nums`} />
                    </Field>
                    <Field label="Desc. %">
                      <input inputMode="decimal" value={row.discount} onChange={(e) => setRow(row.key, { discount: e.target.value })} placeholder="0" className={`${inputCls} text-right tabular-nums`} />
                    </Field>
                  </div>
                  <p className="flex items-center justify-between rounded-lg bg-subtle px-3 py-2 text-sm">
                    <span className="text-muted">Total do item</span>
                    <span className="font-semibold tabular-nums">{brl(lt.total)}</span>
                  </p>
                </li>
              );
            })}
            <li className="p-4">
              <button type="button" onClick={() => addRow()} className={`${ghostBtn} w-full`}>
                <Icon name="plus" size={16} strokeWidth={2} />
                Adicionar item
              </button>
            </li>
          </ul>
        </section>
        )}

        {/* ---------- Observações e resumo ---------- */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <Field label="Observações" hint="Aparecem no pedido impresso. Ex.: entregar pela manhã, embalar separado.">
              <textarea rows={5} value={f.notes} onChange={(e) => set("notes", e.target.value)} className={textareaCls} />
            </Field>
          </section>

          <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold">Resumo</h2>
            <dl className="grid gap-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">
                  {filledRows} {filledRows === 1 ? "item" : "itens"} · {numText(t.qty, 3)} un.
                </dt>
                <dd className="tabular-nums">{brl(t.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-muted">
                  Desconto geral
                  <span className="relative">
                    <input
                      inputMode="decimal"
                      value={f.discount_pct}
                      onChange={(e) => set("discount_pct", e.target.value)}
                      aria-label="Desconto geral em %"
                      placeholder="0"
                      className="h-8 w-16 rounded-md border border-line-strong bg-surface pl-2 pr-5 text-right text-sm tabular-nums outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/25"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">%</span>
                  </span>
                </dt>
                <dd className="tabular-nums text-ink-2">{t.discountValue ? `− ${brl(t.discountValue)}` : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Frete{f.freight_mode ? ` (${f.freight_mode.toUpperCase()})` : ""}</dt>
                <dd className="tabular-nums text-ink-2">{num(f.freight_value) ? brl(num(f.freight_value)) : "—"}</dd>
              </div>
              <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-medium">Total do pedido</dt>
                <dd className="text-xl font-semibold tabular-nums tracking-[-0.02em]">{brl(t.total)}</dd>
              </div>
            </dl>

            {showCommission ? (
            <div className="mt-4 border-t border-line pt-3">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="commission" className="text-[13px] text-muted">
                  % Comissão
                  <span className="block text-[11px] text-faint">Usada quando o pedido for faturado</span>
                </label>
                <span className="relative">
                  <input
                    id="commission"
                    inputMode="decimal"
                    value={f.commission_pct}
                    onChange={(e) => set("commission_pct", e.target.value)}
                    placeholder="0"
                    className="h-8 w-20 rounded-md border border-line-strong bg-surface pl-2 pr-5 text-right text-sm tabular-nums outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/25"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">%</span>
                </span>
              </div>
            </div>
            ) : null}
          </section>
        </div>
      </div>

      {grid ? (
        <OptionGrid
          productName={grid.product.name}
          available={listsFor(grid.product)}
          initial={grid.product.lists}
          prefill={grid.prefill}
          suggest={(o) => (grid.product.tablePrice != null ? null : lastPaid(grid.product.id, o))}
          basePrice={basePriceOf(grid.product)}
          onConfirm={addFromGrid}
          onPlain={() => {
            addPlain(grid.rowKey, grid.product);
            setGrid(null);
          }}
          onClose={() => setGrid(null)}
        />
      ) : null}

      <SaveBar
        note={
          <span className="flex items-baseline gap-2">
            <span className="hidden sm:inline">Total</span>
            <span className="text-base font-semibold tabular-nums text-ink">{brl(t.total)}</span>
            {dirty ? <span className="hidden text-xs text-warn md:inline">· alterações não salvas</span> : null}
          </span>
        }
      >
        {sentEdit ? (
          <>
            <Link href={sentEdit.cancelHref} className={ghostBtn}>
              Cancelar
            </Link>
            <button type="button" disabled={pending} onClick={() => submit("draft")} className={primaryBtn}>
              {pending ? "Salvando…" : "Salvar alterações"}
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={pending} onClick={() => submit("draft")} className={ghostBtn}>
              {pending ? "Salvando…" : "Salvar rascunho"}
            </button>
            <button type="button" disabled={pending} onClick={() => submit("send")} className={primaryBtn}>
              <Icon name="send" size={15} />
              <span className="sm:hidden">Enviar</span>
              <span className="hidden sm:inline">Salvar e enviar</span>
            </button>
          </>
        )}
      </SaveBar>
    </div>
  );
}

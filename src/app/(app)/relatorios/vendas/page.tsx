import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { resolvePeriod } from "@/lib/cockpit";
import { loadSales, loadSalesDetail, parseSalesSort, sortSalesRows, type SalesBy, type SalesSortKey } from "@/lib/reports";
import { formatOrderNumber, qtyText, statusInfo } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { unitLabel } from "@/lib/units";
import { Sheet } from "@/components/sheet";
import { brl, formatDate, pct, todayISO, rangeText } from "@/lib/format";
import { CockpitShell } from "@/components/cockpit/filters";
import { Icon } from "@/components/icons";
import { PageHeader, Badge, ghostBtn, quietBtn, primaryBtn } from "@/components/ui";

const BY: { value: SalesBy; label: string; title: string; col: string }[] = [
  { value: "vendedor", label: "Por vendedor", title: "Vendas por vendedor", col: "Vendedor" },
  { value: "cliente", label: "Por cliente (ABC)", title: "Vendas por cliente", col: "Cliente" },
  { value: "representada", label: "Por representada", title: "Vendas por representada", col: "Representada" },
  { value: "produto", label: "Produtos", title: "Produtos mais vendidos", col: "Produto" },
];

// Vendas do período (pedidos enviados ou faturados), agrupadas.
export default async function SalesReport({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; rep?: string; por?: string; ordem?: string; dir?: string; detalhe?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, isBackOffice } = await getContext();
  if (!isBackOffice) redirect("/");
  const by = (BY.find((b) => b.value === sp.por) ?? BY[0]).value;
  const def = BY.find((b) => b.value === by)!;
  const P = resolvePeriod(sp.periodo, sp.de, sp.ate, todayISO());
  // Ordem pelo título da coluna clicado (?ordem=&dir=). A curva ABC segue o peso quando a ordem é por peso.
  const sort = parseSalesSort(sp.ordem, sp.dir);
  const base = Object.entries({ periodo: sp.periodo, de: sp.de, ate: sp.ate, rep: sp.rep }).filter(([, v]) => v) as [string, string][];
  const sortPairs: [string, string][] = [["ordem", sort.key], ["dir", sort.dir]];
  const params = new URLSearchParams([...base, ["por", by], ...sortPairs]);
  const tab = (v: SalesBy) => `/relatorios/vendas?${new URLSearchParams([...base, ["por", v]])}`;
  // Clicar no título: ordena por essa coluna (maior primeiro); clicar de novo inverte.
  const sortHref = (k: SalesSortKey) => {
    const dir = sort.key === k ? (sort.dir === "desc" ? "asc" : "desc") : k === "nome" ? "asc" : "desc";
    return `/relatorios/vendas?${new URLSearchParams([...base, ["por", by], ["ordem", k], ["dir", dir]])}`;
  };
  const Th = ({ k, label, align = "right", className = "" }: { k: SalesSortKey; label: string; align?: "left" | "right"; className?: string }) => (
    <th className={`py-2 font-medium ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      <Link href={sortHref(k)} scroll={false} className={`inline-flex items-center gap-1 hover:text-ink ${sort.key === k ? "text-ink" : ""}`}>
        {label}
        {sort.key === k ? <span aria-hidden>{sort.dir === "desc" ? "↓" : "↑"}</span> : null}
      </Link>
    </th>
  );

  const [{ rows: loaded, total, avgPct, showWeight }, { data: principals }] = await Promise.all([
    loadSales(P, by, sp.rep, sort.key === "peso" ? "comissao" : "valor"),
    supabase.from("principals").select("id, name").order("name"),
  ]);
  const rows = sortSalesRows(loaded, sort.key, sort.dir);

  // Painel com os pedidos da linha clicada (?detalhe=chave).
  const here = `/relatorios/vendas?${params}`;
  const detailHref = (key: string) => `${here}&detalhe=${encodeURIComponent(key)}`;
  const picked = sp.detalhe ? rows.find((r) => r.key === sp.detalhe) : undefined;
  const [detail, settings] = await Promise.all([picked ? loadSalesDetail(P, by, picked.key, sp.rep) : Promise.resolve([]), getSettings()]);
  const orderLabel = (n: number) => formatOrderNumber(n, settings);
  const orders = by === "produto" ? null : rows.reduce((s, r) => s + r.orders, 0);

  return (
    <>
      <PageHeader
        title={def.title}
        back={{ href: "/relatorios", label: "Relatórios" }}
        action={
          <div className="flex items-center gap-2">
            <a href={`/relatorios/planilha?r=vendas&${params}`} className={quietBtn} title="Baixar em Excel">
              <Icon name="download" size={15} />
              Planilha
            </a>
            <a href={`/imprimir/relatorio?r=vendas&${params}&auto=1`} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
              <Icon name="printer" size={15} />
              Imprimir / PDF
            </a>
          </div>
        }
      />
      <nav className="-mt-3 mb-4 flex flex-wrap gap-1.5">
        {BY.map((b) => (
          <Link
            key={b.value}
            href={tab(b.value)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${b.value === by ? "bg-ink text-on-ink" : "text-ink-2 hover:bg-hover"}`}
          >
            {b.label}
          </Link>
        ))}
      </nav>
      <CockpitShell principals={(principals ?? []).map((p) => ({ value: p.id, label: p.name }))} sellers={null} periodLabel={rangeText(P.start, P.end)} compareLabel="Pedidos enviados e faturados, pela data do pedido">
        <dl
          className={`mb-5 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line [&>div]:bg-surface [&>div]:p-4 ${
            ["md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-4"][(showWeight ? 1 : 0) + (orders != null ? 1 : 0)]
          }`}
          style={{ gap: 1 }}
        >
          <div>
            <dt className="text-[13px] text-muted">Vendido</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{brl(total)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">{def.col === "Produto" ? "Produtos diferentes" : `${def.col}s`}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{rows.length}</dd>
          </div>
          {showWeight ? (
            <div>
              <dt className="text-[13px] text-muted">% médio de comissão</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{pct(avgPct)}</dd>
            </div>
          ) : null}
          {orders != null ? (
            <div>
              <dt className="text-[13px] text-muted">Ticket médio por pedido</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{brl(orders ? total / orders : 0)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead className="bg-subtle text-xs text-muted">
                <tr>
                  <th className="w-10 py-2 pl-5 text-left font-medium">#</th>
                  <Th k="nome" label={def.col} align="left" className="px-3" />
                  {by === "cliente" ? <th className="px-3 py-2 text-center font-medium">Curva</th> : null}
                  {by === "produto" ? <Th k="qtd" label="Quantidade" className="px-3" /> : <Th k="pedidos" label="Pedidos" className="px-3" />}
                  <Th k="valor" label="Valor" className="px-3" />
                  <Th k="participacao" label="Participação" className="px-3" />
                  {showWeight ? (
                    <>
                      <Th k="peso" label="Peso" className="px-3" />
                      <Th k="medio" label="% médio" className="pl-3 pr-5" />
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 500).map((r, n) => (
                  <tr key={r.key}>
                    <td className="py-2.5 pl-5 text-xs tabular-nums text-faint">{n + 1}</td>
                    <td className="px-3 py-2.5">
                      <Link href={detailHref(r.key)} scroll={false} className="font-medium hover:text-accent-ink hover:underline">
                        {r.name || "—"}
                      </Link>
                      {r.sub ? <span className="block text-xs text-muted">{r.sub}</span> : null}
                    </td>
                    {by === "cliente" ? (
                      <td className="px-3 py-2.5 text-center">
                        <Badge tone={r.abc === "A" ? "ok" : r.abc === "B" ? "info" : "neutral"}>{r.abc}</Badge>
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 text-right tabular-nums">{by === "produto" ? qtyText(r.qty ?? 0) : r.orders}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{brl(r.value)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{pct((r.value / (total || 1)) * 100)}</td>
                    {showWeight ? (
                      <>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums">{pct(r.weight * 100)}</td>
                        <td className="py-2.5 pl-3 pr-5 text-right tabular-nums text-ink-2">{pct(r.avgPct)}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-8 text-center text-muted">
                      Nenhuma venda no período.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {rows.length > 500 ? <p className="border-t border-line px-5 py-2 text-xs text-muted">Mostrando os 500 primeiros. A planilha tem todos.</p> : null}
        </div>
      </CockpitShell>

      {/* Pedidos da linha clicada */}
      <Sheet
        open={!!picked}
        size="lg"
        title={picked?.name || "Pedidos"}
        description={`${detail.length} ${detail.length === 1 ? (by === "produto" ? "item vendido" : "pedido") : by === "produto" ? "itens vendidos" : "pedidos"} · ${rangeText(P.start, P.end)}`}
        closeHref={here}
      >
        <div className="scroll-thin min-h-0 flex-1 overflow-auto px-5 pb-5">
          <table className="w-full min-w-[40rem] text-[13px]">
            <thead className="sticky top-0 bg-sheet text-[11px] text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-2 text-left font-medium">Pedido</th>
                {by === "produto" ? null : <th className="px-2 py-2 text-left font-medium">Data</th>}
                {by !== "cliente" ? <th className="px-2 py-2 text-left font-medium">Cliente</th> : null}
                {by === "produto" ? <th className="px-2 py-2 text-left font-medium">Produto</th> : null}
                {by === "cliente" || by === "vendedor" ? <th className="px-2 py-2 text-left font-medium">Representada</th> : null}
                {by === "cliente" || by === "representada" ? <th className="px-2 py-2 text-left font-medium">Vendedor</th> : null}
                {by === "produto" ? (
                  <>
                    <th className="px-2 py-2 text-right font-medium">Quantidade</th>
                    <th className="px-2 py-2 text-right font-medium">Valor unit.</th>
                    <th className="px-2 py-2 text-right font-medium">Total do item</th>
                  </>
                ) : (
                  <th className="px-2 py-2 text-left font-medium">Situação</th>
                )}
                <th className="py-2 pl-2 text-right font-medium">Valor do pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {detail.map((d, n) => (
                <tr key={`${d.orderId}-${n}`} className="align-top">
                  <td className="py-2 pr-2">
                    <Link href={`/pedidos/${d.orderId}`} className="font-mono font-medium text-accent-ink hover:underline">
                      {orderLabel(d.number)}
                    </Link>
                    {by === "produto" ? <span className="block text-[11px] text-muted">{formatDate(d.date)}</span> : null}
                  </td>
                  {by === "produto" ? null : <td className="px-2 py-2 tabular-nums">{formatDate(d.date)}</td>}
                  {by !== "cliente" ? <td className="max-w-[16rem] truncate px-2 py-2">{d.customer}</td> : null}
                  {by === "produto" ? <td className="px-2 py-2">{d.product}</td> : null}
                  {by === "cliente" || by === "vendedor" ? <td className="px-2 py-2 text-ink-2">{d.principal}</td> : null}
                  {by === "cliente" || by === "representada" ? <td className="px-2 py-2 text-ink-2">{d.seller}</td> : null}
                  {by === "produto" ? (
                    <>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                        {qtyText(d.qty ?? 0)} <span className="text-muted">{unitLabel(d.unit ?? "").toLowerCase()}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{brl(d.unitPrice ?? 0)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{brl(d.lineTotal ?? 0)}</td>
                    </>
                  ) : (
                    <td className="px-2 py-2">
                      <Badge tone={statusInfo(d.status).tone}>{statusInfo(d.status).label}</Badge>
                    </td>
                  )}
                  <td className="whitespace-nowrap py-2 pl-2 text-right font-medium tabular-nums">{brl(d.orderTotal)}</td>
                </tr>
              ))}
            </tbody>
            {detail.length ? (
              <tfoot className="border-t border-line-strong font-semibold">
                <tr>
                  <td className="py-2 pr-2" colSpan={by === "produto" ? 3 : 4}>
                    Total
                  </td>
                  {by === "produto" ? (
                    <>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{qtyText(detail.reduce((s, d) => s + (d.qty ?? 0), 0))}</td>
                      <td />
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{brl(detail.reduce((s, d) => s + (d.lineTotal ?? 0), 0))}</td>
                      <td />
                    </>
                  ) : (
                    <>
                      <td />
                      <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">{brl(detail.reduce((s, d) => s + d.orderTotal, 0))}</td>
                    </>
                  )}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </Sheet>

    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { resolvePeriod } from "@/lib/cockpit";
import { loadSales, type SalesBy, type SalesSort } from "@/lib/reports";
import { ruleText } from "@/lib/seller-payout";
import { qtyText } from "@/lib/orders";
import { brl, pct, todayISO } from "@/lib/format";
import { CockpitShell } from "@/components/cockpit/filters";
import { Icon } from "@/components/icons";
import { PageHeader, Badge, ghostBtn } from "@/components/ui";

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
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; rep?: string; por?: string; ordem?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, isBackOffice } = await getContext();
  if (!isBackOffice) redirect("/");
  const by = (BY.find((b) => b.value === sp.por) ?? BY[0]).value;
  const def = BY.find((b) => b.value === by)!;
  const P = resolvePeriod(sp.periodo, sp.de, sp.ate, todayISO());
  const sort: SalesSort = sp.ordem === "comissao" ? "comissao" : "valor";
  const base = Object.entries({ periodo: sp.periodo, de: sp.de, ate: sp.ate, rep: sp.rep }).filter(([, v]) => v) as [string, string][];
  const withSort = (list: [string, string][]) => (sort === "comissao" ? [...list, ["ordem", "comissao"] as [string, string]] : list);
  const params = new URLSearchParams(withSort([...base, ["por", by]]));
  const tab = (v: SalesBy) => `/relatorios/vendas?${new URLSearchParams(withSort([...base, ["por", v]]))}`;
  const sortHref = (o: SalesSort) =>
    `/relatorios/vendas?${new URLSearchParams([...base, ["por", by], ...(o === "comissao" ? [["ordem", "comissao"] as [string, string]] : [])])}`;

  const [{ rows, total, totalCommission, showCommission }, { data: principals }] = await Promise.all([
    loadSales(P, by, sp.rep, sort),
    supabase.from("principals").select("id, name").order("name"),
  ]);
  const orders = by === "produto" ? null : rows.reduce((s, r) => s + r.orders, 0);

  return (
    <>
      <PageHeader
        title={def.title}
        back={{ href: "/relatorios", label: "Relatórios" }}
        action={
          <a href={`/relatorios/planilha?r=vendas&${params}`} className={ghostBtn}>
            <Icon name="download" size={15} />
            Baixar planilha
          </a>
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
      {showCommission ? (
        <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">Ordenar e calcular a curva por</span>
          {(["valor", "comissao"] as SalesSort[]).map((o) => (
            <Link
              key={o}
              href={sortHref(o)}
              className={`rounded-md border px-2.5 py-1 font-medium transition ${o === sort ? "border-ink bg-ink text-on-ink" : "border-line-strong text-ink-2 hover:bg-hover"}`}
            >
              {o === "valor" ? "Valor vendido" : "Comissão (resultado)"}
            </Link>
          ))}
        </div>
      ) : null}
      <CockpitShell principals={(principals ?? []).map((p) => ({ value: p.id, label: p.name }))} sellers={null} periodLabel={P.label} compareLabel="Pedidos enviados e faturados, pela data do pedido">
        <dl className="mb-5 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4 [&>div]:bg-surface [&>div]:p-4" style={{ gap: 1 }}>
          <div>
            <dt className="text-[13px] text-muted">Vendido</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{brl(total)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">{def.col === "Produto" ? "Produtos diferentes" : `${def.col}s`}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{rows.length}</dd>
          </div>
          {showCommission ? (
            <div>
              <dt className="text-[13px] text-muted">Comissão gerada</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">
                {brl(totalCommission)} <span className="text-xs font-normal text-muted">{pct(total ? (totalCommission / total) * 100 : 0)} médio</span>
              </dd>
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
                  <th className="px-3 py-2 text-left font-medium">{def.col}</th>
                  {by === "cliente" ? <th className="px-3 py-2 text-center font-medium">Curva</th> : null}
                  {by === "produto" ? <th className="px-3 py-2 text-right font-medium">Quantidade</th> : <th className="px-3 py-2 text-right font-medium">Pedidos</th>}
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  {showCommission ? (
                    <>
                      <th className="px-3 py-2 text-right font-medium">Comissão</th>
                      <th className="px-3 py-2 text-right font-medium">% médio</th>
                    </>
                  ) : null}
                  {showCommission && by === "vendedor" ? (
                    <>
                      <th className="px-3 py-2 text-right font-medium">Repasse estimado</th>
                      <th className="px-3 py-2 text-right font-medium">Fica no escritório</th>
                    </>
                  ) : null}
                  <th className="py-2 pl-3 pr-5 text-right font-medium">Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 500).map((r, n) => (
                  <tr key={r.key}>
                    <td className="py-2.5 pl-5 text-xs tabular-nums text-faint">{n + 1}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{r.name || "—"}</span>
                      {r.sub ? <span className="block text-xs text-muted">{r.sub}</span> : null}
                    </td>
                    {by === "cliente" ? (
                      <td className="px-3 py-2.5 text-center">
                        <Badge tone={r.abc === "A" ? "ok" : r.abc === "B" ? "info" : "neutral"}>{r.abc}</Badge>
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 text-right tabular-nums">{by === "produto" ? qtyText(r.qty ?? 0) : r.orders}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{brl(r.value)}</td>
                    {showCommission ? (
                      <>
                        <td className="px-3 py-2.5 text-right tabular-nums">{brl(r.commission)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{pct(r.avgPct)}</td>
                      </>
                    ) : null}
                    {showCommission && by === "vendedor" ? (
                      <>
                        <td className="px-3 py-2.5 text-right tabular-nums" title={ruleText(r.rule ?? null, (n) => pct(n))}>
                          {r.rule ? brl(r.payout ?? 0) : <span className="text-xs text-warn">sem regra</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {brl(r.office ?? 0)}
                          {r.commission ? <span className="block text-[11px] text-muted">{pct(((r.office ?? 0) / r.commission) * 100)} da comissão</span> : null}
                        </td>
                      </>
                    ) : null}
                    <td className="py-2.5 pl-3 pr-5 text-right tabular-nums text-ink-2">{pct(r.share * 100)}</td>
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
    </>
  );
}

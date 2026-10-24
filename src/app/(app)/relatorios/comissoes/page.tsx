import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { resolvePeriod } from "@/lib/cockpit";
import Link from "next/link";
import { loadCommissionDetail, loadCommissionsByPrincipal } from "@/lib/reports";
import { formatOrderNumber } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { Sheet } from "@/components/sheet";
import { brl, formatDate, todayISO, rangeText } from "@/lib/format";
import { CockpitShell } from "@/components/cockpit/filters";
import { Icon } from "@/components/icons";
import { PageHeader, ghostBtn, quietBtn, primaryBtn } from "@/components/ui";

// Comissões por representada: previsto (vence no período), recebido (entrou no período), em aberto e atrasado.
export default async function CommissionReport({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; rep?: string; detalhe?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, canSeeCommissions } = await getContext();
  if (!canSeeCommissions) redirect("/relatorios");
  const today = todayISO();
  const P = resolvePeriod(sp.periodo, sp.de, sp.ate, today);
  const params = new URLSearchParams(Object.entries({ periodo: sp.periodo, de: sp.de, ate: sp.ate, rep: sp.rep }).filter(([, v]) => v) as [string, string][]);

  const [{ rows: all }, { data: principals }] = await Promise.all([
    loadCommissionsByPrincipal(P, today),
    supabase.from("principals").select("id, name").order("name"),
  ]);
  const rows = sp.rep ? all.filter((r) => r.id === sp.rep) : all;
  const sum = (k: "expected" | "received" | "open" | "late") => rows.reduce((s, r) => s + r[k], 0);

  // Painel com as comissões da representada clicada (?detalhe=id).
  const here = `/relatorios/comissoes${params.toString() ? `?${params}` : ""}`;
  const detailHref = (id: string) => `${here}${here.includes("?") ? "&" : "?"}detalhe=${id}`;
  const picked = sp.detalhe ? rows.find((r) => r.id === sp.detalhe) : undefined;
  const [detail, settings] = await Promise.all([picked ? loadCommissionDetail(P, picked.id) : Promise.resolve([]), getSettings()]);
  const STATUS: Record<string, string> = { a_receber: "A receber", recebida: "Recebida", encerrada: "Encerrada" };

  return (
    <>
      <PageHeader
        title="Comissões por representada"
        back={{ href: "/relatorios", label: "Relatórios" }}
        hint="Previsto: comissões que vencem no período. Recebido: o que entrou no período. Em aberto e atrasado: o que falta receber dessas comissões."
        action={
          <div className="flex items-center gap-2">
            <a href={`/relatorios/planilha?r=comissoes&${params}`} className={quietBtn} title="Baixar em Excel">
              <Icon name="download" size={15} />
              Planilha
            </a>
            <a href={`/imprimir/relatorio?r=comissoes&${params}&auto=1`} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
              <Icon name="printer" size={15} />
              Imprimir / PDF
            </a>
          </div>
        }
      />
      <CockpitShell principals={(principals ?? []).map((p) => ({ value: p.id, label: p.name }))} sellers={null} periodLabel={rangeText(P.start, P.end)} compareLabel="Pelo vencimento da comissão">
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-subtle text-xs text-muted">
                <tr>
                  <th className="py-2 pl-5 text-left font-medium">Representada</th>
                  <th className="px-3 py-2 text-right font-medium">Comissões</th>
                  <th className="px-3 py-2 text-right font-medium">Previsto</th>
                  <th className="px-3 py-2 text-right font-medium">Recebido</th>
                  <th className="px-3 py-2 text-right font-medium">Em aberto</th>
                  <th className="py-2 pl-3 pr-5 text-right font-medium">Atrasado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pl-5 font-medium">
                      <Link href={detailHref(r.id)} scroll={false} className="hover:text-accent-ink hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{r.count}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{brl(r.expected)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ok">{brl(r.received)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{brl(r.open)}</td>
                    <td className={`py-2.5 pl-3 pr-5 text-right tabular-nums ${r.late ? "font-medium text-alert" : "text-faint"}`}>{brl(r.late)}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted">
                      Nenhuma comissão no período.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {rows.length ? (
                <tfoot className="border-t border-line-strong bg-subtle font-semibold">
                  <tr>
                    <td className="py-2.5 pl-5">Total</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{rows.reduce((s, r) => s + r.count, 0)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{brl(sum("expected"))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{brl(sum("received"))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{brl(sum("open"))}</td>
                    <td className="py-2.5 pl-3 pr-5 text-right tabular-nums">{brl(sum("late"))}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      </CockpitShell>

      <Sheet
        open={!!picked}
        size="lg"
        title={picked ? `Comissões · ${picked.name}` : "Comissões"}
        description={`${detail.length} ${detail.length === 1 ? "comissão vence" : "comissões vencem"} ${rangeText(P.start, P.end)}`}
        closeHref={here}
      >
        <div className="scroll-thin min-h-0 flex-1 overflow-auto px-5 pb-5">
          <table className="w-full min-w-[36rem] text-[13px]">
            <thead className="sticky top-0 bg-sheet text-[11px] text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-2 text-left font-medium">Pedido</th>
                <th className="px-2 py-2 text-left font-medium">NF</th>
                <th className="px-2 py-2 text-left font-medium">Cliente</th>
                <th className="px-2 py-2 text-left font-medium">Vencimento</th>
                <th className="px-2 py-2 text-right font-medium">Comissão</th>
                <th className="px-2 py-2 text-right font-medium">Recebido</th>
                <th className="py-2 pl-2 text-left font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {detail.map((d, n) => (
                <tr key={n}>
                  <td className="py-2 pr-2">
                    {d.number != null ? (
                      <Link href={`/pedidos/${d.orderId}`} className="font-mono font-medium text-accent-ink hover:underline">
                        {formatOrderNumber(d.number, settings)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{d.invoice ?? "—"}</td>
                  <td className="max-w-[16rem] truncate px-2 py-2">{d.customer}</td>
                  <td className={`px-2 py-2 tabular-nums ${d.status === "a_receber" && d.dueDate < today ? "font-medium text-alert" : ""}`}>{formatDate(d.dueDate)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{brl(d.value)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{d.received ? brl(d.received) : "—"}</td>
                  <td className="py-2 pl-2 text-ink-2">{STATUS[d.status] ?? d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sheet>

    </>
  );
}

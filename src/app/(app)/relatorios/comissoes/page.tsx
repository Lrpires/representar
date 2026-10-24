import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { resolvePeriod } from "@/lib/cockpit";
import { loadCommissionsByPrincipal } from "@/lib/reports";
import { brl, todayISO } from "@/lib/format";
import { CockpitShell } from "@/components/cockpit/filters";
import { Icon } from "@/components/icons";
import { PageHeader, ghostBtn } from "@/components/ui";

// Comissões por representada: previsto (vence no período), recebido (entrou no período), em aberto e atrasado.
export default async function CommissionReport({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; rep?: string }>;
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

  return (
    <>
      <PageHeader
        title="Comissões por representada"
        back={{ href: "/relatorios", label: "Relatórios" }}
        hint="Previsto: comissões que vencem no período. Recebido: o que entrou no período. Em aberto e atrasado: o que falta receber dessas comissões."
        action={
          <a href={`/relatorios/planilha?r=comissoes&${params}`} className={ghostBtn}>
            <Icon name="download" size={15} />
            Baixar planilha
          </a>
        }
      />
      <CockpitShell principals={(principals ?? []).map((p) => ({ value: p.id, label: p.name }))} sellers={null} periodLabel={P.label} compareLabel="Pelo vencimento da comissão">
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
                    <td className="py-2.5 pl-5 font-medium">{r.name}</td>
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
    </>
  );
}

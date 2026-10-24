import { notFound, redirect } from "next/navigation";
import { getSettings, themeVars } from "@/lib/settings";
import { buildReportTable, type ColKind } from "@/lib/report-table";
import { qtyText } from "@/lib/orders";
import { brl, formatDate, pct, rangeText } from "@/lib/format";
import { numberText } from "@/lib/number-format";
import { AutoPrint, PrintButton } from "@/components/print-button";
import { Logo } from "@/components/ui";

export const metadata = { title: "Relatório" };

const cell = (v: string | number | null, kind: ColKind) => {
  if (v == null || v === "") return "";
  if (typeof v === "string") return kind === "date" ? formatDate(v) : v;
  switch (kind) {
    case "money":
      return brl(v);
    case "pct":
      return pct(v * 100);
    case "qty":
      return qtyText(v);
    case "int":
      return numberText(v, 0);
    default:
      return String(v);
  }
};
const right = (k: ColKind) => k !== "text" && k !== "date";

// Relatório em A4, para imprimir ou salvar em PDF (na janela de impressão, "Salvar como PDF").
export default async function PrintReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const table = await buildReportTable(params, "print");
  if (table === "forbidden") redirect("/");
  if (!table) notFound();
  const settings = await getSettings();
  const printedAt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{`:root{${themeVars(settings.color)}} @page{size:A4 ${table.cols.length > 7 ? "landscape" : "portrait"};margin:12mm} @media print{html,body{background:#fff!important} thead{display:table-header-group} tr{break-inside:avoid}}`}</style>
      {sp.auto === "1" ? <AutoPrint /> : null}

      <div className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[64rem] items-center justify-between gap-3 px-4 py-3">
          <p className="text-[13px] text-muted">Na janela de impressão, escolha a impressora ou &quot;Salvar como PDF&quot;.</p>
          <PrintButton />
        </div>
      </div>

      <article className="mx-auto my-6 max-w-[64rem] bg-white p-8 text-[12px] leading-relaxed text-ink shadow-panel sm:p-10 print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-5 flex items-start justify-between gap-6 border-b-2 border-accent pb-4">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="" className="max-h-12 max-w-[11rem] object-contain" />
            ) : (
              <Logo size={34} />
            )}
            <p className="text-sm font-semibold">{settings.name}</p>
          </div>
          <div className="text-right">
            <h1 className="text-lg font-semibold tracking-[-0.01em]">{table.title}</h1>
            <p className="text-xs text-muted">
              Período {rangeText(table.period.start, table.period.end)}
              {table.principalName ? ` · ${table.principalName}` : ""}
            </p>
          </div>
        </header>

        {table.rows.length === 0 ? (
          <p className="py-10 text-center text-muted">Nada no período.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-ink text-[10.5px] uppercase tracking-wide text-muted">
                {table.cols.map((c) => (
                  <th key={c.header} className={`px-1.5 py-1.5 font-semibold ${right(c.kind) ? "text-right" : "text-left"}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, n) => (
                <tr key={n} className="border-b border-line">
                  {row.map((v, i) => (
                    <td
                      key={i}
                      className={`px-1.5 py-1 align-top ${right(table.cols[i].kind) ? "whitespace-nowrap text-right tabular-nums" : ""} ${i === 0 ? "font-medium" : ""}`}
                    >
                      {cell(v, table.cols[i].kind)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {table.totals ? (
              <tfoot>
                <tr className="border-t-2 border-ink font-semibold">
                  {table.totals.map((v, i) => (
                    <td key={i} className={`px-1.5 py-1.5 ${right(table.cols[i].kind) ? "whitespace-nowrap text-right tabular-nums" : ""}`}>
                      {cell(v, table.cols[i].kind)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        )}

        <footer className="mt-6 flex justify-between border-t border-line pt-2 text-[10.5px] text-faint">
          <span>Gerado pelo Representar em {printedAt}</span>
          <span>{table.rows.length} {table.rows.length === 1 ? "linha" : "linhas"}</span>
        </footer>
      </article>
    </div>
  );
}

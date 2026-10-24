// Tabela de cada relatório, igual para a planilha (Excel) e para a impressão (PDF).
import { getContext } from "@/lib/session";
import { resolvePeriod, type Period } from "@/lib/cockpit";
import { loadCommissionsByPrincipal, loadPayouts, loadSales, parseSalesSort, sortSalesRows, type SalesBy } from "@/lib/reports";
import { ruleText } from "@/lib/seller-payout";
import { todayISO } from "@/lib/format";

export type ColKind = "text" | "int" | "money" | "pct" | "qty" | "date";
export type ReportCol = { header: string; width: number; kind: ColKind };
export type ReportTable = {
  title: string;
  period: Period;
  principalName: string | null;
  cols: ReportCol[];
  rows: (string | number | null)[][];
  totals?: (string | number | null)[]; // linha de total (impressão)
};

const BY_LABEL: Record<SalesBy, string> = { vendedor: "Vendedor", cliente: "Cliente", representada: "Representada", produto: "Produto" };

// mode "sheet": planilha com o detalhe; "print": impressão, mais enxuta (no repasse, um vendedor por linha).
export async function buildReportTable(sp: URLSearchParams, mode: "sheet" | "print"): Promise<ReportTable | "forbidden" | null> {
  const r = sp.get("r");
  const { supabase, isBackOffice, canSeeCommissions } = await getContext();
  if (!isBackOffice) return "forbidden";
  if ((r === "repasse" || r === "comissoes") && !canSeeCommissions) return "forbidden";

  const today = todayISO();
  const P = resolvePeriod(sp.get("periodo") ?? undefined, sp.get("de") ?? undefined, sp.get("ate") ?? undefined, today);
  const rep = sp.get("rep") ?? undefined;
  const principalName = rep ? ((await supabase.from("principals").select("name").eq("id", rep).maybeSingle()).data?.name ?? null) : null;
  const pctText = (n: number) => `${String(Math.round(n * 100) / 100).replace(".", ",")}%`;

  if (r === "repasse") {
    const { rows: data } = await loadPayouts(P, rep);
    if (mode === "print") {
      return {
        title: "Repasse aos vendedores",
        period: P,
        principalName,
        cols: [
          { header: "Vendedor", width: 28, kind: "text" }, { header: "Regra", width: 22, kind: "text" },
          { header: "Recebimentos", width: 12, kind: "int" }, { header: "Escritório recebeu", width: 18, kind: "money" },
          { header: "Repasse", width: 14, kind: "money" }, { header: "Já pago", width: 14, kind: "money" }, { header: "A pagar", width: 14, kind: "money" },
        ],
        rows: data.map((s) => [s.name, ruleText(s.rule, pctText), s.items.length, s.received, s.payout, s.paid, s.pending]),
        totals: ["Total", "", data.reduce((a, s) => a + s.items.length, 0), sum(data.map((s) => s.received)), sum(data.map((s) => s.payout)), sum(data.map((s) => s.paid)), sum(data.map((s) => s.pending))],
      };
    }
    const rows: (string | number | null)[][] = [];
    for (const s of data) {
      const rule = ruleText(s.rule, pctText);
      for (const i of s.items) rows.push([s.name, rule, i.receivedAt, i.order, i.invoice, i.customer, i.principal, i.amount, i.payout, i.paid ? "sim" : "não"]);
    }
    return {
      title: "Repasse aos vendedores",
      period: P,
      principalName,
      cols: [
        { header: "Vendedor", width: 28, kind: "text" }, { header: "Regra", width: 24, kind: "text" }, { header: "Recebido em", width: 13, kind: "date" },
        { header: "Pedido", width: 10, kind: "int" }, { header: "NF", width: 12, kind: "text" }, { header: "Cliente", width: 36, kind: "text" },
        { header: "Representada", width: 18, kind: "text" }, { header: "Escritório recebeu", width: 18, kind: "money" },
        { header: "Repasse", width: 14, kind: "money" }, { header: "Pago", width: 8, kind: "text" },
      ],
      rows,
    };
  }

  if (r === "comissoes") {
    const { rows: data } = await loadCommissionsByPrincipal(P, today);
    const list = data.filter((x) => !rep || x.id === rep);
    return {
      title: "Comissões por representada",
      period: P,
      principalName,
      cols: [
        { header: "Representada", width: 28, kind: "text" }, { header: "Comissões", width: 12, kind: "int" }, { header: "Previsto", width: 16, kind: "money" },
        { header: "Recebido", width: 16, kind: "money" }, { header: "Em aberto", width: 16, kind: "money" }, { header: "Atrasado", width: 16, kind: "money" },
      ],
      rows: list.map((x) => [x.name, x.count, x.expected, x.received, x.open, x.late]),
      totals: ["Total", sum(list.map((x) => x.count)), sum(list.map((x) => x.expected)), sum(list.map((x) => x.received)), sum(list.map((x) => x.open)), sum(list.map((x) => x.late))],
    };
  }

  if (r === "vendas") {
    const by = (Object.keys(BY_LABEL) as SalesBy[]).find((b) => b === sp.get("por")) ?? "vendedor";
    const label = BY_LABEL[by];
    // Mesma ordem da tela (título da coluna clicado).
    const order = parseSalesSort(sp.get("ordem"), sp.get("dir"));
    const sort = order.key === "peso" ? "comissao" : "valor";
    const { rows: loaded, total, avgPct, showWeight } = await loadSales(P, by, rep, sort);
    const data = sortSalesRows(loaded, order.key, order.dir);
    // O acumulado só faz sentido na curva ABC dos clientes.
    const abc = by === "cliente";
    return {
      title: by === "produto" ? "Produtos mais vendidos" : `Vendas por ${label.toLowerCase()}`,
      period: P,
      principalName,
      cols: [
        { header: label, width: 40, kind: "text" },
        ...(by === "produto" || by === "cliente" ? [{ header: by === "produto" ? "Código / representada" : "Cidade / UF", width: 24, kind: "text" as const }] : []),
        ...(abc ? [{ header: "Curva", width: 8, kind: "text" as const }] : []),
        by === "produto" ? { header: "Quantidade", width: 14, kind: "qty" as const } : { header: "Pedidos", width: 10, kind: "int" as const },
        { header: "Valor vendido", width: 16, kind: "money" },
        { header: "Participação", width: 12, kind: "pct" },
        ...(showWeight ? [{ header: "Peso", width: 10, kind: "pct" as const }, { header: "% médio", width: 10, kind: "pct" as const }] : []),
        ...(abc ? [{ header: sort === "comissao" ? "Acumulado (peso)" : "Acumulado", width: 16, kind: "pct" as const }] : []),
      ],
      rows: data.map((x) => [
        x.name,
        ...(by === "produto" || by === "cliente" ? [x.sub ?? ""] : []),
        ...(abc ? [x.abc] : []),
        by === "produto" ? x.qty ?? 0 : x.orders,
        x.value,
        total ? x.value / total : 0,
        ...(showWeight ? [x.weight, x.avgPct / 100] : []),
        ...(abc ? [x.cumulative] : []),
      ]),
      totals: [
        "Total",
        ...(by === "produto" || by === "cliente" ? [""] : []),
        ...(abc ? [""] : []),
        by === "produto" ? sum(data.map((x) => x.qty ?? 0)) : sum(data.map((x) => x.orders)),
        total,
        1,
        ...(showWeight ? [1, avgPct / 100] : []),
        ...(abc ? [""] : []),
      ],
    };
  }
  return null;
}

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

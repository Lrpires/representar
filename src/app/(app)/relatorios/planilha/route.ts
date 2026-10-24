import ExcelJS from "exceljs";
import { getContext } from "@/lib/session";
import { resolvePeriod } from "@/lib/cockpit";
import { loadCommissionsByPrincipal, loadPayouts, loadSales, type SalesBy } from "@/lib/reports";
import { ruleText } from "@/lib/seller-payout";
import { todayISO } from "@/lib/format";
import { currencySymbol } from "@/lib/number-format";

type Col = { header: string; width: number; money?: boolean; pct?: boolean; qty?: boolean };

// Baixa o relatório da tela em Excel (.xlsx), com os mesmos filtros (período e representada).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const r = url.searchParams.get("r");
  const { isBackOffice, canSeeCommissions, orgName } = await getContext();
  if (!isBackOffice) return new Response("Sem permissão", { status: 403 });
  if ((r === "repasse" || r === "comissoes") && !canSeeCommissions) return new Response("Sem permissão", { status: 403 });

  const today = todayISO();
  const P = resolvePeriod(url.searchParams.get("periodo") ?? undefined, url.searchParams.get("de") ?? undefined, url.searchParams.get("ate") ?? undefined, today);
  const rep = url.searchParams.get("rep") ?? undefined;

  let title = "";
  let cols: Col[] = [];
  let rows: (string | number | null)[][] = [];

  if (r === "repasse") {
    title = "Repasse aos vendedores";
    const { rows: data } = await loadPayouts(P, rep);
    cols = [
      { header: "Vendedor", width: 28 }, { header: "Regra", width: 24 }, { header: "Recebido em", width: 13 },
      { header: "Pedido", width: 10 }, { header: "NF", width: 12 }, { header: "Cliente", width: 36 }, { header: "Representada", width: 18 },
      { header: "Escritório recebeu", width: 18, money: true }, { header: "Repasse", width: 14, money: true }, { header: "Pago", width: 8 },
    ];
    for (const s of data) {
      const rule = ruleText(s.rule, (n) => `${String(n).replace(".", ",")}%`);
      for (const i of s.items) {
        rows.push([s.name, rule, i.receivedAt, i.order, i.invoice, i.customer, i.principal, i.amount, i.payout, i.paid ? "sim" : "não"]);
      }
    }
  } else if (r === "comissoes") {
    title = "Comissões por representada";
    const { rows: data } = await loadCommissionsByPrincipal(P, today);
    cols = [
      { header: "Representada", width: 28 }, { header: "Comissões", width: 12 }, { header: "Previsto", width: 16, money: true },
      { header: "Recebido", width: 16, money: true }, { header: "Em aberto", width: 16, money: true }, { header: "Atrasado", width: 16, money: true },
    ];
    rows = data.filter((x) => !rep || x.id === rep).map((x) => [x.name, x.count, x.expected, x.received, x.open, x.late]);
  } else if (r === "vendas") {
    const by = (["vendedor", "cliente", "representada", "produto"] as SalesBy[]).find((b) => b === url.searchParams.get("por")) ?? "vendedor";
    const label = { vendedor: "Vendedor", cliente: "Cliente", representada: "Representada", produto: "Produto" }[by];
    title = by === "produto" ? "Produtos mais vendidos" : `Vendas por ${label.toLowerCase()}`;
    const { rows: data } = await loadSales(P, by, rep);
    cols = [
      { header: label, width: 40 },
      { header: by === "produto" ? "Código / representada" : by === "cliente" ? "Cidade / UF" : "", width: 24 },
      ...(by === "cliente" ? [{ header: "Curva ABC", width: 10 }] : []),
      by === "produto" ? { header: "Quantidade", width: 14, qty: true } : { header: "Pedidos", width: 10 },
      { header: "Valor vendido", width: 16, money: true },
      { header: "Participação", width: 12, pct: true },
      { header: "Acumulado", width: 12, pct: true },
    ];
    rows = data.map((x) => [
      x.name,
      x.sub ?? "",
      ...(by === "cliente" ? [x.abc] : []),
      by === "produto" ? x.qty ?? 0 : x.orders,
      x.value,
      x.share,
      x.cumulative,
    ]);
  } else {
    return new Response("Relatório não encontrado", { status: 404 });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.addRow([`${title} · ${orgName}`]).font = { bold: true, size: 14 };
  ws.addRow([`Período: ${P.label}`]).font = { color: { argb: "FF6E6B64" } };
  ws.addRow([]);
  const head = ws.addRow(cols.map((c) => c.header));
  head.font = { bold: true, color: { argb: "FFF3F0E8" } };
  head.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15171C" } }));
  for (const row of rows) ws.addRow(row);
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.width;
    if (c.money) col.numFmt = `"${currencySymbol()}" #,##0.00`;
    if (c.pct) col.numFmt = "0.0%";
    if (c.qty) col.numFmt = "#,##0.00";
  });
  ws.views = [{ state: "frozen", ySplit: 4 }];

  const buf = await wb.xlsx.writeBuffer();
  const slug = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}-${P.start}-a-${P.end}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

import ExcelJS from "exceljs";
import { getContext } from "@/lib/session";
import { buildReportTable } from "@/lib/report-table";
import { currencySymbol } from "@/lib/number-format";
import { rangeText } from "@/lib/format";

// Baixa o relatório da tela em Excel (.xlsx), com os mesmos filtros (período e representada).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const table = await buildReportTable(url.searchParams, "sheet");
  if (table === "forbidden") return new Response("Sem permissão", { status: 403 });
  if (!table) return new Response("Relatório não encontrado", { status: 404 });
  const { orgName } = await getContext();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(table.title.slice(0, 31));
  ws.addRow([`${table.title} · ${orgName}`]).font = { bold: true, size: 14 };
  ws.addRow([`Período: ${rangeText(table.period.start, table.period.end)}${table.principalName ? ` · ${table.principalName}` : ""}`]).font = { color: { argb: "FF6E6B64" } };
  ws.addRow([]);
  const head = ws.addRow(table.cols.map((c) => c.header));
  head.font = { bold: true, color: { argb: "FFF3F0E8" } };
  head.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15171C" } }));
  for (const row of table.rows) ws.addRow(row);
  table.cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.width;
    if (c.kind === "money") col.numFmt = `"${currencySymbol()}" #,##0.00`;
    if (c.kind === "pct") col.numFmt = "0.0%";
    if (c.kind === "qty") col.numFmt = "#,##0.00";
  });
  ws.views = [{ state: "frozen", ySplit: 4 }];

  const buf = await wb.xlsx.writeBuffer();
  const P = table.period;
  const slug = table.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}-${P.start}-a-${P.end}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

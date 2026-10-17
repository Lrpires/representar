// Monta o modelo em Excel de uma importação (sem acesso ao banco).
import ExcelJS from "exceljs";
import { UNITS } from "@/lib/units";
import type { ImportColumn, ImportDef } from "@/lib/import-schema";

export async function buildTemplate(def: ImportDef, cols: ImportColumn[], orgName: string, principals: { name: string }[] | null) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Representar";

  // ---------- Aba principal ----------
  const ws = wb.addWorksheet(def.title, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({
    header: c.required ? `${c.header} *` : c.header,
    key: c.key,
    width: c.width ?? 18,
    // Tudo como texto: evita o Excel apagar o zero da frente de CNPJ, CEP e códigos.
    style: { numFmt: "@" },
  }));
  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell, i) => {
    const col = cols[i - 1];
    cell.font = { bold: true, color: { argb: col.required ? "FFF3F0E8" : "FF15171C" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col.required ? "FF15171C" : "FFE3DED2" } };
    cell.alignment = { vertical: "middle" };
    cell.note = col.hint || col.header;
  });

  // ---------- Produtos: listas de escolha ----------
  if (def.kind === "produtos") {
    const lists = wb.addWorksheet("Listas");
    lists.getColumn(1).width = 34;
    lists.getColumn(2).width = 24;
    lists.getCell("A1").value = "Representadas cadastradas";
    lists.getCell("B1").value = "Unidades";
    lists.getRow(1).font = { bold: true };
    (principals ?? []).forEach((p, i) => (lists.getCell(`A${i + 2}`).value = p.name));
    UNITS.forEach((u, i) => (lists.getCell(`B${i + 2}`).value = u.label));
    const pCount = Math.max((principals ?? []).length, 1);
    const pCol = cols.findIndex((c) => c.key === "principal") + 1;
    const uCol = cols.findIndex((c) => c.key === "unit") + 1;
    for (let r = 2; r <= 2000; r++) {
      if ((principals ?? []).length) {
        ws.getCell(r, pCol).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`Listas!$A$2:$A$${pCount + 1}`],
          showErrorMessage: false,
        };
      }
      ws.getCell(r, uCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`Listas!$B$2:$B$${UNITS.length + 1}`],
        showErrorMessage: false,
      };
    }
  }

  // ---------- Instruções ----------
  const ins = wb.addWorksheet("Instruções");
  ins.getColumn(1).width = 26;
  ins.getColumn(2).width = 14;
  ins.getColumn(3).width = 60;
  ins.getColumn(4).width = 28;
  ins.addRow([`Importar ${def.many} · ${orgName}`]).font = { bold: true, size: 14 };
  ins.addRow([`Passo ${def.step} de 3. ${def.description}`]);
  ins.addRow([`1. Preencha a aba "${def.title}", uma linha por ${def.one}. Não mude os títulos da primeira linha.`]);
  ins.addRow([`2. Colunas com * são obrigatórias. As outras podem ficar vazias.`]);
  ins.addRow([`3. Salve em Excel (.xlsx) e envie em Importar dados, no Representar. Antes de gravar, você vê uma prévia com os erros.`]);
  ins.addRow([def.match]);
  ins.addRow([]);
  const th = ins.addRow(["Coluna", "Obrigatória", "Como preencher", "Exemplo"]);
  th.font = { bold: true, color: { argb: "FFF3F0E8" } };
  th.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15171C" } }));
  for (const c of cols) {
    const r = ins.addRow([c.header, c.required ? "Sim" : "", c.hint, c.example]);
    r.alignment = { wrapText: true, vertical: "top" };
  }

  return wb.xlsx.writeBuffer();
}

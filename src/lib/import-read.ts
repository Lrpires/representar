// Leitura da planilha de importação (sem acesso ao banco): usada pelas ações de importar e testável sozinha.
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { posix } from "node:path";
import { parseNumber } from "@/lib/format";
import { UNITS } from "@/lib/units";
import { normHeader, visibleColumns, type ImportDef } from "@/lib/import-schema";

const MAX_ROWS = 5000;
const MAX_BYTES = 5 * 1024 * 1024;

export type Cells = Record<string, string>;

export const onlyDigits = (s: string) => s.replace(/\D/g, "");
export const lower = (s: string) => normHeader(s);

// Texto de uma célula do Excel (texto, número, fórmula, link, texto formatado…).
function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("").trim();
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
  }
  return String(v).trim();
}

// CNPJ e CEP digitados como número no Excel perdem o zero da frente: devolve.
function fixLeadingZeros(cells: Cells) {
  if (cells.cnpj) {
    const d = onlyDigits(cells.cnpj);
    if (d.length >= 12 && d.length < 14) cells.cnpj = d.padStart(14, "0");
  }
  if (cells.zip) {
    const d = onlyDigits(cells.zip);
    if (d.length === 7) cells.zip = d.padStart(8, "0");
  }
}

export const num = (raw: string) => (raw ? parseNumber(raw) : null);

// Unidade pelo valor ("kg"), pelo nome ("Quilo"→ não; "Kg") ou por abreviações comuns.
const UNIT_ALIASES: Record<string, string> = {
  un: "unidade", und: "unidade", unid: "unidade", pc: "peca", pca: "peca", pcs: "peca", pecas: "peca",
  cx: "caixa", pct: "pacote", m: "metro", mt: "metro", m2: "metro_quadrado", m3: "metro_cubico",
  g: "grama", gr: "grama", l: "litro", lt: "litro", dz: "duzia", t: "tonelada", ton: "tonelada", h: "hora",
  quilograma: "kg", quilo: "kg", kilo: "kg", kilograma: "kg", kgs: "kg", metrolinear: "metro", ml: "metro",
  metroquadrado: "metro_quadrado", metrocubico: "metro_cubico", cm: "centimetro", mil: "milheiro", cto: "cento",
};
export function unitValue(raw: string): string | null {
  if (!raw) return "unidade";
  const clean = lower(raw).replace(/[.\s]/g, "");
  // Tenta como veio e no singular ("metros" → "metro", "peças" → "peca", "pares" → "par").
  for (const n of [clean, clean.replace(/es$/, ""), clean.replace(/s$/, "")]) {
    const found = UNITS.find((u) => u.value === n || lower(u.label).replace(/\s/g, "") === n || lower(u.label).replace(/[()\s²³]/g, "") === n);
    if (found) return found.value;
    if (UNIT_ALIASES[n]) return UNIT_ALIASES[n];
  }
  return null;
}

export function cepText(raw: string, errors: string[]) {
  if (!raw) return undefined;
  const d = onlyDigits(raw);
  if (d.length !== 8) {
    errors.push("CEP precisa ter 8 números");
    return undefined;
  }
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function ufText(raw: string, errors: string[]) {
  if (!raw) return undefined;
  const uf = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) {
    errors.push("UF deve ter 2 letras (ex.: PE)");
    return undefined;
  }
  return uf;
}

// Só leva para o banco o que veio preenchido (célula vazia não apaga o que já existe).
export function filled(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

/* ---------------------------------------------------------------- leitura */

// Alguns programas (Excel na web e outros) gravam o arquivo num formato que o Excel entende,
// mas a biblioteca de leitura não: caminhos internos começando com "/" (ex.: "/xl/workbook.xml")
// e as marcações com prefixo (ex.: "<x:workbook>" no lugar de "<workbook>"). Convertemos para o
// formato comum antes de abrir. O conteúdo da planilha não muda.
const SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
export async function normalizeXlsx(buf: ArrayBuffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  let changed = false;
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir || !/\.(xml|rels)$/i.test(name)) continue;
    const original = await zip.file(name)!.async("string");
    let xml = original.replace(/^\uFEFF/, "");

    // 1) Caminhos absolutos nas ligações internas viram relativos à pasta do arquivo.
    if (/\.rels$/i.test(name)) {
      const base = name.replace(/_rels\/[^/]*\.rels$/, "");
      xml = xml.replace(/(<Relationship\b[^>]*?\bTarget=")\/([^"]+)"/g, (m, head: string, target: string) =>
        /TargetMode="External"/.test(m) ? m : `${head}${posix.relative(base || ".", target) || target}"`,
      );
    }

    // 2) Comentários e anotações das células não são usados na importação e cada programa grava de
    //    um jeito: são retirados da leitura (a planilha da pessoa não é alterada).
    if (/\.rels$/i.test(name)) {
      xml = xml.replace(/<Relationship\b[^>]*\bType="[^"]*\/(comments|vmlDrawing|threadedComment|person)"[^>]*\/>/g, "");
    } else if (/^xl\/worksheets\/[^/]+\.xml$/i.test(name)) {
      xml = xml.replace(/<([A-Za-z0-9_]+:)?legacyDrawing\b[^>]*\/>/g, "");
    }

    // 3) Marcações com prefixo da planilha ("x:") voltam ao nome simples.
    const prefix = xml.match(new RegExp(`xmlns:([A-Za-z0-9_]+)="${SHEET_NS.replace(/[./]/g, "\\$&")}"`))?.[1];
    if (prefix && !new RegExp(`xmlns="${SHEET_NS.replace(/[./]/g, "\\$&")}"`).test(xml)) {
      xml = xml
        .replace(new RegExp(`<(/?)${prefix}:`, "g"), "<$1")
        .replace(new RegExp(`xmlns:${prefix}="`), 'xmlns="');
    }

    if (xml !== original) {
      zip.file(name, xml);
      changed = true;
    }
  }
  return changed ? zip.generateAsync({ type: "nodebuffer" }) : Buffer.from(buf);
}

export async function readSheet(def: ImportDef, file: { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }, canSeeCommissions: boolean) {
  if (!file || file.size === 0) return { error: "Escolha a planilha preenchida." } as const;
  if (file.size > MAX_BYTES) return { error: "Arquivo maior que 5 MB. Divida em partes menores." } as const;
  if (!/\.xlsx$/i.test(file.name)) return { error: "Use o arquivo em Excel (.xlsx). Se estiver em outro formato, abra no Excel e salve como .xlsx." } as const;

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load((await normalizeXlsx(await file.arrayBuffer())) as unknown as ExcelJS.Buffer);
  } catch (e) {
    console.error("[importar] falha ao abrir planilha:", file.name, e);
    return { error: "Não foi possível ler o arquivo. Ele está em Excel (.xlsx)?" } as const;
  }
  const ws = wb.worksheets.find((w) => lower(w.name) === lower(def.title)) ?? wb.worksheets[0];
  if (!ws) return { error: "A planilha está vazia." } as const;

  const cols = visibleColumns(def, canSeeCommissions);
  const byHeader = new Map(cols.map((c) => [normHeader(c.header), c.key] as const));
  const header = ws.getRow(1);
  const colKey = new Map<number, string>();
  const ignored: string[] = [];
  header.eachCell((cell, col) => {
    const t = cellText(cell.value);
    if (!t) return;
    const key = byHeader.get(normHeader(t));
    if (key) colKey.set(col, key);
    else ignored.push(t);
  });
  const present = new Set(colKey.values());
  const missingRequired = cols.filter((c) => c.required && !present.has(c.key)).map((c) => c.header);

  const rows: { line: number; cells: Cells }[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: Cells = {};
    let any = false;
    for (const [col, key] of colKey) {
      const t = cellText(row.getCell(col).value);
      if (t) any = true;
      cells[key] = t;
    }
    if (!any) continue;
    fixLeadingZeros(cells);
    rows.push({ line: r, cells });
    if (rows.length > MAX_ROWS) return { error: `A planilha tem mais de ${MAX_ROWS} linhas. Divida em partes menores.` } as const;
  }
  return { rows, ignored, missingRequired } as const;
}


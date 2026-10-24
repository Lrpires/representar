// PDF do pedido (A4), gerado no servidor para baixar com um clique. Mesmo conteúdo da tela de impressão.
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDate } from "@/lib/format";
import { inputText, money, numberText } from "@/lib/number-format";
import { unitLabel } from "@/lib/units";
import type { PrintableOrder } from "@/lib/order-print";

const INK = "#15171C";
const INK2 = "#4A4840";
const MUTED = "#6E6B64";
const LINE = "#D6D1C5";

type Img = { data: Buffer; format: "png" | "jpg" } | null;

// Baixa a logo e só usa se for PNG ou JPG (formatos que o PDF aceita).
async function fetchImage(url: string | null | undefined): Promise<Img> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf[0] === 0x89 && buf[1] === 0x50) return { data: buf, format: "png" };
    if (buf[0] === 0xff && buf[1] === 0xd8) return { data: buf, format: "jpg" };
    return null;
  } catch {
    return null;
  }
}

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, color: INK, lineHeight: 1.4 },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 12, borderBottomWidth: 2 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  orgName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  small: { fontSize: 8, color: MUTED },
  eyebrow: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  number: { fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "right", lineHeight: 1.1, marginBottom: 3 },
  parties: { flexDirection: "row", gap: 24, paddingVertical: 12, borderBottomWidth: 1, borderColor: LINE },
  party: { flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
  info: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderColor: LINE },
  infoCell: { flex: 1 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderColor: INK, paddingVertical: 5, marginTop: 12 },
  thText: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderBottomWidth: 0.6, borderColor: LINE, paddingVertical: 5 },
  totals: { alignSelf: "flex-end", width: 200, marginTop: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1.5, borderColor: INK, marginTop: 4, paddingTop: 5 },
  notes: { marginTop: 16, borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 8 },
  sign: { flexDirection: "row", gap: 40, marginTop: 48 },
  signLine: { flex: 1, borderTopWidth: 0.8, borderColor: INK2, paddingTop: 4, textAlign: "center", fontSize: 8, color: MUTED },
  // Rodapé medido do topo (A4 = 842 pt de altura): posicionar pelo "bottom" joga o número da página para fora.
  footerLeft: { position: "absolute", top: 810, left: 40, fontSize: 7, color: MUTED },
  footerRight: { position: "absolute", top: 810, left: 40, right: 40, fontSize: 7, color: MUTED, textAlign: "right" },
});

// Larguras das colunas da tabela de itens.
const W = { n: 18, code: 58, desc: 0, unit: 44, qty: 44, price: 62, disc: 36, total: 70 };
const cell = (width: number, align: "left" | "right" = "left") => (width ? { width, textAlign: align } : { flex: 1, textAlign: align, paddingRight: 6 });

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={s.infoCell}>
      <Text style={s.eyebrow}>{label}</Text>
      <Text>{value || "—"}</Text>
    </View>
  );
}

function OrderDocument({ o, logos }: { o: PrintableOrder; logos: { org: Img; customer: Img; principal: Img } }) {
  const brl = (v: number) => money(v, o.fmt);
  const numText = (n: number, d = 4) => inputText(n, d, o.fmt);
  const qtyText = (n: number) => numberText(n, 3, o.fmt, 2);
  const accent = /^#[0-9a-f]{6}$/i.test(o.settings.color) ? o.settings.color : "#FF5B22";
  return (
    <Document title={`Pedido ${o.label}`} author={o.settings.name} creator="Representar">
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={[s.header, { borderColor: accent }]}>
          <View style={s.brand}>
            {logos.org ? <Image src={logos.org} style={{ maxHeight: 40, maxWidth: 130, objectFit: "contain" }} /> : null}
            <View>
              <Text style={s.orgName}>{o.settings.name}</Text>
              {o.sellerName ? <Text style={s.small}>{o.sellerName}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={[s.eyebrow, { textAlign: "right" }]}>Pedido de venda</Text>
            <Text style={[s.number, { color: accent }]}>{o.label}</Text>
            <Text style={[s.small, { textAlign: "right" }]}>
              {formatDate(o.orderDate)} · {o.status}
            </Text>
          </View>
        </View>

        {/* Cliente e representada */}
        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.eyebrow}>Cliente</Text>
            {logos.customer ? <Image src={logos.customer} style={{ maxHeight: 26, maxWidth: 90, objectFit: "contain", marginBottom: 4 }} /> : null}
            <Text style={s.bold}>{o.customer.name}</Text>
            {o.customer.cnpj ? <Text>CNPJ {o.customer.cnpj}</Text> : null}
            {o.customer.address ? <Text style={{ color: INK2 }}>{o.customer.address}</Text> : null}
            {o.customer.contact ? <Text style={{ color: INK2 }}>{o.customer.contact}</Text> : null}
          </View>
          <View style={s.party}>
            <Text style={s.eyebrow}>Representada</Text>
            {logos.principal ? <Image src={logos.principal} style={{ maxHeight: 26, maxWidth: 90, objectFit: "contain", marginBottom: 4 }} /> : null}
            <Text style={s.bold}>{o.principal.name}</Text>
            {o.principal.legalName ? <Text>{o.principal.legalName}</Text> : null}
            {o.principal.cnpj ? <Text>CNPJ {o.principal.cnpj}</Text> : null}
            {o.principal.orderEmail ? <Text style={{ color: INK2 }}>{o.principal.orderEmail}</Text> : null}
          </View>
        </View>

        <View style={s.info}>
          <Info label="Condição de pagamento" value={o.paymentTerms} />
          <Info label="Previsão de entrega" value={o.expectedDelivery ? formatDate(o.expectedDelivery) : null} />
          <Info label="Frete" value={o.freightMode} />
          <Info label="Itens" value={String(o.items.length)} />
        </View>

        {/* Itens */}
        <View style={s.th} fixed>
          <Text style={[s.thText, cell(W.n)]}>#</Text>
          <Text style={[s.thText, cell(W.code)]}>Código</Text>
          <Text style={[s.thText, cell(W.desc)]}>Produto</Text>
          <Text style={[s.thText, cell(W.unit)]}>Unid.</Text>
          <Text style={[s.thText, cell(W.qty, "right")]}>Qtd.</Text>
          <Text style={[s.thText, cell(W.price, "right")]}>Preço</Text>
          <Text style={[s.thText, cell(W.disc, "right")]}>Desc.</Text>
          <Text style={[s.thText, cell(W.total, "right")]}>Total</Text>
        </View>
        {o.items.map((i, n) => (
          <View key={i.id} style={s.tr} wrap={false}>
            <Text style={[cell(W.n), { color: MUTED }]}>{n + 1}</Text>
            <Text style={[cell(W.code), { fontFamily: "Courier", fontSize: 8 }]}>{i.code}</Text>
            <Text style={cell(W.desc)}>{i.description}</Text>
            <Text style={cell(W.unit)}>{unitLabel(i.unit)}</Text>
            <Text style={cell(W.qty, "right")}>{qtyText(i.qty)}</Text>
            <Text style={cell(W.price, "right")}>{brl(i.listPrice)}</Text>
            <Text style={cell(W.disc, "right")}>{i.discountPct ? `${numText(i.discountPct, 2)}%` : "—"}</Text>
            <Text style={[cell(W.total, "right"), s.bold]}>{brl(i.total)}</Text>
          </View>
        ))}

        {/* Totais */}
        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text style={{ color: MUTED }}>Subtotal</Text>
            <Text>{brl(o.subtotal)}</Text>
          </View>
          {o.discountPct ? (
            <View style={s.totalRow}>
              <Text style={{ color: MUTED }}>Desconto ({numText(o.discountPct, 2)}%)</Text>
              <Text>- {brl(o.discountValue)}</Text>
            </View>
          ) : null}
          {o.freightValue ? (
            <View style={s.totalRow}>
              <Text style={{ color: MUTED }}>Frete</Text>
              <Text>{brl(o.freightValue)}</Text>
            </View>
          ) : null}
          <View style={s.grand}>
            <Text style={[s.bold, { fontSize: 11 }]}>Total</Text>
            <Text style={[s.bold, { fontSize: 11 }]}>{brl(o.total)}</Text>
          </View>
        </View>

        {o.notes ? (
          <View style={s.notes} wrap={false}>
            <Text style={s.eyebrow}>Observações</Text>
            <Text>{o.notes}</Text>
          </View>
        ) : null}

        <View style={s.sign} wrap={false}>
          <Text style={s.signLine}>Assinatura do cliente</Text>
          <Text style={s.signLine}>Representante</Text>
        </View>

        <Text style={s.footerLeft} fixed>
          {o.settings.name} · Pedido {o.label}
        </Text>
        <Text style={s.footerRight} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  );
}

export async function renderOrderPdf(o: PrintableOrder): Promise<Buffer> {
  const [org, customer, principal] = await Promise.all([
    fetchImage(o.settings.logoUrl),
    fetchImage(o.customer.logo),
    fetchImage(o.principal.logo),
  ]);
  return renderToBuffer(<OrderDocument o={o} logos={{ org, customer, principal }} />);
}

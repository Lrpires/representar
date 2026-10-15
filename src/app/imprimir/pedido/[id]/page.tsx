import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { getSettings, themeVars } from "@/lib/settings";
import { formatOrderNumber, numText, statusInfo } from "@/lib/orders";
import { brl, formatDate } from "@/lib/format";
import { unitLabel } from "@/lib/units";
import { logoUrl } from "@/lib/storage";
import { PrintButton } from "@/components/print-button";
import { Logo } from "@/components/ui";

export const metadata = { title: "Pedido" };

// Pedido em formato A4, para imprimir ou salvar em PDF e mandar à fábrica.
export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getContext();
  const settings = await getSettings();

  const { data: o } = await supabase
    .from("orders")
    .select("*, customers(*), principals(*)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();

  const [{ data: items }, { data: seller }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).order("position"),
    supabase.from("members").select("full_name, email").eq("user_id", o.seller_id).eq("org_id", o.org_id).maybeSingle(),
  ]);

  const c = (o.customers ?? {}) as Record<string, string | null>;
  const p = (o.principals ?? {}) as Record<string, string | null>;
  const label = formatOrderNumber(o.number, settings);
  const st = statusInfo(o.status);
  const subtotal = Number(o.subtotal);
  const discountValue = Math.round(subtotal * Number(o.discount_pct)) / 100;
  const address = [
    [c.street, c.street_number].filter(Boolean).join(", "),
    c.complement,
    c.district,
    [c.city, c.state].filter(Boolean).join(" / "),
    c.zip ? `CEP ${c.zip}` : null,
  ]
    .filter(Boolean)
    .join(" · ") || c.address || "";

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{`:root{${themeVars(settings.color)}} @page{size:A4;margin:14mm} @media print{html,body{background:#fff!important}}`}</style>

      <div className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[52rem] items-center justify-between gap-3 px-4 py-3">
          <p className="text-[13px] text-muted">Use “Salvar como PDF” na janela de impressão para enviar por e-mail ou WhatsApp.</p>
          <PrintButton />
        </div>
      </div>

      <article className="mx-auto my-6 max-w-[52rem] bg-white p-8 text-[13px] leading-relaxed text-ink shadow-panel sm:p-10 print:my-0 print:max-w-none print:p-0 print:shadow-none">
        {/* Cabeçalho */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-accent pb-5">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="" className="max-h-14 max-w-[12rem] object-contain" />
            ) : (
              <Logo size={40} />
            )}
            <div>
              <p className="text-base font-semibold">{settings.name}</p>
              <p className="text-xs text-muted">{seller?.full_name || seller?.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted">Pedido de venda</p>
            <p className="text-2xl font-semibold tracking-[-0.02em] text-accent-ink">{label}</p>
            <p className="text-xs text-muted">
              {formatDate(o.order_date)} · {st.label}
            </p>
          </div>
        </header>

        {/* Partes */}
        <section className="grid grid-cols-2 gap-6 border-b border-line py-5">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Cliente</p>
            {logoUrl(c.logo_path) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl(c.logo_path)!} alt="" className="mb-1.5 max-h-10 max-w-[8rem] object-contain" />
            ) : null}
            <p className="font-semibold">{c.name}</p>
            {c.cnpj ? <p>CNPJ {c.cnpj}</p> : null}
            {address ? <p className="text-ink-2">{address}</p> : null}
            {[c.contact_name, c.phone].filter(Boolean).length ? (
              <p className="text-ink-2">{[c.contact_name, c.phone].filter(Boolean).join(" · ")}</p>
            ) : null}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Representada</p>
            {logoUrl(p.logo_path) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl(p.logo_path)!} alt="" className="mb-1.5 max-h-10 max-w-[8rem] object-contain" />
            ) : null}
            <p className="font-semibold">{p.name}</p>
            {p.legal_name ? <p>{p.legal_name}</p> : null}
            {p.cnpj ? <p>CNPJ {p.cnpj}</p> : null}
            {p.order_email ? <p className="text-ink-2">{p.order_email}</p> : null}
          </div>
        </section>

        <section className="grid grid-cols-4 gap-4 border-b border-line py-4">
          <Info label="Condição de pagamento" value={o.payment_terms} />
          <Info label="Previsão de entrega" value={o.expected_delivery ? formatDate(o.expected_delivery) : null} />
          <Info label="Frete" value={o.freight_mode ? String(o.freight_mode).toUpperCase() : null} />
          <Info label="Itens" value={String((items ?? []).length)} />
        </section>

        {/* Itens */}
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-b border-ink text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="w-8 py-2 font-semibold">#</th>
              <th className="w-24 py-2 font-semibold">Código</th>
              <th className="py-2 font-semibold">Produto</th>
              <th className="w-16 py-2 font-semibold">Unid.</th>
              <th className="w-16 py-2 text-right font-semibold">Qtd.</th>
              <th className="w-24 py-2 text-right font-semibold">Preço</th>
              <th className="w-14 py-2 text-right font-semibold">Desc.</th>
              <th className="w-28 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((i, n) => (
              <tr key={i.id} className="break-inside-avoid border-b border-line">
                <td className="py-2 text-muted">{n + 1}</td>
                <td className="py-2 font-mono text-xs">{i.code}</td>
                <td className="py-2 pr-2">{i.description}</td>
                <td className="py-2">{unitLabel(i.unit)}</td>
                <td className="py-2 text-right tabular-nums">{numText(Number(i.qty), 3)}</td>
                <td className="py-2 text-right tabular-nums">{brl(Number(i.list_price))}</td>
                <td className="py-2 text-right tabular-nums">{Number(i.discount_pct) ? `${numText(Number(i.discount_pct), 2)}%` : "—"}</td>
                <td className="py-2 text-right font-medium tabular-nums">{brl(Number(i.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totais */}
        <section className="mt-4 flex justify-end">
          <dl className="w-64 break-inside-avoid">
            <div className="flex justify-between py-1">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{brl(subtotal)}</dd>
            </div>
            {Number(o.discount_pct) ? (
              <div className="flex justify-between py-1">
                <dt className="text-muted">Desconto ({numText(Number(o.discount_pct), 2)}%)</dt>
                <dd className="tabular-nums">− {brl(discountValue)}</dd>
              </div>
            ) : null}
            {Number(o.freight_value) ? (
              <div className="flex justify-between py-1">
                <dt className="text-muted">Frete</dt>
                <dd className="tabular-nums">{brl(Number(o.freight_value))}</dd>
              </div>
            ) : null}
            <div className="mt-1 flex justify-between border-t-2 border-ink pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{brl(Number(o.total))}</dd>
            </div>
          </dl>
        </section>

        {o.notes ? (
          <section className="mt-6 break-inside-avoid rounded-md border border-line p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Observações</p>
            <p className="whitespace-pre-line">{o.notes}</p>
          </section>
        ) : null}

        <footer className="mt-16 grid break-inside-avoid grid-cols-2 gap-12 text-center text-xs text-muted">
          <div className="border-t border-ink-2 pt-2">Assinatura do cliente</div>
          <div className="border-t border-ink-2 pt-2">Representante</div>
        </footer>
      </article>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5">{value || "—"}</p>
    </div>
  );
}

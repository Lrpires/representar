import Link from "next/link";
import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { deleteInvoice } from "../pedidos/[id]/invoices";
import { ConfirmButton } from "@/components/confirm-button";
import { unitLabel } from "@/lib/units";
import { NfeMirror } from "./nfe-mirror";
import { formatOrderNumber, numText, qtyText, statusInfo } from "@/lib/orders";
import { brl, formatDate } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { Icon } from "@/components/icons";
import { ErrorNote, Badge, primaryBtn, ghostBtn, dangerBtn } from "@/components/ui";

// Painel da nota fiscal (espelho da NF, parcelas, comissões). Abre por cima da tela em que se está:
// no Faturamento (com o botão de excluir) e na ficha do pedido (só para consulta).
export async function InvoicePanel({
  invoiceId,
  closeHref,
  error,
  allowDelete = false,
  fromOrder = false,
}: {
  invoiceId: string;
  closeHref: string;
  error?: string;
  allowDelete?: boolean; // excluir a nota só na área de Faturamento
  fromOrder?: boolean; // aberto da ficha do pedido: o atalho leva ao Faturamento, não ao pedido
}) {
  const { supabase, user, isBackOffice, canSeeCommissions } = await getContext();
  const settings = await getSettings();

  type InvDetail = {
    id: string; number: string | null; series: string | null; issued_at: string; value: number; access_key?: string | null;
    file_path: string | null; file_name: string | null; notes: string | null; created_at: string; order_id: string;
    orders: {
      number: number; status: string; seller_id: string; discount_pct: number;
      customers: { name: string; cnpj: string | null } | null; principals: { name: string; cnpj: string | null } | null;
    } | null;
    order_invoice_items: { qty: number; order_items: { description: string; code: string | null; unit: string; unit_price: number } | null }[];
    commissions: { value: number; pct: number; due_date: string; status: string; received_value: number | null; received_at: string | null }[];
    order_invoice_installments?: { number: string | null; due_date: string; value: number; position: number }[];
  };
  let detail: InvDetail | null = null;
  if (invoiceId) {
    const base =
      "id, number, series, issued_at, value, file_path, file_name, notes, created_at, order_id, orders!inner(number, status, seller_id, discount_pct, customers(name, cnpj), principals(name, cnpj)), order_invoice_items(qty, order_items(description, code, unit, unit_price)), commissions(value, pct, due_date, status, received_value, received_at)";
    // Com chave de acesso (017) e parcelas (021); sem essas migrações, carrega com o que houver.
    let { data, error: e } = await supabase
      .from("order_invoices")
      .select(`${base}, access_key, order_invoice_installments(number, due_date, value, position)`)
      .eq("id", invoiceId)
      .maybeSingle();
    if (e) ({ data, error: e } = await supabase.from("order_invoices").select(`${base}, access_key`).eq("id", invoiceId).maybeSingle());
    if (e) ({ data } = await supabase.from("order_invoices").select(base).eq("id", invoiceId).maybeSingle());
    detail = (data as unknown as InvDetail) ?? null;
  }
  // Itens da nota como vieram na NF (migração 025); sem eles, mostra os itens do pedido faturados.
  type NfLine = { code: string | null; description: string; unit: string | null; qty: number; unit_price: number; total: number; order_item_id: string | null };
  const nfLines: NfLine[] = invoiceId
    ? (((await supabase.from("order_invoice_lines").select("code, description, unit, qty, unit_price, total, order_item_id").eq("invoice_id", invoiceId).order("position")).data ?? []) as NfLine[])
    : [];
  const canDelete = !!detail && (isBackOffice || detail.orders?.seller_id === user.id);
  const commission = detail?.commissions?.[0];
  const commissionsOfNote = [...(detail?.commissions ?? [])].sort((a, b) => a.due_date.localeCompare(b.due_date));
  // Comissão com dinheiro já recebido (no todo ou em parte) trava a exclusão da nota.
  const commissionPaid = commissionsOfNote.some((c) => c.status === "recebida" || Number(c.received_value ?? 0) > 0);
  const installmentsOfNote = [...(detail?.order_invoice_installments ?? [])].sort((a, b) => a.position - b.position);

  return (
    <Sheet
      open={!!detail}
      title={detail ? `NF ${detail.number || "sem número"}` : "Nota fiscal"}
      description={detail ? `Emitida em ${formatDate(detail.issued_at)}` : undefined}
      closeHref={closeHref}
      size="lg"
    >
      {detail ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="scroll-thin grid flex-1 content-start gap-5 overflow-y-auto px-5 py-5">
            <ErrorNote message={error} />

            {/* Pedido ligado à nota */}
            <Link
              href={`/pedidos/${detail.order_id}`}
              className="group flex items-center gap-3 rounded-lg border border-line bg-subtle p-3 transition hover:border-line-strong"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted">
                <Icon name="receipt" size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] text-muted">Pedido desta nota</span>
                <span className="block truncate text-sm font-medium">
                  <span className="font-mono">{detail.orders ? formatOrderNumber(detail.orders.number, settings) : "—"}</span>
                  {" · "}
                  {detail.orders?.customers?.name}
                </span>
                <span className="block truncate text-xs text-muted">{detail.orders?.principals?.name}</span>
              </span>
              {detail.orders ? <Badge tone={statusInfo(detail.orders.status).tone}>{statusInfo(detail.orders.status).label}</Badge> : null}
              <Icon name="chevron-right" size={16} className="text-faint group-hover:text-ink" />
            </Link>

            {/* Espelho da nota: do XML guardado (tudo o que está na NF) ou, sem XML, o que o sistema tem */}
            <NfeMirror
              invoiceId={detail.id}
              hasXml={/\.xml$/i.test(detail.file_path ?? "")}
              fallback={
                <div className="grid gap-5">
            {/* Espelho da nota: quem emitiu, para quem, valor e data */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <div>
                <dt className="text-xs text-muted">Emitente</dt>
                <dd className="font-medium">{detail.orders?.principals?.name ?? "—"}</dd>
                {detail.orders?.principals?.cnpj ? <dd className="text-xs text-muted">{detail.orders.principals.cnpj}</dd> : null}
              </div>
              <div>
                <dt className="text-xs text-muted">Destinatário</dt>
                <dd className="font-medium">{detail.orders?.customers?.name ?? "—"}</dd>
                {detail.orders?.customers?.cnpj ? <dd className="text-xs text-muted">{detail.orders.customers.cnpj}</dd> : null}
              </div>
              <div>
                <dt className="text-xs text-muted">Valor da nota</dt>
                <dd className="font-mono text-base font-semibold tabular-nums">{brl(Number(detail.value))}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Emissão</dt>
                <dd className="tabular-nums">{formatDate(detail.issued_at)}</dd>
              </div>
              {detail.access_key ? (
                <div className="col-span-2">
                  <dt className="text-xs text-muted">Chave de acesso</dt>
                  <dd className="break-all font-mono text-xs">{detail.access_key}</dd>
                </div>
              ) : null}
              {detail.notes ? (
                <div className="col-span-2">
                  <dt className="text-xs text-muted">Observações</dt>
                  <dd className="whitespace-pre-line">{detail.notes}</dd>
                </div>
              ) : null}
            </dl>

            {/* Parcelas: número, vencimento e valor */}
            {installmentsOfNote.length ? (
              <section className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-[13px]">
                  <thead className="bg-subtle text-[11px] text-muted">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Parcela</th>
                      <th className="px-3 py-1.5 text-left font-medium">Vencimento</th>
                      <th className="px-3 py-1.5 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {installmentsOfNote.map((x) => (
                      <tr key={x.position}>
                        <td className="px-3 py-1.5 font-mono">{x.number || String(x.position).padStart(2, "0")}</td>
                        <td className="px-3 py-1.5 tabular-nums">{formatDate(x.due_date)}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">{brl(Number(x.value))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            {/* Itens da nota, exatamente como vieram na NF */}
            {nfLines.length ? (
              <section>
                <p className="mb-2 text-xs font-medium text-muted">Itens da nota ({nfLines.length})</p>
                <div className="overflow-hidden rounded-lg border border-line">
                  <table className="w-full text-[13px]">
                    <thead className="bg-subtle text-[11px] text-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Produto</th>
                        <th className="px-3 py-2 text-right font-medium">Qtd.</th>
                        <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Valor un.</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {nfLines.map((l, n) => (
                        <tr key={n}>
                          <td className="px-3 py-2.5">
                            {l.code ? <span className="block font-mono text-[11px] text-muted">{l.code}</span> : null}
                            {l.description}
                            {!l.order_item_id ? <span className="mt-0.5 block text-[11px] text-warn">Sem item do pedido</span> : null}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                            {qtyText(Number(l.qty))} {(l.unit ?? "").toLowerCase()}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums sm:table-cell">{brl(Number(l.unit_price))}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums">{brl(Number(l.total))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {/* Notas antigas (sem os itens da NF): itens do pedido faturados, com o preço do pedido e o desconto geral */}
            {!nfLines.length && detail.order_invoice_items.length ? (
              <section>
                <p className="mb-2 text-xs font-medium text-muted">Itens da nota</p>
                <div className="overflow-hidden rounded-lg border border-line">
                  <table className="w-full text-[13px]">
                    <thead className="bg-subtle text-[11px] text-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Produto</th>
                        <th className="px-3 py-2 text-right font-medium">Qtd.</th>
                        <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Valor un.</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {detail.order_invoice_items.map((l, n) => {
                        const price = Number(l.order_items?.unit_price ?? 0) * (1 - Number(detail!.orders?.discount_pct ?? 0) / 100);
                        return (
                          <tr key={n}>
                            <td className="px-3 py-2.5">
                              {l.order_items?.code ? <span className="block font-mono text-[11px] text-muted">{l.order_items.code}</span> : null}
                              {l.order_items?.description ?? "Item removido do pedido"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                              {qtyText(Number(l.qty))} {l.order_items ? unitLabel(l.order_items.unit).toLowerCase() : ""}
                            </td>
                            <td className="hidden whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums sm:table-cell">{brl(price)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums">{brl(price * Number(l.qty))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

                </div>
              }
            />

            {/* Arquivo */}
            {detail.file_path ? (
              <div className="flex flex-wrap gap-2">
                <a href={`/nf/${detail.id}`} target="_blank" rel="noopener noreferrer" className={ghostBtn}>
                  <Icon name="file" size={15} />
                  Ver arquivo
                </a>
                <a href={`/nf/${detail.id}?baixar=1`} className={ghostBtn}>
                  <Icon name="download" size={15} />
                  Baixar {detail.file_name ? "" : "arquivo"}
                </a>
                {detail.file_name ? <span className="self-center truncate text-xs text-muted">{detail.file_name}</span> : null}
              </div>
            ) : (
              <p className="text-xs text-muted">Nenhum arquivo (PDF ou XML) anexado a esta nota.</p>
            )}

            {/* Comissões desta nota (só quem vê comissões): uma por parcela, quando a representada paga na liquidez */}
            {canSeeCommissions && commissionsOfNote.length ? (
              <section>
                <p className="mb-2 text-xs font-medium text-muted">
                  {commissionsOfNote.length === 1 ? "Comissão desta nota" : `Comissões desta nota (${commissionsOfNote.length}, uma por parcela)`}
                </p>
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line text-[13px]">
                  {commissionsOfNote.map((c, n) => (
                    <li key={n} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                      <span className="font-mono font-semibold tabular-nums">{brl(Number(c.value))}</span>
                      <span className="text-muted">{numText(Number(c.pct), 2)}%</span>
                      <span className="text-muted">vence {formatDate(c.due_date)}</span>
                      <span className="ml-auto">
                        <Badge tone={c.status === "recebida" ? "ok" : c.status === "a_receber" ? "info" : "neutral"} dot>
                          {c.status === "recebida"
                            ? "Recebida"
                            : c.status === "cancelada"
                              ? "Cancelada"
                              : c.status === "encerrada"
                                ? "Encerrada"
                                : Number(c.received_value ?? 0) > 0
                                  ? `Recebido ${brl(Number(c.received_value))}`
                                  : "A receber"}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <p className="border-t border-line px-5 py-2 text-[11px] text-faint">Lançada no sistema em {formatDate(String(detail.created_at).slice(0, 10))}</p>
          <footer className="flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:pb-3">
            {allowDelete && canDelete ? (
              commissionPaid ? (
                <span className="text-xs text-muted sm:mr-auto">A comissão já teve recebimento: apague os recebimentos em Comissões para poder excluir.</span>
              ) : (
                <form className="sm:mr-auto">
                  <ConfirmButton
                    message={`Excluir a NF ${detail.number ?? ""}? A comissão desta nota também será apagada e o pedido volta a esperar essas quantidades. Não dá para desfazer.`}
                    formAction={deleteInvoice.bind(null, detail.id)}
                    className={dangerBtn}
                  >
                    <Icon name="trash" size={15} />
                    Excluir nota
                  </ConfirmButton>
                </form>
              )
            ) : (
              <span className="sm:mr-auto" />
            )}
            <Link href={closeHref} replace scroll={false} className={ghostBtn}>
              Fechar
            </Link>
            {fromOrder ? (
              <Link href={`/faturamento?nota=${detail.id}`} className={primaryBtn}>
                Abrir no Faturamento
              </Link>
            ) : (
              <Link href={`/pedidos/${detail.order_id}`} className={primaryBtn}>
                Ver pedido
              </Link>
            )}
          </footer>
        </div>
      ) : null}
    </Sheet>
  );
}

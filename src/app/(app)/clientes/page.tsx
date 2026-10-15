import { SOLD_STATUSES } from "@/lib/orders";
import Link from "next/link";
import { getContext } from "@/lib/session";
import { createCustomer } from "./actions";
import { CustomerFields } from "./fields";
import { safeQ } from "@/lib/format";
import { digits } from "@/lib/br";
import { WhatsAppButton } from "@/components/whatsapp";
import { logoUrl } from "@/lib/storage";
import { PinMap, type PinPoint, type PinPending } from "@/components/pin-map";
import { saveLocation, markNotFound, refreshClientes } from "./actions";
import { formatDate, todayISO } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { SearchBox } from "@/components/search";
import { Icon } from "@/components/icons";
import {
  PageHeader, Toolbar, ErrorNote, OkNote, EmptyState, Badge, Avatar, SheetForm, NewButton,
  TableShell, CardList, RowLink, Count, th, td, tr,
} from "@/components/ui";

const PATH = "/clientes";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; novo?: string; q?: string; ver?: string }>;
}) {
  const sp = await searchParams;
  const q = safeQ(sp.q);
  const { supabase, canManage } = await getContext();

  let query = supabase
    .from("customers")
    .select("*")
    .order("name");
  if (q) {
    // CNPJ é guardado formatado; quem digita só números também encontra.
    const d = digits(q);
    const cnpjPattern = d.length >= 3 && d.length === q.replace(/[.\-/\s]/g, "").length ? `*${d.split("").join("*")}*` : `*${q}*`;
    query = query.or(`name.ilike.*${q}*,cnpj.ilike.${cnpjPattern}`);
  }

  // Último pedido de cada cliente (lista e cor do pin no mapa).
  const [{ data }, { data: lastOrders }] = await Promise.all([
    query,
    supabase
      .from("orders")
      .select("customer_id, order_date, principals(name)")
      .in("status", SOLD_STATUSES)
      .order("order_date", { ascending: false })
      .limit(20000),
  ]);
  const lastOrder = new Map<string, { date: string; principal: string }>();
  for (const o of lastOrders ?? []) {
    if (!lastOrder.has(o.customer_id)) {
      lastOrder.set(o.customer_id, { date: o.order_date, principal: (o.principals as unknown as { name: string } | null)?.name ?? "" });
    }
  }
  type C = {
    id: string; name: string; cnpj: string | null; contact_name: string | null; phone: string | null;
    city: string | null; state: string | null; status: string;
    street?: string | null; street_number?: string | null; district?: string | null; zip?: string | null; address?: string | null;
    logo_path?: string | null;
    latitude?: number | null; longitude?: number | null; geo_quality?: string | null; geocoded_at?: string | null;
  };
  const customers = (data ?? []) as C[];
  const view = sp.ver === "mapa" ? "mapa" : "lista";

  // Mapa: posição de cada cliente e a data do último pedido (para a cor do pin).
  const today = todayISO();
  const COLORS = { ativo: "var(--color-pen)", parado: "#ff5b22", nunca: "#a8a49b" };
  const daysSince = (iso: string) => Math.round((Date.parse(today) - Date.parse(iso)) / 86400000);
  let mapPoints: PinPoint[] = [];
  let pending: PinPending[] = [];
  if (view === "mapa") {
    mapPoints = customers
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => {
        const lastBuy = lastOrder.get(c.id)?.date;
        const days = lastBuy ? daysSince(lastBuy) : null;
        return {
          id: c.id,
          name: c.name,
          place: [c.district, [c.city, c.state].filter(Boolean).join("/")].filter(Boolean).join(" · "),
          lat: Number(c.latitude),
          lng: Number(c.longitude),
          quality: c.geo_quality ?? null,
          phone: c.phone,
          color: days == null ? COLORS.nunca : days > 60 ? COLORS.parado : COLORS.ativo,
          lines: [{ text: days == null ? "Ainda não comprou" : `Último pedido há ${days} dias`, alert: days != null && days > 60 }],
          href: `/clientes/${c.id}`,
          hrefLabel: "Ficha",
        };
      });
    pending = customers
      .filter((c) => c.latitude == null && !c.geocoded_at && (c.street || c.zip || c.city || c.address))
      .map((c) => ({
        id: c.id, name: c.name, street: c.street, street_number: c.street_number, district: c.district,
        city: c.city, state: c.state, zip: c.zip, address: c.address,
      }));
  }
  const noAddress = customers.filter((c) => c.latitude == null && (c.geocoded_at || !(c.street || c.zip || c.city || c.address))).length;
  const viewHref = (v: string) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (v === "mapa") p.set("ver", "mapa");
    const qs = p.toString();
    return qs ? `${PATH}?${qs}` : PATH;
  };

  const sheetOpen = sp.novo === "1";
  const empty = customers.length === 0;

  return (
    <>
      <PageHeader
        title="Clientes"
        hint={canManage ? "Todos os clientes do escritório." : "Os clientes da sua carteira."}
        action={<NewButton label="Novo cliente" fab />}
      />

      {sp.ok ? (
        <div className="mb-4">
          <OkNote message={sp.ok} />
        </div>
      ) : null}

      {empty && !q ? (
        <EmptyState icon="users" title="Nenhum cliente cadastrado" action={<NewButton label="Novo cliente" />}>
          Cadastre as lojas e empresas que você atende. Elas ficam disponíveis na hora de fazer um
          pedido.
        </EmptyState>
      ) : (
        <>
          <Toolbar>
            <SearchBox placeholder="Buscar por nome ou CNPJ" hint />
            <Count n={customers.length} one="cliente" many="clientes" />
            <div className="inline-flex rounded-[0.6rem] bg-hover p-0.5" role="group" aria-label="Modo de exibição">
              {(["lista", "mapa"] as const).map((v) => (
                <Link
                  key={v}
                  href={viewHref(v)}
                  scroll={false}
                  aria-current={view === v ? "true" : undefined}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition sm:h-8 ${
                    view === v ? "bg-surface text-ink shadow-panel" : "text-muted hover:text-ink-2"
                  }`}
                >
                  <Icon name={v === "lista" ? "menu" : "pin"} size={15} />
                  {v === "lista" ? "Lista" : "Mapa"}
                </Link>
              ))}
            </div>
          </Toolbar>

          {view === "mapa" && !empty ? (
            <>
              <PinMap
                points={mapPoints}
                pending={pending}
                noun={{ one: "cliente", many: "clientes" }}
                legend={[
                  { color: COLORS.ativo, label: "Comprou nos últimos 60 dias" },
                  { color: COLORS.parado, label: "Sem comprar há mais de 60 dias" },
                  { color: COLORS.nunca, label: "Ainda não comprou" },
                ]}
                saveAction={saveLocation}
                notFoundAction={markNotFound}
                refreshAction={refreshClientes}
              />
              {noAddress ? (
                <p className="mt-2 text-xs text-muted">
                  {noAddress} {noAddress === 1 ? "cliente não aparece" : "clientes não aparecem"} no mapa por falta de endereço ou endereço não encontrado. Complete o CEP e a rua na ficha.
                </p>
              ) : null}
            </>
          ) : empty ? (
            <EmptyState icon="search" title="Nada encontrado" compact>
              Nenhum cliente combina com “{q}”. Confira a grafia ou busque pelo CNPJ.
            </EmptyState>
          ) : (
            <>
              <TableShell>
                <thead>
                  <tr>
                    <th className={th}>Cliente</th>
                    <th className={th}>Cidade</th>
                    <th className={th}>Telefone</th>
                    <th className={th}>Último pedido</th>
                    <th className={`${th} w-14`}>
                      <span className="sr-only">WhatsApp</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const lo = lastOrder.get(c.id);
                    return (
                      <tr key={c.id} className={tr}>
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} size={30} src={logoUrl(c.logo_path)} />
                            <div className="min-w-0">
                              <RowLink href={`${PATH}/${c.id}`} className="block truncate font-medium text-ink">
                                {c.name}
                              </RowLink>
                              <p className="truncate text-xs text-muted">
                                {c.contact_name || (c.cnpj ? <span className="font-mono">{c.cnpj}</span> : "Sem contato")}
                              </p>
                            </div>
                            {c.status !== "ativo" ? <Badge>Inativo</Badge> : null}
                          </div>
                        </td>
                        <td className={`${td} text-ink-2`}>{[c.city, c.state].filter(Boolean).join(" / ") || <span className="text-faint">—</span>}</td>
                        <td className={`${td} tabular-nums text-ink-2`}>{c.phone || <span className="text-faint">—</span>}</td>
                        <td className={`${td} text-ink-2`}>
                          {lo ? (
                            <>
                              <span className="tabular-nums">{formatDate(lo.date)}</span>
                              <span className="block truncate text-xs text-muted">{lo.principal}</span>
                            </>
                          ) : (
                            <span className="text-faint">Nenhum</span>
                          )}
                        </td>
                        <td className={`${td} text-right`}>
                          <WhatsAppButton phone={c.phone} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>

              <CardList>
                {customers.map((c) => (
                  <li key={c.id} className="relative flex items-center gap-3 px-4 py-3 active:bg-hover">
                    <Avatar name={c.name} size={38} src={logoUrl(c.logo_path)} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`${PATH}/${c.id}`}
                        className="block truncate text-[15px] font-medium after:absolute after:inset-0"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-0.5 truncate text-[13px] text-muted">
                        {[[c.city, c.state].filter(Boolean).join("/"), c.contact_name].filter(Boolean).join(" · ") || c.phone || "Sem dados de contato"}
                      </p>
                    </div>
                    <WhatsAppButton phone={c.phone} />
                  </li>
                ))}
              </CardList>
            </>
          )}
        </>
      )}

      <Sheet open={sheetOpen} title="Novo cliente" description="Entra na sua carteira e já pode receber pedidos." closeHref={PATH}>
        <SheetForm action={createCustomer} closeHref={PATH} submitLabel="Salvar cliente">
          <ErrorNote message={sp.erro} />
          <CustomerFields />
        </SheetForm>
      </Sheet>
    </>
  );
}

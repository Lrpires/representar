import Link from "next/link";
import { getContext } from "@/lib/session";
import { getCounts } from "@/lib/counts";
import { setupSteps } from "@/lib/setup";
import { Icon, type IconName } from "@/components/icons";
import { Badge, Ring } from "@/components/ui";

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Recife" }),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function HomePage() {
  const { canManage, orgName } = await getContext();
  const counts = await getCounts();

  const stats: { label: string; n: number; href: string; icon: IconName }[] = [
    { label: "Representadas", n: counts.representadas, href: "/representadas", icon: "factory" },
    { label: "Produtos", n: counts.produtos, href: "/produtos", icon: "box" },
    { label: "Tabelas de preço", n: counts.tabelas, href: "/tabelas-de-preco", icon: "tag" },
    { label: "Clientes", n: counts.clientes, href: "/clientes", icon: "users" },
  ];

  const steps = setupSteps(counts, canManage);
  const done = steps.filter((s) => s.n > 0).length;
  const allDone = done === steps.length;
  const firstPending = steps.find((s) => s.n === 0);

  return (
    <>
      <header className="mb-7">
        <p className="text-sm text-muted">{orgName}</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-tight">
          {greeting()}.
        </h1>
      </header>

      <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`group min-w-0 rounded-[1.75rem] border p-4 transition hover:-translate-y-0.5 hover:shadow-float sm:p-5 ${
              s.n > 0
                ? "border-pen/15 bg-linear-to-b from-[#eef2ff] to-[#f5f7ff]"
                : "border-line bg-subtle"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-pen shadow-float sm:h-12 sm:w-12">
                <Icon name={s.icon} size={20} />
              </span>
              <span className="hidden sm:block">
                <Badge tone={s.n > 0 ? "pen" : "neutral"}>{s.n > 0 ? "Ativo" : "Vazio"}</Badge>
              </span>
            </div>
            <dt className="mt-4 text-sm text-muted">{s.label}</dt>
            <dd className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight">{s.n}</dd>
          </Link>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:gap-4">
        <section className="flex flex-col items-center rounded-[1.75rem] border border-line bg-subtle p-6 text-center">
          <h2 className="self-start text-base font-semibold">
            {allDone ? "Catálogo pronto" : "Primeiros passos"}
          </h2>
          <div className="my-6">
            <Ring value={done} max={steps.length} size={148} stroke={13}>
              <span className="text-3xl font-semibold tabular-nums">
                {done}
                <span className="text-lg text-faint">/{steps.length}</span>
              </span>
              <span className="text-xs text-muted">etapas</span>
            </Ring>
          </div>
          <p className="max-w-[16rem] text-sm leading-relaxed text-muted">
            {allDone
              ? "Tudo no lugar. O próximo módulo será o de pedidos."
              : "Complete as etapas para deixar o catálogo pronto para os pedidos."}
          </p>
        </section>

        <section className="rounded-[1.75rem] border border-line bg-subtle p-3 sm:p-4">
          <ul className="grid grid-cols-1 gap-2.5">
            {steps.map((step, i) => {
              const complete = step.n > 0;
              const isNext = step === firstPending;
              return (
                <li key={step.href}>
                  <Link
                    href={step.href}
                    className="group flex items-center gap-3.5 rounded-2xl border border-line bg-white p-3 transition hover:border-line-strong hover:shadow-float"
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
                        complete
                          ? "bg-ok text-white"
                          : isNext
                            ? "bg-pen-soft text-pen ring-2 ring-pen/30"
                            : "bg-hover text-faint"
                      }`}
                    >
                      {complete ? <Icon name="check" size={18} strokeWidth={2.6} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${complete ? "text-muted" : "font-medium text-ink"}`}
                      >
                        {step.title}
                      </span>
                      <span className="block truncate text-xs text-muted">{step.desc}</span>
                    </span>
                    {complete ? (
                      <span className="hidden text-xs tabular-nums text-muted sm:block">{step.n}</span>
                    ) : null}
                    <Icon
                      name="chevron-right"
                      size={17}
                      className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink-2"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}

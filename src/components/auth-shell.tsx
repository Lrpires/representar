import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "./ui";
import { Icon, type IconName } from "./icons";

const points: { icon: IconName; title: string; text: string }[] = [
  { icon: "receipt", title: "Pedido em menos de 2 minutos", text: "Cliente, representada e itens. Total e comissão calculados na hora." },
  { icon: "percent", title: "Comissão sob controle", text: "O previsto, o que falta receber e o que já caiu, por representada." },
  { icon: "calendar", title: "Nenhum cliente esquecido", text: "Próximo contato agendado para cada lead e cliente." },
];

// Moldura das telas de entrada: formulário à esquerda e apresentação à direita (computador).
export function AuthShell({ children, showcase = true }: { children: ReactNode; showcase?: boolean }) {
  return (
    <main className={`grid min-h-dvh bg-white ${showcase ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]" : ""}`}>
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="flex w-fit items-center gap-2.5" aria-label="Representar, página inicial">
          <Logo size={30} />
          <span className="text-base font-semibold tracking-tight">Representar</span>
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</div>
        <p className="text-center text-xs text-faint lg:text-left">
          Seus dados ficam protegidos e separados por conta.
        </p>
      </div>

      {showcase ? (
        <aside className="relative hidden overflow-hidden bg-pen lg:flex lg:flex-col lg:justify-center lg:px-16">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.14] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_70%_40%,black_20%,transparent_70%)]"
          />
          <div
            aria-hidden="true"
            className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#2e9e6b] opacity-20 blur-3xl"
          />
          <div className="relative max-w-md">
            <p className="text-[13px] font-medium text-[#9fd9bf]">Para representantes comerciais</p>
            <h2 className="mt-3 text-[1.875rem] font-semibold leading-[1.18] tracking-[-0.02em] text-white">
              Pedidos, clientes, comissões e contas em um só lugar.
            </h2>
            <ul className="mt-10 grid gap-3">
              {points.map((p) => (
                <li
                  key={p.title}
                  className="flex gap-3.5 rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                    <Icon name={p.icon} size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-white">{p.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-white/65">{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      ) : null}
    </main>
  );
}

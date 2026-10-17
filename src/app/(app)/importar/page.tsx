import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { IMPORTS } from "@/lib/import-schema";
import { PageHeader } from "@/components/ui";
import { ImportPanel } from "./import-panel";

export const metadata = { title: "Importar dados" };

// Trazer o que o escritório já tem em planilha: representadas, clientes e produtos.
export default async function ImportPage() {
  const { supabase, canManage } = await getContext();
  if (!canManage) redirect("/");

  const head = { count: "exact" as const, head: true };
  const [{ count: principals }, { count: customers }, { count: products }] = await Promise.all([
    supabase.from("principals").select("id", head),
    supabase.from("customers").select("id", head),
    supabase.from("products").select("id", head),
  ]);
  const existing: Record<string, number> = { representadas: principals ?? 0, clientes: customers ?? 0, produtos: products ?? 0 };

  return (
    <>
      <PageHeader
        title="Importar dados"
        hint="Traga o que você já tem em planilha. Baixe o modelo, preencha no Excel e envie: você confere tudo antes de gravar."
      />
      <ol className="mb-6 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted">
        <li>1 — Representadas</li>
        <li>2 — Clientes</li>
        <li>3 — Produtos</li>
      </ol>
      <div className="grid max-w-5xl gap-4">
        {IMPORTS.map((d) => (
          <ImportPanel
            key={d.kind}
            kind={d.kind}
            step={d.step}
            title={d.title}
            one={d.one}
            many={d.many}
            description={d.description}
            match={d.match}
            existing={existing[d.kind]}
            listHref={`/${d.kind}`}
          />
        ))}
      </div>
      <p className="mt-6 max-w-5xl text-xs leading-relaxed text-muted">
        Dica: se a sua planilha tem outras colunas, copie só as que existem no modelo. O sistema reconhece as colunas pelo título,
        em qualquer ordem. Pedidos antigos e notas fiscais em lote ficam para a próxima etapa.
      </p>
    </>
  );
}

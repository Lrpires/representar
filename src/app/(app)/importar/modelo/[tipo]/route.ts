import { getContext } from "@/lib/session";
import { importDef, visibleColumns } from "@/lib/import-schema";
import { buildTemplate } from "@/lib/import-template";

// Modelo em Excel para preencher e importar: uma aba com os títulos e uma aba de instruções.
// No modelo de produtos, as colunas Representada e Unidade viram listas de escolha.
export async function GET(_req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const def = importDef(tipo);
  if (!def) return new Response("Modelo não encontrado", { status: 404 });
  const { supabase, canManage, canSeeCommissions, orgName } = await getContext();
  if (!canManage) return new Response("Sem permissão", { status: 403 });

  const cols = visibleColumns(def, canSeeCommissions);
  const principals =
    def.kind === "produtos" ? (await supabase.from("principals").select("name").eq("active", true).order("name")).data : null;
  const buf = await buildTemplate(def, cols, orgName, principals);
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="modelo-${def.kind}-representar.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Baixa o arquivo de uma nota fiscal. A pasta é privada: geramos um link
// temporário (2 minutos) só para quem enxerga o pedido (a RLS confere).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("order_invoices")
    .select("file_path, file_name, number")
    .eq("id", id)
    .maybeSingle();
  if (!inv?.file_path) return new NextResponse("Arquivo não encontrado.", { status: 404 });

  const download = new URL(request.url).searchParams.get("baixar") === "1";
  const name = inv.file_name || `NF-${inv.number ?? id}.${inv.file_path.split(".").pop()}`;
  const { data, error } = await supabase.storage
    .from("invoices")
    .createSignedUrl(inv.file_path, 120, download ? { download: name } : undefined);
  if (error || !data) return new NextResponse("Não foi possível abrir o arquivo.", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}

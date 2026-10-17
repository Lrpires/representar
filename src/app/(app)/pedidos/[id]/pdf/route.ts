import { loadPrintableOrder, orderFileName } from "@/lib/order-print";
import { renderOrderPdf } from "@/lib/order-pdf";

// Baixa o pedido em PDF (A4) direto, sem passar pela janela de impressão.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await loadPrintableOrder(id);
  if (!order) return new Response("Pedido não encontrado", { status: 404 });
  const pdf = await renderOrderPdf(order);
  const name = orderFileName(order);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}

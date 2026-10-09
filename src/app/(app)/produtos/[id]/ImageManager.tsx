"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { productImageUrl } from "@/lib/storage";
import { registerImage } from "./actions";
import { ghostBtn } from "@/components/ui";

export type Img = { id: string; path: string; is_cover: boolean };

async function resize(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  return await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("falha ao converter"))), "image/jpeg", 0.85),
  );
}

export default function ImageManager({
  productId, orgId, images, canManage, onSetCover, onDelete,
}: {
  productId: string;
  orgId: string;
  images: Img[];
  canManage: boolean;
  onSetCover: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) throw new Error(`"${file.name}" não é uma imagem.`);
        const blob = await resize(file);
        const path = `${orgId}/${productId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("product-images").upload(path, blob, {
          contentType: "image/jpeg",
        });
        if (error) throw new Error(error.message);
        const r = await registerImage(productId, path);
        if (r.error) throw new Error(r.error);
      }
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar a imagem.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <li key={img.id} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="relative aspect-square bg-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={productImageUrl(img.path)} alt="" className="h-full w-full object-cover" />
                {img.is_cover ? (
                  <span className="absolute left-2 top-2 rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-white">
                    Capa
                  </span>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex items-center justify-between gap-1 p-2 text-[13px]">
                  {img.is_cover ? (
                    <span className="px-2 text-muted">Imagem principal</span>
                  ) : (
                    <form action={onSetCover}>
                      <input type="hidden" name="image_id" value={img.id} />
                      <button className="rounded-lg px-2 py-1 text-pen hover:bg-subtle">Usar como capa</button>
                    </form>
                  )}
                  <form action={onDelete}>
                    <input type="hidden" name="image_id" value={img.id} />
                    <button className="rounded-lg px-2 py-1 text-alert hover:bg-subtle">Excluir</button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhuma imagem ainda.</p>
      )}

      {canManage ? (
        <div className="mt-4">
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => upload(e.target.files)}
          />
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className={ghostBtn}>
            {busy ? "Enviando…" : "+ Adicionar imagens"}
          </button>
          {msg ? <p className="mt-2 text-sm text-alert">{msg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";
import { Avatar, ghostBtn } from "@/components/ui";
import { setPhoto } from "./actions";

// Corta no centro em quadrado e reduz para 400×400 (fica leve e nítida).
async function squareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 400;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 400, 400);
  return await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Não foi possível converter a imagem."))), "image/jpeg", 0.88),
  );
}

export function PhotoUploader({
  userId,
  name,
  photoUrl,
  removeAction,
}: {
  userId: string;
  name: string;
  photoUrl: string | null;
  removeAction: () => Promise<void>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload(file?: File) {
    if (!file) return;
    setMsg(null);
    if (!file.type.startsWith("image/")) return setMsg("Escolha uma imagem (JPG, PNG ou WEBP).");
    setBusy(true);
    try {
      const blob = await squareJpeg(file);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error } = await createClient().storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message.includes("Bucket") ? "Falta rodar a migração 010 no Supabase." : error.message);
      const r = await setPhoto(path);
      if (r.error) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar a foto.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="group relative rounded-full"
        aria-label="Trocar foto"
      >
        <Avatar name={name} size={80} round src={photoUrl} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
          {busy ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent" />
          ) : (
            <Icon name="upload" size={20} />
          )}
        </span>
      </button>
      <div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className={ghostBtn}>
            <Icon name="upload" size={15} />
            {busy ? "Enviando…" : photoUrl ? "Trocar foto" : "Enviar foto"}
          </button>
          {photoUrl ? (
            <button type="button" onClick={() => removeAction()} className={`${ghostBtn} text-alert`}>
              Remover
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted">A foto é cortada em quadrado. Aparece no menu e para a sua equipe.</p>
        {msg ? <p className="mt-1 text-xs text-alert">{msg}</p> : null}
      </div>
    </div>
  );
}

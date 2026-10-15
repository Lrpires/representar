"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setLogo, removeLogo } from "@/app/(app)/logos";
import { Icon } from "./icons";
import { Avatar } from "./ui";

// Reduz a logo para caber em 320×320 (sem cortar), mantendo o fundo transparente.
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Não foi possível converter a imagem."))), "image/png"),
  );
}

// Logo clicável: toque para enviar ou trocar a logomarca do cliente/representada.
export function LogoField({
  kind,
  id,
  orgId,
  name,
  url,
  size = 56,
  editable = true,
}: {
  kind: "clientes" | "representadas";
  id: string;
  orgId: string;
  name: string;
  url: string | null;
  size?: number;
  editable?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  async function upload(file?: File) {
    if (!file) return;
    setMsg(null);
    setMenu(false);
    if (!file.type.startsWith("image/")) return setMsg("Escolha uma imagem (PNG, JPG ou WEBP).");
    setBusy(true);
    try {
      const blob = await shrink(file);
      const path = `${orgId}/${kind}/${id}/${crypto.randomUUID()}.png`;
      const { error } = await createClient().storage.from("logos").upload(path, blob, { contentType: "image/png" });
      if (error) throw new Error(error.message.includes("Bucket") ? "Falta rodar a migração 015 no Supabase." : error.message);
      const r = await setLogo(kind, id, path);
      if (r.error) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar a logo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setMenu(false);
    setBusy(true);
    const r = await removeLogo(kind, id);
    setBusy(false);
    if (r.error) setMsg(r.error);
    else router.refresh();
  }

  const box = (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Logo de ${name}`} className="h-full w-full object-contain p-1" />
      ) : (
        <Avatar name={name} size={size - 2} />
      )}
      {busy ? (
        <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-pen border-r-transparent" />
        </span>
      ) : null}
    </span>
  );

  if (!editable) return box;

  return (
    <span className="relative inline-flex flex-col">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
      <button
        type="button"
        onClick={() => (url ? setMenu((m) => !m) : input.current?.click())}
        className="group relative rounded-xl"
        aria-label={url ? "Trocar ou remover a logo" : "Enviar logo"}
        title={url ? "Trocar ou remover a logo" : "Enviar logo"}
      >
        {box}
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-field transition group-hover:text-pen">
          <Icon name={url ? "edit" : "upload"} size={12} />
        </span>
      </button>
      {menu ? (
        <span className="absolute left-0 top-[calc(100%+6px)] z-40 w-44 animate-pop-in rounded-lg bg-surface p-1 shadow-menu">
          <button type="button" onClick={() => input.current?.click()} className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-[13px] hover:bg-hover">
            <Icon name="upload" size={14} className="text-muted" />
            Trocar logo
          </button>
          <button type="button" onClick={remove} className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-[13px] text-alert hover:bg-alert-soft">
            <Icon name="trash" size={14} />
            Remover logo
          </button>
        </span>
      ) : null}
      {msg ? <span className="absolute left-0 top-[calc(100%+4px)] z-30 w-56 rounded-md bg-alert-soft px-2 py-1 text-[11px] text-alert">{msg}</span> : null}
    </span>
  );
}

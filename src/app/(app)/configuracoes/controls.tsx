"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COLOR_PRESETS, themeVars } from "@/lib/theme";
import { formatOrderNumber } from "@/lib/orders";
import { Icon } from "@/components/icons";
import { Field, ghostBtn, inputCls } from "@/components/ui";
import { setLogo } from "./actions";

/* ---------- Logo ---------- */

// Reduz para no máximo 600px no lado maior, mantendo o fundo transparente (PNG).
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Não foi possível converter a imagem."))), "image/png"),
  );
}

export function LogoUploader({
  orgId,
  logoUrl,
  orgName,
  disabled,
  removeAction,
}: {
  orgId: string;
  logoUrl: string | null;
  orgName: string;
  disabled?: boolean;
  removeAction: () => Promise<void>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    if (!file.type.startsWith("image/")) return setMsg("Escolha um arquivo de imagem (PNG, JPG ou WEBP).");
    setBusy(true);
    try {
      const blob = await shrink(file);
      const path = `${orgId}/marca/${crypto.randomUUID()}.png`;
      const { error } = await createClient()
        .storage.from("product-images")
        .upload(path, blob, { contentType: "image/png" });
      if (error) throw new Error(error.message);
      const r = await setLogo(path);
      if (r.error) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar a logo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex h-20 w-full shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong bg-subtle p-3 sm:w-48 [background-image:linear-gradient(45deg,#eef1f2_25%,transparent_25%,transparent_75%,#eef1f2_75%),linear-gradient(45deg,#eef1f2_25%,transparent_25%,transparent_75%,#eef1f2_75%)] [background-position:0_0,6px_6px] [background-size:12px_12px]">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`Logo de ${orgName}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted">Sem logo</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
          <button type="button" disabled={disabled || busy} onClick={() => input.current?.click()} className={ghostBtn}>
            {busy ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
            ) : (
              <Icon name="upload" size={15} />
            )}
            {logoUrl ? "Trocar logo" : "Enviar logo"}
          </button>
          {logoUrl && !disabled ? (
            <button type="button" onClick={() => removeAction()} className={`${ghostBtn} text-alert`}>
              Remover
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          PNG com fundo transparente fica melhor. Ela aparece no menu e, depois, nos pedidos em PDF.
        </p>
        {msg ? <p className="mt-1 text-xs text-alert">{msg}</p> : null}
      </div>
    </div>
  );
}

/* ---------- Cor ---------- */

export function ColorPicker({ value, disabled }: { value: string; disabled?: boolean }) {
  const [color, setColor] = useState(value);

  // Prévia ao vivo: o sistema inteiro já muda de cor enquanto você escolhe.
  useEffect(() => {
    const root = document.documentElement;
    for (const decl of themeVars(color).split(";")) {
      const [k, v] = decl.split(":");
      root.style.setProperty(k, v);
    }
  }, [color]);
  // Ao sair da página sem salvar, volta para a cor salva (definida no <style> do layout).
  useEffect(
    () => () => {
      for (const k of ["--color-pen", "--color-pen-dark", "--color-pen-soft", "--color-pen-ink"]) {
        document.documentElement.style.removeProperty(k);
      }
    },
    [],
  );

  const custom = !COLOR_PRESETS.some((p) => p.hex === color);
  return (
    <div>
      <input type="hidden" name="brand_color" value={color} />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {COLOR_PRESETS.map((p) => {
          const active = p.hex === color;
          return (
            <button
              key={p.hex}
              type="button"
              disabled={disabled}
              onClick={() => setColor(p.hex)}
              aria-pressed={active}
              title={p.name}
              className={`group flex flex-col items-center gap-1.5 rounded-lg p-1.5 text-[11px] transition ${
                active ? "bg-hover text-ink" : "text-muted hover:bg-hover"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-white ring-offset-2 transition ${
                  active ? "ring-2 ring-ink/70" : ""
                }`}
                style={{ background: p.hex }}
              >
                {active ? <Icon name="check" size={16} strokeWidth={2.4} /> : null}
              </span>
              <span className="w-full truncate text-center">{p.name}</span>
            </button>
          );
        })}
      </div>
      <label className="mt-4 flex items-center gap-3 text-[13px] text-ink-2">
        <input
          type="color"
          value={color}
          disabled={disabled}
          onChange={(e) => setColor(e.target.value.toLowerCase())}
          className="h-9 w-12 cursor-pointer rounded-md border border-line-strong bg-white p-1"
        />
        <span>
          Outra cor{custom ? <span className="ml-1 font-mono text-xs text-muted">{color}</span> : null}
        </span>
      </label>

      {/* Amostra de como os elementos ficam */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-subtle p-4">
        <span className="inline-flex h-8 items-center rounded-lg bg-pen px-3 text-[13px] font-medium text-white shadow-btn">
          Botão principal
        </span>
        <span className="inline-flex h-[1.375rem] items-center rounded-md bg-pen-soft px-2 text-xs font-medium text-pen-ink">
          Destaque
        </span>
        <span className="text-[13px] font-medium text-pen">Link</span>
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-active">
          <span className="block h-full w-2/3 rounded-full bg-pen" />
        </span>
      </div>
    </div>
  );
}

/* ---------- Numeração do pedido ---------- */

export function OrderNumbering({
  start,
  prefix,
  suffix,
  lastNumber,
  disabled,
}: {
  start: number;
  prefix: string;
  suffix: string;
  lastNumber: number;
  disabled?: boolean;
}) {
  const [s, setS] = useState(String(start));
  const [p, setP] = useState(prefix);
  const [x, setX] = useState(suffix);
  const next = Math.max(lastNumber + 1, Number(s) || 1);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Prefixo" hint="Ex.: PED-">
          <input name="order_prefix" value={p} maxLength={12} disabled={disabled} onChange={(e) => setP(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Número inicial">
          <input
            name="order_number_start"
            value={s}
            inputMode="numeric"
            disabled={disabled}
            onChange={(e) => setS(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className={`${inputCls} tabular-nums`}
          />
        </Field>
        <Field label="Sufixo" hint="Ex.: /26">
          <input name="order_suffix" value={x} maxLength={12} disabled={disabled} onChange={(e) => setX(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-pen-soft px-4 py-3">
        <span className="text-[13px] text-pen-ink">Próximo pedido:</span>
        <span className="font-mono text-base font-semibold text-pen-ink">
          {formatOrderNumber(next, { orderPrefix: p, orderSuffix: x })}
        </span>
        {lastNumber > 0 && Number(s) <= lastNumber ? (
          <span className="w-full text-xs text-pen-ink/80">
            Já existem pedidos até o nº {lastNumber}, então a numeração continua a partir daí.
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- Unidades ---------- */

export function UnitPicker({
  groups,
  selected,
  disabled,
}: {
  groups: { label: string; units: [string, string][] }[];
  selected: string[];
  disabled?: boolean;
}) {
  const [on, setOn] = useState(new Set(selected));
  const all = groups.flatMap((g) => g.units.map(([v]) => v));
  const toggle = (v: string) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-auto text-[13px] text-muted">
          {on.size} de {all.length} marcadas
        </span>
        <button type="button" disabled={disabled} onClick={() => setOn(new Set(all))} className="rounded-md px-2 py-1 text-[13px] font-medium text-pen hover:bg-pen-soft">
          Marcar todas
        </button>
        <button type="button" disabled={disabled} onClick={() => setOn(new Set())} className="rounded-md px-2 py-1 text-[13px] text-muted hover:bg-hover">
          Desmarcar todas
        </button>
      </div>
      <div className="grid gap-5">
        {groups.map((g) => (
          <fieldset key={g.label}>
            <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">{g.label}</legend>
            <div className="flex flex-wrap gap-2">
              {g.units.map(([value, label]) => {
                const checked = on.has(value);
                return (
                  <label
                    key={value}
                    className={`inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg border px-3 text-[13px] transition sm:h-8 ${
                      checked ? "border-pen bg-pen-soft font-medium text-pen-ink" : "border-line-strong bg-white text-ink-2 hover:bg-hover"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="units"
                      value={value}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(value)}
                      className="sr-only"
                    />
                    {checked ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

/* ---------- Prazos de atraso ---------- */

export function DelaySettings({ warn, critical, disabled }: { warn: number; critical: number; disabled?: boolean }) {
  const [w, setW] = useState(String(warn));
  const [c, setC] = useState(String(critical));
  const wn = Number(w) || 0;
  const cn = Number(c) || 0;
  const invalid = !wn || !cn || cn <= wn;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Aviso (amarelo) a partir de" hint="Dias desde o envio sem faturar tudo.">
          <span className="relative block">
            <input
              name="order_warn_days"
              inputMode="numeric"
              value={w}
              disabled={disabled}
              onChange={(e) => setW(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className={`${inputCls} pr-12 tabular-nums`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">dias</span>
          </span>
        </Field>
        <Field label="Crítico (vermelho) a partir de" hint="Precisa ser maior que o aviso.">
          <span className="relative block">
            <input
              name="order_critical_days"
              inputMode="numeric"
              value={c}
              disabled={disabled}
              onChange={(e) => setC(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className={`${inputCls} pr-12 tabular-nums ${invalid ? "!border-alert" : ""}`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">dias</span>
          </span>
        </Field>
      </div>
      {/* Linha do tempo de exemplo */}
      <div className="rounded-lg bg-subtle p-3">
        <div className="flex h-2 overflow-hidden rounded-full">
          <span className="bg-line-strong" style={{ flex: Math.max(wn, 1) }} />
          <span className="bg-[#e09f3e]" style={{ flex: Math.max(cn - wn, 1) }} />
          <span className="bg-alert" style={{ flex: Math.max(Math.round(cn * 0.4), 2) }} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted">
          <span>0 a {Math.max(wn - 1, 0)} dias: no prazo</span>
          <span className="text-warn">{wn} a {Math.max(cn - 1, wn)} dias: atenção</span>
          <span className="text-right text-alert">{cn}+ dias: crítico</span>
        </div>
      </div>
      {invalid ? <p className="text-xs text-alert">O prazo crítico precisa ser maior que o de aviso.</p> : null}
    </div>
  );
}

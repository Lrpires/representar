"use client";

import { useRef, useState } from "react";
import { fetchCep } from "@/lib/lookup";
import { digits } from "@/lib/br";
import { fillForm } from "./autofill";
import { Icon } from "./icons";
import { Field, ghostBtn, inputCls } from "./ui";

export type AddressValues = {
  zip?: string | null;
  street?: string | null;
  street_number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

const formatCep = (raw: string) => {
  const d = digits(raw).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

// Bloco de endereço com CEP + botão Buscar (ViaCEP). Ocupa as 2 colunas do formulário.
export function AddressFields({ values = {}, disabled }: { values?: AddressValues; disabled?: boolean }) {
  const v = (x: string | null | undefined) => x ?? "";
  const [cep, setCep] = useState(formatCep(v(values.zip)));
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "notfound" | "error">("idle");
  const ref = useRef<HTMLInputElement>(null);

  async function search() {
    if (digits(cep).length !== 8) {
      setStatus("notfound");
      return;
    }
    setStatus("loading");
    try {
      const r = await fetchCep(cep);
      if (!r) return setStatus("notfound");
      const form = ref.current?.form ?? null;
      // CEP novo = endereço novo: limpa tudo (inclusive número e complemento) e preenche.
      for (const name of ["street", "street_number", "complement", "district", "city", "state"]) {
        const el = form?.elements.namedItem(name);
        if (el instanceof HTMLInputElement) el.value = "";
      }
      fillForm(form, { street: r.street, district: r.district, city: r.city, state: r.state });
      setStatus("found");
      (form?.elements.namedItem(r.street ? "street_number" : "street") as HTMLInputElement | null)?.focus();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">
          <label htmlFor="zip">CEP</label>
        </span>
        <div className="flex gap-2">
          <input
            ref={ref}
            id="zip"
            name="zip"
            value={cep}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            onChange={(e) => {
              setCep(formatCep(e.target.value));
              setStatus("idle");
            }}
            onKeyDown={(e) => {
              // Enter no CEP busca o endereço em vez de enviar o formulário.
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            className={inputCls}
          />
          <button
            type="button"
            onClick={search}
            disabled={disabled || status === "loading"}
            className={`${ghostBtn} w-28 sm:w-24`}
          >
            {status === "loading" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
            ) : (
              <Icon name="search" size={14} />
            )}
            Buscar
          </button>
        </div>
        {status === "found" ? (
          <span className="mt-1.5 block text-xs text-ok">Endereço preenchido. Confira e informe o número.</span>
        ) : status === "notfound" ? (
          <span className="mt-1.5 block text-xs text-warn">CEP não encontrado. Confira os 8 números.</span>
        ) : status === "error" ? (
          <span className="mt-1.5 block text-xs text-warn">Não foi possível consultar o CEP agora. Preencha à mão.</span>
        ) : (
          <span className="mt-1.5 block text-xs text-muted">Clique em Buscar para preencher o endereço.</span>
        )}
      </div>
      <div className="hidden sm:col-span-3 sm:block" />
      <Field label="Rua" className="sm:col-span-4">
        <input name="street" defaultValue={v(values.street)} disabled={disabled} autoComplete="address-line1" className={inputCls} />
      </Field>
      <Field label="Número" className="sm:col-span-2">
        <input name="street_number" defaultValue={v(values.street_number)} disabled={disabled} className={inputCls} />
      </Field>
      <Field label="Complemento" className="sm:col-span-3">
        <input name="complement" defaultValue={v(values.complement)} disabled={disabled} placeholder="Sala, galpão, loja…" className={inputCls} />
      </Field>
      <Field label="Bairro" className="sm:col-span-3">
        <input name="district" defaultValue={v(values.district)} disabled={disabled} className={inputCls} />
      </Field>
      <Field label="Cidade" className="sm:col-span-4">
        <input name="city" defaultValue={v(values.city)} disabled={disabled} autoComplete="address-level2" className={inputCls} />
      </Field>
      <Field label="UF" className="sm:col-span-2">
        <input
          name="state"
          maxLength={2}
          defaultValue={v(values.state)}
          disabled={disabled}
          autoComplete="address-level1"
          className={`${inputCls} uppercase`}
        />
      </Field>
    </div>
  );
}

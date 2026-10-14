"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { formatCnpj, formatCpf, formatPhone, isValidCnpj, isValidPhone, digits } from "@/lib/br";
import { fetchCnpj, type CnpjResult } from "@/lib/lookup";
import { fillForm } from "./autofill";
import { Icon } from "./icons";

const masks = {
  cnpj: { format: formatCnpj, valid: isValidCnpj, full: 14, placeholder: "00.000.000/0000-00", error: "CNPJ inválido" },
  cpf: { format: formatCpf, valid: () => true, full: 11, placeholder: "000.000.000-00", error: "CPF inválido" },
  phone: { format: formatPhone, valid: isValidPhone, full: 10, placeholder: "(00) 00000-0000", error: "Telefone incompleto. Inclua o DDD." },
};

// Como os dados do CNPJ viram campos de cada formulário.
const cnpjFill = {
  customer: (d: CnpjResult) => ({
    name: d.legalName,
    phone: d.phone,
    zip: d.zip,
    street: d.street,
    street_number: d.number,
    complement: d.complement,
    district: d.district,
    city: d.city,
    state: d.state,
  }),
  principal: (d: CnpjResult) => ({
    name: d.tradeName || d.legalName,
    legal_name: d.legalName,
    phone: d.phone,
    email: d.email,
    zip: d.zip,
    street: d.street,
    street_number: d.number,
    complement: d.complement,
    district: d.district,
    city: d.city,
    state: d.state,
  }),
};

type Lookup = { state: "idle" | "loading" | "found" | "notfound" | "error"; text?: string };

// Campo com máscara (CNPJ, CPF, telefone). Avisa o erro ao sair do campo.
// Com lookup, o CNPJ completo e válido dispara a busca na BrasilAPI e preenche o formulário.
export function MaskedInput({
  mask,
  lookup,
  defaultValue,
  className = "",
  ...rest
}: {
  mask: keyof typeof masks;
  lookup?: keyof typeof cnpjFill;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const m = masks[mask];
  const [value, setValue] = useState(m.format(String(defaultValue ?? "")));
  const [touched, setTouched] = useState(false);
  const [found, setFound] = useState<Lookup>({ state: "idle" });
  const d = digits(value);
  const wrong = d.length > 0 && (d.length < m.full || !m.valid(value));
  const invalid = touched && wrong;
  const ref = useRef<HTMLInputElement>(null);
  // Não busca de novo o CNPJ que já veio preenchido (edição).
  const lastLooked = useRef(digits(String(defaultValue ?? "")));

  // O navegador não deixa enviar o formulário com o campo errado.
  useEffect(() => {
    ref.current?.setCustomValidity(wrong ? m.error : "");
  }, [wrong, m.error]);

  useEffect(() => {
    if (!lookup || mask !== "cnpj" || d.length !== 14 || wrong || d === lastLooked.current) return;
    lastLooked.current = d;
    const ctrl = new AbortController();
    setFound({ state: "loading" });
    fetchCnpj(d, ctrl.signal)
      .then((data) => {
        if (!data) return setFound({ state: "notfound" });
        fillForm(ref.current?.form ?? null, cnpjFill[lookup](data));
        const situation = data.situation && data.situation !== "Ativa" ? ` · Situação: ${data.situation}` : "";
        setFound({ state: "found", text: `${data.legalName}${situation}` });
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setFound({ state: "error" });
      });
    return () => ctrl.abort();
  }, [d, wrong, lookup, mask]);

  const help =
    invalid ? <span className="mt-1.5 block text-xs text-alert">{m.error}</span>
    : !lookup ? null
    : found.state === "loading" ? <span className="mt-1.5 block text-xs text-muted">Buscando dados do CNPJ na Receita…</span>
    : found.state === "found" ? (
      <span className="mt-1.5 block truncate text-xs text-ok" title={found.text}>
        Dados preenchidos: {found.text}
      </span>
    )
    : found.state === "notfound" ? <span className="mt-1.5 block text-xs text-warn">CNPJ não encontrado na Receita. Preencha os dados à mão.</span>
    : found.state === "error" ? <span className="mt-1.5 block text-xs text-warn">Não foi possível consultar o CNPJ agora. Preencha à mão.</span>
    : !value ? <span className="mt-1.5 block text-xs text-muted">Digite o CNPJ para preencher os dados automaticamente.</span>
    : null;

  return (
    <>
      <span className="relative block">
        <input
          {...rest}
          ref={ref}
          value={value}
          inputMode={mask === "phone" ? "tel" : "numeric"}
          autoComplete="off"
          placeholder={rest.placeholder ?? m.placeholder}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            setValue(m.format(e.target.value));
            if (found.state !== "idle" && found.state !== "loading") setFound({ state: "idle" });
          }}
          onBlur={() => setTouched(true)}
          onInvalid={() => setTouched(true)}
          className={`${className} ${lookup ? "pr-9" : ""} ${invalid ? "!border-alert focus:!ring-alert/15" : ""}`}
        />
        {lookup && found.state === "loading" ? (
          <span className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-pen border-r-transparent" />
        ) : null}
        {lookup && found.state === "found" ? (
          <Icon name="check" size={16} strokeWidth={2.2} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ok" />
        ) : null}
      </span>
      {help}
    </>
  );
}

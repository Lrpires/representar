"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Lista de escolha que filtra a página pelo endereço (?param=valor), mantendo os outros filtros.
export function UrlSelect({
  param,
  options,
  allLabel,
  ariaLabel,
}: {
  param: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  ariaLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(param) ?? "";

  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => {
        const sp = new URLSearchParams(params.toString());
        if (e.target.value) sp.set(param, e.target.value);
        else sp.delete(param);
        sp.delete("ok");
        sp.delete("erro");
        const qs = sp.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
      className={`h-11 rounded-lg border bg-surface pl-3 text-base shadow-field outline-none transition hover:border-[#bdb8ab] focus:border-accent focus:ring-[3px] focus:ring-accent/25 sm:h-8 sm:text-[13px] ${
        value ? "border-pen/40 font-medium text-pen-ink" : "border-line-strong text-ink-2"
      }`}
    >
      {allLabel ? <option value="">{allLabel}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

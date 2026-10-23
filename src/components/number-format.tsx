"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  DEFAULT_FMT, currencySymbol, inputText, money, numberText, parseAmount, setActiveFormat, type NumFmt,
} from "@/lib/number-format";

const Ctx = createContext<NumFmt>(DEFAULT_FMT);

// Entrega a moeda e o formato dos números do escritório para as telas do navegador.
export function NumberFormatProvider({ value, children }: { value: NumFmt; children: ReactNode }) {
  if (typeof window !== "undefined") setActiveFormat(value);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Funções de formatação já no formato do escritório (para componentes do navegador).
export function useNumberFormat() {
  const f = useContext(Ctx);
  return useMemo(
    () => ({
      fmt: f,
      symbol: currencySymbol(f),
      brl: (v: number | string) => money(v, f),
      numText: (n: number | null | undefined, decimals = 4) => (n == null || !Number.isFinite(Number(n)) ? "" : inputText(Number(n), decimals, f)),
      priceText: (n: number | null | undefined) => (n == null || !Number.isFinite(Number(n)) ? "" : inputText(Number(n), 4, f, 2)),
      numberText: (n: number, maxDecimals = 3) => numberText(n, maxDecimals, f),
      num: (raw: string | number | null | undefined) => {
        if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
        const n = parseAmount(raw ?? "", f);
        return Number.isFinite(n) ? n : 0;
      },
    }),
    [f],
  );
}

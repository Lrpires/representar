"use client";

import { useEffect } from "react";
import { Icon } from "./icons";
import { ghostBtn } from "./ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={ghostBtn}>
      <Icon name="printer" size={15} />
      Imprimir
    </button>
  );
}

// Abre a janela de impressão sozinho ao carregar (o "Imprimir / PDF" dos relatórios).
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}

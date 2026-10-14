"use client";

import { Icon } from "./icons";
import { primaryBtn } from "./ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={primaryBtn}>
      <Icon name="printer" size={15} />
      Imprimir / Salvar PDF
    </button>
  );
}

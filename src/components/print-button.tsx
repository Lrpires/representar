"use client";

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

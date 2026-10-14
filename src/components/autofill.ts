"use client";

// Preenche campos de um formulário pelo nome (name="..."), funcionando também
// com campos controlados pelo React (ex.: telefone com máscara).
//
// Regra: só escreve em campo vazio ou em campo que a própria busca preencheu
// antes (ex.: o usuário trocou de CNPJ). O que a pessoa digitou não é apagado.

const filledBefore = new WeakMap<HTMLFormElement, Map<string, string>>();

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function fillForm(form: HTMLFormElement | null, values: Record<string, string>): number {
  if (!form) return 0;
  const memory = filledBefore.get(form) ?? new Map<string, string>();
  filledBefore.set(form, memory);
  let count = 0;
  for (const [name, value] of Object.entries(values)) {
    if (!value) continue;
    const el = form.elements.namedItem(name);
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
    const current = el.value.trim();
    if (current && current !== memory.get(name)) continue;
    setNativeValue(el, value);
    memory.set(name, value);
    count++;
  }
  return count;
}

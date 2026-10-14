"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

// Botão de envio que mostra "carregando" enquanto o formulário é processado.
export function SubmitButton({
  children,
  pending: pendingLabel,
  className,
  formAction,
  name,
  value,
}: {
  children: ReactNode;
  pending?: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      formAction={formAction}
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
          {pendingLabel ?? "Salvando…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

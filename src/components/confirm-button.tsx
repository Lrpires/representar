"use client";

import type { ReactNode } from "react";

// Botão de envio que pede confirmação antes (excluir, cancelar…).
export function ConfirmButton({
  message,
  formAction,
  className,
  children,
}: {
  message: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      formAction={formAction}
      formNoValidate
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

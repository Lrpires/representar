import { whatsappUrl } from "@/lib/br";
import { Icon } from "./icons";

// Botão verde do WhatsApp (fica acima do link da linha).
export function WhatsAppButton({ phone, label }: { phone: string | null; label?: boolean }) {
  const url = whatsappUrl(phone);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir WhatsApp"
      title="Abrir WhatsApp"
      className={`relative z-10 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-[#1f8f5a] transition hover:bg-ok-soft ${
        label ? "h-11 border border-line-strong bg-white px-3.5 text-sm font-medium shadow-field sm:h-8 sm:px-3 sm:text-[13px]" : "h-10 w-10 sm:h-8 sm:w-8"
      }`}
    >
      <Icon name="whatsapp" size={label ? 16 : 18} />
      {label ? "Abrir WhatsApp" : null}
    </a>
  );
}

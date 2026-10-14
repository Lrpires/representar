import { redirect } from "next/navigation";

// Volta para a página com a mensagem de erro na URL.
export function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}erro=${encodeURIComponent(message)}`);
}

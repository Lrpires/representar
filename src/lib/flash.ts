import { redirect } from "next/navigation";

// Volta para a página com a mensagem de erro na URL.
export function fail(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

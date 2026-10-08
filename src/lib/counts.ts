import { cache } from "react";
import { getContext } from "@/lib/session";

export type Counts = {
  representadas: number;
  produtos: number;
  tabelas: number;
  clientes: number;
};

// Totais usados no menu lateral e na tela inicial (calculados uma vez por visita).
export const getCounts = cache(async (): Promise<Counts> => {
  const { supabase } = await getContext();
  const count = async (table: string) => {
    const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
    return count ?? 0;
  };
  const [representadas, produtos, tabelas, clientes] = await Promise.all([
    count("principals"),
    count("products"),
    count("price_tables"),
    count("customers"),
  ]);
  return { representadas, produtos, tabelas, clientes };
});

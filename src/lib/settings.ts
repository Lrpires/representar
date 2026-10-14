import { cache } from "react";
import { getContext } from "@/lib/session";
import { productImageUrl } from "@/lib/storage";
import { UNITS } from "@/lib/units";
import { DEFAULT_COLOR } from "@/lib/theme";

export { COLOR_PRESETS, DEFAULT_COLOR, themeVars } from "@/lib/theme";
export { formatOrderNumber } from "@/lib/orders";

export type OrgSettings = {
  name: string;
  logoUrl: string | null;
  logoPath: string | null;
  color: string;
  units: string[]; // unidades visíveis nos produtos
  allUnits: boolean;
  orderStart: number;
  orderPrefix: string;
  orderSuffix: string;
};

// Configurações do escritório (uma consulta por página). Se a migração 008 ainda
// não foi rodada, devolve os padrões em vez de quebrar.
export const getSettings = cache(async (): Promise<OrgSettings> => {
  const { supabase, orgId, orgName } = await getContext();
  const { data, error } = await supabase
    .from("organizations")
    .select("name, logo_path, brand_color, enabled_units, order_number_start, order_prefix, order_suffix")
    .eq("id", orgId)
    .maybeSingle();
  const d = error ? null : data;
  const enabled = (d?.enabled_units as string[] | null) ?? [];
  return {
    name: d?.name ?? orgName,
    logoPath: d?.logo_path ?? null,
    logoUrl: d?.logo_path ? productImageUrl(d.logo_path) : null,
    color: d?.brand_color ?? DEFAULT_COLOR,
    units: enabled.length ? enabled : UNITS.map((u) => u.value),
    allUnits: enabled.length === 0,
    orderStart: d?.order_number_start ?? 1,
    orderPrefix: d?.order_prefix ?? "",
    orderSuffix: d?.order_suffix ?? "",
  };
});

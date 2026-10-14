// Endereço -> coordenadas, com serviços gratuitos chamados do navegador.
// Ordem, da mais precisa para a menos:
//   1) rua + número          -> "endereco" (só quando o número existe no OpenStreetMap)
//   2) rua dentro do bairro  -> "rua"      (o trecho da rua naquele bairro)
//   3) centro do bairro      -> "bairro"
//   4) centro da cidade      -> "cidade"
// Só o CEP? O ViaCEP informa rua e bairro antes da busca.
// Todo resultado precisa ser na mesma cidade do cadastro; se não for, é descartado.
// O OpenStreetMap (Nominatim) pede no máximo 1 consulta por segundo.

import { digits } from "./br";

export type GeoInput = {
  street?: string | null;
  street_number?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  address?: string | null; // endereço antigo em texto livre
};

export type GeoQuality = "endereco" | "rua" | "bairro" | "cidade";
export type GeoResult = { lat: number; lng: number; quality: GeoQuality };

export const GEO_LABEL: Record<string, string> = {
  endereco: "Endereço exato",
  rua: "Aproximado: na rua (número não encontrado no mapa)",
  bairro: "Aproximado: centro do bairro",
  cidade: "Aproximado: centro da cidade",
  cep: "Aproximado: pelo CEP",
  manual: "Posição ajustada à mão",
};

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type Hit = {
  lat: number;
  lng: number;
  houseNumber?: string;
  city: string;
  suburb: string;
  type: string;
};

let last = 0;
// Respeita 1 consulta por segundo mesmo quando várias buscas acontecem em sequência.
async function nominatim(params: Record<string, string>, signal?: AbortSignal): Promise<Hit | null> {
  const gap = Date.now() - last;
  if (gap < 1100) await wait(1100 - gap);
  last = Date.now();
  const url = `${NOMINATIM}?${new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", addressdetails: "1", ...params })}`;
  const res = await fetch(url, { signal, headers: { "Accept-Language": "pt-BR" } });
  if (!res.ok) return null;
  const [hit] = (await res.json()) as {
    lat: string; lon: string; addresstype?: string;
    address?: Record<string, string>;
  }[];
  if (!hit) return null;
  const a = hit.address ?? {};
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    houseNumber: a.house_number,
    city: a.city || a.town || a.municipality || a.village || a.city_district || "",
    suburb: a.suburb || a.neighbourhood || a.quarter || "",
    type: hit.addresstype ?? "",
  };
}

// Completa rua e bairro pelo CEP (ViaCEP) quando o cadastro não tem.
async function fromCep(cep: string, signal?: AbortSignal) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal });
    if (!res.ok) return null;
    const d = await res.json();
    if (d.erro) return null;
    return { street: d.logradouro as string, district: d.bairro as string, city: d.localidade as string, state: d.uf as string };
  } catch {
    return null;
  }
}

export async function geocode(input: GeoInput, signal?: AbortSignal): Promise<GeoResult | null> {
  let city = input.city?.split("/")[0].trim() || "";
  let state = input.state?.trim() || input.city?.split("/")[1]?.trim() || "";
  let street = input.street?.trim() || "";
  let district = input.district?.trim() || "";
  const number = input.street_number?.trim().replace(/^s\/?n$/i, "") || "";

  const cep = digits(input.zip);
  if (cep.length === 8 && (!street || !district || !city)) {
    const v = await fromCep(cep, signal);
    if (v) {
      street ||= v.street;
      district ||= v.district;
      city ||= v.city;
      state ||= v.state;
    }
  }

  // Endereço antigo em texto livre, sem campos separados.
  if (!street && !city && input.address) {
    const hit = await nominatim({ q: `${input.address}, Brasil` }, signal);
    return hit ? { lat: hit.lat, lng: hit.lng, quality: hit.houseNumber ? "endereco" : "rua" } : null;
  }
  if (!city) return null;

  const sameCity = (h: Hit | null) => !!h && (!h.city || norm(h.city) === norm(city));
  const where = [city, state].filter(Boolean).join(" - ");

  if (street) {
    // 1) Endereço exato (o número precisa existir no mapa)
    if (number) {
      const hit = await nominatim(
        { street: `${number} ${street}`, city, ...(state ? { state } : {}), country: "Brasil" },
        signal,
      );
      if (sameCity(hit) && hit!.houseNumber) return { lat: hit!.lat, lng: hit!.lng, quality: "endereco" };
    }
    // 2) A rua, no trecho do bairro do cliente
    const road = await nominatim({ q: [street, district, where, "Brasil"].filter(Boolean).join(", ") }, signal);
    if (sameCity(road)) {
      // O que voltou pode ser a rua, o bairro ou a cidade: a precisão diz qual foi.
      const t = road!.type;
      const quality: GeoQuality = road!.houseNumber
        ? "endereco"
        : t === "road"
          ? "rua"
          : ["suburb", "neighbourhood", "quarter", "city_district"].includes(t)
            ? "bairro"
            : "cidade";
      if (quality !== "cidade") return { lat: road!.lat, lng: road!.lng, quality };
    }
  }

  // 3) Centro do bairro
  if (district) {
    const hit = await nominatim({ q: [district, where, "Brasil"].join(", ") }, signal);
    if (sameCity(hit)) return { lat: hit!.lat, lng: hit!.lng, quality: "bairro" };
  }

  // 4) Centro da cidade
  const hit = await nominatim({ city, ...(state ? { state } : {}), country: "Brasil" }, signal);
  if (sameCity(hit)) return { lat: hit!.lat, lng: hit!.lng, quality: "cidade" };
  return null;
}

// Distância em km entre dois pontos (para "perto de mim").
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

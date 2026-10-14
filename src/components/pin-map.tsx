"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Map as LMap, LayerGroup, Marker } from "leaflet";
import { geocode, wait, distanceKm, GEO_LABEL, type GeoInput, type GeoQuality } from "@/lib/geocode";
import { whatsappUrl } from "@/lib/br";
import { Icon } from "./icons";
import { ghostBtn, primaryBtn } from "./ui";

// Um ponto no mapa (cliente, lead…). A cor e as linhas do balão vêm de quem usa o mapa.
export type PinPoint = {
  id: string;
  name: string;
  place: string;
  lat: number;
  lng: number;
  quality: string | null;
  phone: string | null;
  color: string;
  lines: { text: string; alert?: boolean }[];
  href: string;
  hrefLabel: string;
};
export type PinPending = GeoInput & { id: string; name: string };
export type PinLegend = { color: string; label: string }[];

type SaveFn = (id: string, lat: number, lng: number, quality: GeoQuality | "manual") => Promise<{ error?: string }>;

// Pin vazado = posição aproximada demais para confiar (centro do bairro/cidade, CEP antigo).
const isApprox = (q: string | null) => q === "bairro" || q === "cidade" || q === "cep";

function pinHtml(color: string, approx: boolean) {
  return `<svg width="28" height="36" viewBox="0 0 28 36" style="display:block;filter:drop-shadow(0 2px 2px rgb(0 0 0/.25))">
    <path d="M14 35s11-11.2 11-20A11 11 0 0 0 3 15c0 8.8 11 20 11 20z" fill="${approx ? "#fff" : color}" stroke="${color}" stroke-width="${approx ? 3 : 2}"/>
    <circle cx="14" cy="15" r="4.2" fill="${approx ? color : "#fff"}"/>
  </svg>`;
}

// Monta o balão com DOM (nunca innerHTML com dados digitados pelo usuário).
function popupNode(p: PinPoint, distance: number | undefined, onFix: () => void) {
  const el = document.createElement("div");
  el.style.minWidth = "200px";
  el.style.font = "13px/1.4 var(--font-sans, system-ui)";
  const h = document.createElement("p");
  h.style.cssText = "font-weight:600;margin:0 0 2px;color:#14212a";
  h.textContent = p.name;
  const sub = document.createElement("p");
  sub.style.cssText = "margin:0;color:#6a7780;font-size:12px";
  sub.textContent = [p.place, distance != null ? `${distance.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km de você` : ""]
    .filter(Boolean)
    .join(" · ");
  el.append(h, sub);
  for (const line of p.lines) {
    const l = document.createElement("p");
    l.style.cssText = `margin:4px 0 0;font-size:12px;color:${line.alert ? "#c8423a" : "#3a4750"};${line.alert ? "font-weight:600" : ""}`;
    l.textContent = line.text;
    el.append(l);
  }
  if (p.quality && GEO_LABEL[p.quality]) {
    const ap = document.createElement("p");
    const exact = p.quality === "endereco" || p.quality === "manual";
    ap.style.cssText = `margin:4px 0 0;font-size:11px;color:${exact ? "#23855a" : "#9a6412"}`;
    ap.textContent = GEO_LABEL[p.quality];
    el.append(ap);
  }
  const links = document.createElement("div");
  links.style.cssText = "display:flex;gap:10px;margin-top:8px;font-size:12px;font-weight:600";
  const a = (href: string, text: string, blank = false) => {
    const l = document.createElement("a");
    l.href = href;
    l.textContent = text;
    l.style.color = "var(--color-pen)";
    if (blank) {
      l.target = "_blank";
      l.rel = "noopener noreferrer";
    }
    return l;
  };
  links.append(a(p.href, p.hrefLabel));
  const wa = whatsappUrl(p.phone);
  if (wa) links.append(a(wa, "WhatsApp", true));
  links.append(a(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`, "Como chegar", true));
  el.append(links);
  const fix = document.createElement("button");
  fix.type = "button";
  fix.textContent = "Posição errada? Corrigir";
  fix.style.cssText = "margin-top:8px;padding:0;border:0;background:none;font-size:11px;color:#6a7780;text-decoration:underline;cursor:pointer";
  fix.onclick = onFix;
  el.append(fix);
  return el;
}

export function PinMap({
  points,
  pending,
  legend,
  noun,
  saveAction,
  notFoundAction,
  refreshAction,
}: {
  points: PinPoint[];
  pending: PinPending[];
  legend: PinLegend;
  noun: { one: string; many: string };
  saveAction: SaveFn;
  notFoundAction: (id: string) => Promise<void>;
  refreshAction: () => Promise<void>;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const meLayer = useRef<LayerGroup | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ done: number; found: number; running: boolean } | null>(null);
  const stop = useRef(false);
  const [fixing, setFixing] = useState<{ id: string; name: string } | null>(null);
  const markers = useRef(new Map<string, Marker>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || map.current) return;
      const m = L.map(box.current).setView([-14.2, -51.9], 4);
      // Mapa do OpenStreetMap (gratuito, com crédito obrigatório).
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      meLayer.current = L.layerGroup().addTo(m);
      map.current = m;
      draw();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, me]);

  async function draw() {
    const m = map.current;
    if (!m || !layer.current) return;
    const L = (await import("leaflet")).default;
    layer.current.clearLayers();
    markers.current.clear();
    for (const p of points) {
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ html: pinHtml(p.color, isApprox(p.quality)), className: "", iconSize: [28, 36], iconAnchor: [14, 35], popupAnchor: [0, -30] }),
        title: p.name,
        keyboard: true,
      });
      marker.bindPopup(() => popupNode(p, me ? distanceKm(me, p) : undefined, () => startFix(p, marker)));
      marker.addTo(layer.current);
      markers.current.set(p.id, marker);
    }
    if (!me && points.length) {
      m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 14 });
    }
  }

  // Corrigir posição: o pin vira arrastável; ao soltar, a posição é gravada como "ajustada à mão".
  function startFix(p: PinPoint, marker: Marker) {
    marker.closePopup();
    marker.dragging?.enable();
    setFixing({ id: p.id, name: p.name });
    map.current?.setView(marker.getLatLng(), Math.max(map.current.getZoom(), 16));
    marker.once("dragend", async () => {
      const { lat, lng } = marker.getLatLng();
      marker.dragging?.disable();
      const r = await saveAction(p.id, lat, lng, "manual");
      setFixing(null);
      setGeoMsg(r.error ? r.error : `Posição de ${p.name} corrigida.`);
      if (!r.error) {
        await refreshAction();
        router.refresh();
      }
    });
  }

  function cancelFix() {
    if (fixing) markers.current.get(fixing.id)?.dragging?.disable();
    setFixing(null);
    router.refresh();
  }

  function locateMe() {
    if (!navigator.geolocation) return setGeoMsg("Este aparelho não informa a localização.");
    setGeoMsg("Procurando sua localização…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(here);
        setGeoMsg(null);
        const L = (await import("leaflet")).default;
        meLayer.current?.clearLayers();
        L.circleMarker([here.lat, here.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#2b6f9e", fillOpacity: 1 }).addTo(meLayer.current!);
        L.circle([here.lat, here.lng], { radius: 5000, color: "#2b6f9e", weight: 1, fillOpacity: 0.05 }).addTo(meLayer.current!);
        map.current?.setView([here.lat, here.lng], 12);
      },
      () => setGeoMsg("Não foi possível pegar sua localização. Libere o acesso à localização no navegador."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // Localiza em sequência (1 por segundo, regra do OpenStreetMap) quem ainda não tem posição.
  async function runBatch() {
    stop.current = false;
    setBatch({ done: 0, found: 0, running: true });
    let found = 0;
    for (let i = 0; i < pending.length; i++) {
      if (stop.current) break;
      const c = pending[i];
      try {
        const r = await geocode(c);
        if (r) {
          const res = await saveAction(c.id, r.lat, r.lng, r.quality);
          if (res.error) {
            setGeoMsg(res.error);
            break;
          }
          found++;
        } else {
          await notFoundAction(c.id);
        }
      } catch {
        /* segue para o próximo */
      }
      setBatch({ done: i + 1, found, running: true });
      await wait(1100);
    }
    setBatch((b) => (b ? { ...b, running: false } : b));
    await refreshAction();
    router.refresh();
  }

  const nearest = me
    ? points
        .map((p) => ({ p, d: distanceKm(me, p) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 5)
    : [];

  return (
    <div className="grid gap-3">
      {pending.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-subtle px-4 py-3 text-sm">
          <Icon name="pin" size={18} className="text-muted" />
          <span className="min-w-0 flex-1 text-ink-2">
            {batch?.running
              ? `Localizando ${batch.done} de ${pending.length}… (${batch.found} encontrados)`
              : batch
                ? `Pronto: ${batch.found} de ${batch.done} localizados.`
                : `${pending.length} ${pending.length === 1 ? `${noun.one} ainda não está` : `${noun.many} ainda não estão`} no mapa.`}
            {batch?.running ? (
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-active">
                <span className="block h-full rounded-full bg-pen transition-all" style={{ width: `${(batch.done / pending.length) * 100}%` }} />
              </span>
            ) : null}
          </span>
          {batch?.running ? (
            <button type="button" onClick={() => (stop.current = true)} className={ghostBtn}>
              Parar
            </button>
          ) : !batch ? (
            <button type="button" onClick={runBatch} className={primaryBtn}>
              <Icon name="pin" size={15} />
              Localizar pelos endereços
            </button>
          ) : null}
        </div>
      ) : null}

      {fixing ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-pen/30 bg-pen-soft px-4 py-3 text-sm text-pen-ink">
          <Icon name="pin" size={18} />
          <span className="min-w-0 flex-1">
            Arraste o pin de <span className="font-semibold">{fixing.name}</span> até o lugar certo e solte. A posição fica gravada.
          </span>
          <button type="button" onClick={cancelFix} className={ghostBtn}>
            Cancelar
          </button>
        </div>
      ) : null}

      <div className="relative z-0 overflow-hidden rounded-xl border border-line">
        <div
          ref={box}
          className="h-[62vh] min-h-[360px] w-full bg-subtle [&_.leaflet-tile-pane]:[filter:saturate(0.55)_brightness(1.03)]"
          role="region"
          aria-label="Mapa"
        />
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-col gap-1 rounded-lg bg-white/95 px-3 py-2 text-[11px] text-ink-2 shadow-menu">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-faint bg-white" />
            Posição aproximada
          </span>
        </div>
        <button
          type="button"
          onClick={locateMe}
          className="absolute right-3 top-3 z-[500] inline-flex h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-medium text-ink shadow-menu transition hover:bg-subtle sm:h-9"
        >
          <Icon name="target" size={16} className="text-info" />
          Perto de mim
        </button>
      </div>

      {geoMsg ? <p className="text-[13px] text-muted">{geoMsg}</p> : null}

      {nearest.length ? (
        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Mais perto de você</h2>
          <ul className="divide-y divide-line">
            {nearest.map(({ p, d }) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                <a href={p.href} className="min-w-0 flex-1 truncate text-[13px] font-medium hover:text-pen">
                  {p.name}
                  <span className="block text-[11px] font-normal text-muted">{p.place}</span>
                </a>
                <span className="shrink-0 text-xs tabular-nums text-muted">{d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km</span>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-pen hover:underline"
                >
                  Rota
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

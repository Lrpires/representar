"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { Badge, accentBtn, ghostBtn, quietBtn } from "@/components/ui";
import type { ImportKind, PreviewResult, PreviewRow } from "@/lib/import-schema";
import { previewImport, runImport } from "./actions";

type Props = {
  kind: ImportKind;
  step: number;
  title: string;
  one: string;
  many: string;
  description: string;
  match: string;
  existing: number;
  listHref: string;
};

const STATUS: Record<PreviewRow["status"], { label: string; tone: "ok" | "info" | "alert" }> = {
  novo: { label: "Novo", tone: "ok" },
  atualizar: { label: "Atualiza", tone: "info" },
  erro: { label: "Com erro", tone: "alert" },
};

// Um passo da importação: baixar o modelo, enviar a planilha, conferir a prévia e importar.
export function ImportPanel({ kind, step, title, one, many, description, match, existing, listHref }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [filter, setFilter] = useState<"todas" | "erro">("todas");
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"preview" | "import" | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const send = (fn: typeof previewImport, which: "preview" | "import", f: File | null = file) => {
    if (!f) return;
    setAction(which);
    start(async () => {
      const fd = new FormData();
      fd.set("file", f);
      setResult(await fn(kind, null, fd));
      setAction(null);
    });
  };

  const choose = (f: File | undefined) => {
    setResult(null);
    setFilter("todas");
    setFile(f ?? null);
    if (f) send(previewImport, "preview", f); // já mostra a prévia ao escolher o arquivo
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    if (input.current) input.current.value = "";
  };

  const ok = result?.ok ? result : null;
  const done = ok?.imported;
  const rows = useMemo(() => {
    if (!ok) return [];
    const list = filter === "erro" ? ok.rows.filter((r) => r.status === "erro") : ok.rows;
    // Erros primeiro: é o que a pessoa precisa corrigir.
    return [...list].sort((a, b) => (a.status === "erro" ? 0 : 1) - (b.status === "erro" ? 0 : 1) || a.line - b.line);
  }, [ok, filter]);
  const toImport = ok ? ok.counts.novo + ok.counts.atualizar : 0;

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-sm font-semibold text-on-ink">{step}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>
          <p className="mt-1 text-xs text-faint">
            {existing ? `${existing} ${existing === 1 ? one : many} no sistema hoje. ` : `Nenhum${one.endsWith("a") ? "a" : ""} ${one} cadastrad${one.endsWith("a") ? "a" : "o"} ainda. `}
            {match}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <a href={`/importar/modelo/${kind}`} download className={`${ghostBtn} flex-1 sm:flex-none`}>
            <Icon name="download" size={15} />
            Baixar modelo
          </a>
          <label className={`${accentBtn} flex-1 cursor-pointer sm:flex-none`}>
            <Icon name="upload" size={15} />
            {file ? "Trocar planilha" : "Enviar planilha"}
            <input ref={input} type="file" accept=".xlsx" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
          </label>
        </div>
      </header>

      {pending ? (
        <p className="flex items-center gap-2 border-t border-line bg-subtle px-5 py-3 text-[13px] text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
          {action === "import" ? `Importando ${many}…` : "Lendo a planilha…"}
        </p>
      ) : null}

      {result && !result.ok && !pending ? (
        <div className="flex items-start gap-2 border-t border-line bg-alert-soft px-5 py-3 text-[13px] text-alert">
          <Icon name="alert" size={16} className="mt-px shrink-0" />
          <span className="flex-1">{result.error}</span>
          <button type="button" onClick={reset} className="text-xs font-medium underline">
            Fechar
          </button>
        </div>
      ) : null}

      {ok && !pending ? (
        <div className="border-t border-line">
          {/* Resumo */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-subtle px-5 py-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-1.5 font-medium">
              <Icon name="file" size={15} className="text-muted" />
              <span className="truncate">{ok.fileName}</span>
            </span>
            {done ? (
              <span className="text-ok">
                Importado: {done.created} {done.created === 1 ? "novo" : "novos"}, {done.updated} {done.updated === 1 ? "atualizado" : "atualizados"}
                {done.failed ? <span className="text-alert"> · {done.failed} com falha</span> : null}
              </span>
            ) : (
              <span className="flex flex-wrap gap-1.5">
                <Badge tone="ok" dot>{ok.counts.novo} novos</Badge>
                <Badge tone="info" dot>{ok.counts.atualizar} atualizam</Badge>
                {ok.counts.erro ? <Badge tone="alert" dot>{ok.counts.erro} com erro</Badge> : null}
              </span>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {done ? (
                <>
                  <Link href={listHref} className={ghostBtn}>
                    Ver {many}
                  </Link>
                  <button type="button" onClick={reset} className={quietBtn}>
                    Importar outra
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={reset} className={quietBtn}>
                    Cancelar
                  </button>
                  <button type="button" disabled={!toImport} onClick={() => send(runImport, "import")} className={accentBtn}>
                    <Icon name="check" size={15} strokeWidth={2.2} />
                    Importar {toImport} {toImport === 1 ? one : many}
                  </button>
                </>
              )}
            </span>
          </div>
          {ok.counts.erro && !done ? (
            <p className="border-t border-line px-5 py-2 text-xs text-muted">
              As linhas com erro ficam de fora. Corrija na planilha e envie de novo; o que já foi importado é atualizado, não duplicado.
            </p>
          ) : null}
          {ok.ignoredColumns.length ? (
            <p className="border-t border-line px-5 py-2 text-xs text-muted">
              Colunas ignoradas (não fazem parte do modelo): {ok.ignoredColumns.join(", ")}.
            </p>
          ) : null}

          {/* Linhas */}
          {ok.counts.erro ? (
            <div className="flex gap-1 border-t border-line px-5 pt-3">
              {(["todas", "erro"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${filter === f ? "bg-active text-ink" : "text-muted hover:text-ink"}`}
                >
                  {f === "todas" ? `Todas (${ok.rows.length})` : `Só com erro (${ok.counts.erro})`}
                </button>
              ))}
            </div>
          ) : null}
          <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto">
            {rows.slice(0, 500).map((r) => (
              <li key={r.line} className="flex items-start gap-3 px-5 py-2.5 text-[13px]">
                <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-faint">L{r.line}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.label}</span>
                  {r.detail ? <span className="block truncate text-xs text-muted">{r.detail}</span> : null}
                  {r.errors.length ? <span className="mt-0.5 block text-xs text-alert">{r.errors.join(" · ")}</span> : null}
                </span>
                <Badge tone={STATUS[r.status].tone}>{done && r.status !== "erro" ? "Importado" : STATUS[r.status].label}</Badge>
              </li>
            ))}
          </ul>
          {rows.length > 500 ? <p className="border-t border-line px-5 py-2 text-xs text-muted">Mostrando 500 de {rows.length} linhas.</p> : null}
        </div>
      ) : null}
    </section>
  );
}

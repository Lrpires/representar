import Link from "next/link";
import { metricInfo, STATUS_INFO, type GoalRow, type Progress } from "@/lib/goals";
import { brl, formatDate } from "@/lib/format";
import { numText } from "@/lib/orders";
import { Icon } from "@/components/icons";
import { Avatar, Badge, iconBtn } from "@/components/ui";

const fmt = (money: boolean, n: number) => (money ? brl(n) : numText(Math.round(n), 0));

// Período legível: "Outubro de 2026", "Out–Dez 2026", "2026" ou "01/10 a 15/10/2026".
export function periodLabel(start: string, end: string) {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const isLast = end === new Date(Date.UTC(ey, em, 0)).toISOString().slice(0, 10);
  if (sd === 1 && isLast) {
    if (sy === ey && sm === em) {
      const full = new Date(Date.UTC(sy, sm - 1, 1)).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
      return `${full.charAt(0).toUpperCase()}${full.slice(1)} de ${sy}`;
    }
    if (sm === 1 && em === 12 && sy === ey) return `Ano de ${sy}`;
    const a = months[sm - 1], b = months[em - 1];
    return `${a.charAt(0).toUpperCase()}${a.slice(1)}–${b} ${sy === ey ? sy : `${sy}/${ey}`}`;
  }
  return `${formatDate(start).slice(0, 5)} a ${formatDate(end)}`;
}

export function GoalCard({
  goal,
  progress: p,
  title,
  subtitle,
  avatar,
  editHref,
  compact,
}: {
  goal: GoalRow;
  progress: Progress;
  title: string;
  subtitle?: string;
  avatar?: { name: string; src: string | null; round?: boolean };
  editHref?: string;
  compact?: boolean;
}) {
  const m = metricInfo(goal.metric);
  const st = STATUS_INFO[p.status];
  const pct = Math.round(p.share * 100);
  const bar =
    p.status === "atingida" ? "bg-ok" : p.status === "abaixo" || p.status === "encerrada" ? "bg-warn-dot" : "bg-pen";

  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface p-4 sm:p-5">
      <header className="flex items-start gap-3">
        {avatar ? <Avatar name={avatar.name} size={36} round={avatar.round} src={avatar.src} /> : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          <p className="truncate text-xs text-muted">
            {m.label} · {subtitle ?? periodLabel(goal.period_start, goal.period_end)}
          </p>
        </div>
        <Badge tone={st.tone} dot>
          {st.label}
        </Badge>
        {editHref ? (
          <Link href={editHref} scroll={false} className={`${iconBtn} -mr-2 -mt-1.5`} aria-label="Editar meta">
            <Icon name="edit" size={15} />
          </Link>
        ) : null}
      </header>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="min-w-0">
          <span className="block truncate text-2xl font-semibold tabular-nums tracking-[-0.02em]">{fmt(m.money, p.done)}</span>
          <span className="block text-xs text-muted">de {fmt(m.money, Number(goal.target))}</span>
        </p>
        <span className={`text-xl font-semibold tabular-nums ${p.status === "atingida" ? "text-ok" : "text-ink-2"}`}>{pct}%</span>
      </div>

      {/* Barra com a marca de onde deveria estar hoje */}
      <div className="relative mt-3">
        <span className="block h-2 overflow-hidden rounded-full bg-active">
          <span className={`block h-full rounded-full transition-all ${bar}`} style={{ width: `${Math.min(p.share, 1) * 100}%` }} />
        </span>
        {p.status !== "futura" && p.status !== "encerrada" && p.expectedShare > 0 && p.expectedShare < 1 ? (
          <span
            className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink/60"
            style={{ left: `calc(${p.expectedShare * 100}% - 1px)` }}
            title={`Hoje deveria estar em ${Math.round(p.expectedShare * 100)}%`}
          />
        ) : null}
      </div>

      {!compact ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs">
          <div>
            <dt className="text-muted">{p.status === "atingida" ? "Passou da meta em" : "Falta"}</dt>
            <dd className="mt-0.5 text-[13px] font-medium tabular-nums">
              {p.status === "atingida" ? fmt(m.money, p.done - Number(goal.target)) : fmt(m.money, p.remaining)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{p.perDay != null ? "Por dia útil" : p.projection != null ? "No ritmo atual" : "Período"}</dt>
            <dd className="mt-0.5 text-[13px] font-medium tabular-nums">
              {p.perDay != null
                ? fmt(m.money, p.perDay)
                : p.projection != null
                  ? fmt(m.money, p.projection)
                  : periodLabel(goal.period_start, goal.period_end)}
            </dd>
          </div>
          {p.projection != null && p.perDay != null ? (
            <div className="col-span-2 text-muted">
              No ritmo atual, termina em{" "}
              <span className={`font-medium tabular-nums ${p.projection >= Number(goal.target) ? "text-ok" : "text-warn"}`}>
                {fmt(m.money, p.projection)}
              </span>
            </div>
          ) : null}
          {goal.notes ? <p className="col-span-2 text-muted">{goal.notes}</p> : null}
        </dl>
      ) : null}
    </article>
  );
}

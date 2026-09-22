import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Feedback';

type SearchResult = {
  query: string;
  matches: { id: string; title: string; status: string; homeName: string; awayName: string }[];
  teams: { id: string; name: string; shortName?: string | null }[];
  players: { id: string; name: string; role?: string | null; profileCode?: string | null; jerseyNo?: number | null }[];
  tournaments: { id: string; name: string }[];
  clubs?: { id: string; name: string; city?: string | null }[];
};

export function SearchPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [dq, setDq] = useState((params.get('q') ?? '').trim());

  useEffect(() => {
    const next = params.get('q') ?? '';
    setQ(next);
    setDq(next.trim());
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDq(q.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [q]);

  const result = useQuery({
    queryKey: keys.search(dq),
    queryFn: () => api<SearchResult>(`/api/v1/search?q=${encodeURIComponent(dq)}`),
    enabled: dq.length >= 2,
  });

  const data = result.data;
  const empty =
    data &&
    !data.matches.length &&
    !data.teams.length &&
    !data.players.length &&
    !data.tournaments.length &&
    !(data.clubs ?? []).length;

  return (
    <div className="px-[var(--gutter)] py-4">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} underline autoFocus />
      {dq.length > 0 && dq.length < 2 ? <p className="mt-4 text-sm text-text-secondary">{t('search.minChars')}</p> : null}
      {result.isFetching ? <Spinner /> : null}
      {empty ? <p className="mt-8 text-center text-sm text-text-secondary">{t('search.empty')}</p> : null}
      {data ? (
        <div className="mt-4 space-y-6">
          <SearchGroup title={t('search.matches')} items={data.matches} to={(row) => `/matches/${row.id}/centre`} label={(row) => `${row.homeName} vs ${row.awayName}`} />
          <SearchGroup title={t('search.teams')} items={data.teams} to={(row) => `/teams/${row.id}`} label={(row) => row.name} />
          <SearchGroup title={t('search.clubs')} items={data.clubs ?? []} to={(row) => `/clubs/${row.id}`} label={(row) => row.name} hint={(row) => row.city ?? ''} />
          <SearchGroup
            title={t('search.players')}
            items={data.players}
            to={(row) => `/players/${row.id}`}
            label={(row) => row.name}
            hint={(row) => [row.role, row.jerseyNo != null ? `#${row.jerseyNo}` : null, row.profileCode].filter(Boolean).join(' · ')}
          />
          <SearchGroup title={t('search.tournaments')} items={data.tournaments} to={(row) => `/tournaments/${row.id}`} label={(row) => row.name} />
        </div>
      ) : null}
    </div>
  );
}

function SearchGroup<T extends { id: string }>({
  title,
  items,
  to,
  label,
  hint,
}: {
  title: string;
  items: T[];
  to: (row: T) => string;
  label: (row: T) => string;
  hint?: (row: T) => string;
}) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="section-title mb-1 text-xs font-bold uppercase tracking-wide text-text-secondary">{title}</h2>
      <ul className="divide-y divide-border">
        {items.map((row) => (
          <li key={row.id}>
            <Link to={to(row)} className="flex min-h-touch items-center gap-3 py-2">
              <Avatar name={label(row)} size={40} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{label(row)}</span>
                {hint && hint(row) ? <span className="block truncate text-xs text-text-secondary">{hint(row)}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

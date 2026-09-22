import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { fetchPublicConfig } from '@/lib/config';
import { useAuth } from '@/context/AuthContext';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export function BetaFeedbackSheet() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const cfg = useQuery({ queryKey: keys.publicConfig, queryFn: fetchPublicConfig, staleTime: 60_000 });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screen, setScreen] = useState(typeof window !== 'undefined' ? window.location.pathname : '');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('MEDIUM');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const submit = useMutation({
    mutationFn: () =>
      api('/api/v1/beta/feedback', {
        method: 'POST',
        body: { title, description, screen, severity },
      }),
    onSuccess: () => {
      setSaved(true);
      setTitle('');
      setDescription('');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('common.error')),
  });

  if (!isAuthenticated || !cfg.data?.features.BETA_FEEDBACK) return null;

  return (
    <>
      <button
        type="button"
        className="min-h-touch text-xs font-semibold uppercase tracking-wide text-primary"
        onClick={() => {
          setOpen(true);
          setSaved(false);
          setError(null);
          setScreen(window.location.pathname);
        }}
      >
        {t('beta.reportIssue')}
      </button>
      <BottomSheet open={open} title={t('beta.reportIssue')} onClose={() => setOpen(false)} orange={false}>
        {saved ? (
          <p className="text-sm text-primary">{t('beta.feedbackSent')}</p>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              submit.mutate();
            }}
          >
            <Input label={t('beta.issueTitle')} value={title} onChange={(e) => setTitle(e.target.value)} underline />
            <label className="text-sm font-semibold">
              {t('beta.description')}
              <textarea
                className="mt-1 min-h-24 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-normal"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <Input label={t('beta.screen')} value={screen} onChange={(e) => setScreen(e.target.value)} underline />
            <label className="text-sm font-semibold">
              {t('beta.severity')}
              <select
                className="mt-1 min-h-touch w-full rounded-lg border border-border bg-bg px-3 font-normal"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as (typeof SEVERITIES)[number])}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {t(`beta.severityLevel.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" variant="primaryDark" disabled={submit.isPending}>
              {t('beta.submitIssue')}
            </Button>
          </form>
        )}
      </BottomSheet>
    </>
  );
}

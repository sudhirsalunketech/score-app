import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import type { User } from '@/types/api';

export function ScorerSelector({
  open,
  onClose,
  selectedIds,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  onPick: (users: User[]) => void;
}) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: keys.scorers,
    queryFn: () => api<User[]>('/api/v1/users/scorers'),
    enabled: open,
  });
  const [picked, setPicked] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (open) setPicked(selectedIds);
  }, [open, selectedIds]);

  const users = q.data ?? [];

  const toggle = (userId: string) => {
    setPicked((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const confirm = () => {
    onPick(users.filter((u) => picked.includes(u.id)));
    onClose();
  };

  return (
    <BottomSheet open={open} title={t('match.selectScorer')} onClose={onClose} orange={false}>
      {q.isLoading ? <Spinner /> : null}
      <button
        type="button"
        className="mb-2 min-h-touch w-full text-start text-sm text-text-secondary"
        onClick={() => setPicked([])}
      >
        {t('match.noScorer')}
      </button>
      <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto">
        {users.map((user) => {
          const checked = picked.includes(user.id);
          return (
            <li key={user.id}>
              <label className="flex min-h-touch w-full cursor-pointer items-center gap-3 py-2 text-start">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(user.id)}
                  className="h-4 w-4 accent-primary"
                />
                <Avatar name={user.name} src={user.avatarUrl} kind="person" size={40} />
                <span className={checked ? 'font-bold text-primary' : 'font-semibold'}>{user.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button type="button" className="mt-4 w-full" onClick={confirm}>
        {t('common.done')}
      </Button>
    </BottomSheet>
  );
}

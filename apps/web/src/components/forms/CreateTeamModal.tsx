import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PhotoField } from '@/components/ui/PhotoField';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import type { Club } from '@/types/api';

const schema = z.object({
  name: z.string().trim().min(2, 'Team name must contain at least 2 characters.').max(80, 'Team name is too long.'),
  shortName: z.string().trim().max(8).optional(),
  location: z.string().trim().max(80).optional(),
  homeGround: z.string().trim().max(120).optional(),
  clubId: z.string().optional(),
  logoUrl: z.string().optional(),
});

export type CreateTeamValues = z.infer<typeof schema>;

export function CreateTeamModal({
  open,
  onClose,
  onCreate,
  busy,
  defaultClubId,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (values: CreateTeamValues) => Promise<void> | void;
  busy?: boolean;
  defaultClubId?: string;
}) {
  const { t } = useTranslation();
  const clubs = useQuery({ queryKey: keys.clubs, queryFn: () => api<Club[]>('/api/v1/clubs'), enabled: open });
  const form = useForm<CreateTeamValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    values: { name: '', shortName: '', location: '', homeGround: '', clubId: defaultClubId ?? '', logoUrl: '' },
  });

  return (
    <Modal open={open} title={t('teams.createTitle')} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(async (v) => {
          await onCreate({
            name: v.name,
            shortName: v.shortName || undefined,
            location: v.location || undefined,
            homeGround: v.homeGround || undefined,
            clubId: v.clubId || undefined,
            logoUrl: v.logoUrl || undefined,
          });
          form.reset();
        })}
      >
        <PhotoField
          kind="team"
          name={form.watch('name') || t('teams.createTitle')}
          value={form.watch('logoUrl')}
          onUploaded={(url) => form.setValue('logoUrl', url)}
        />
        <Input requiredMark label={t('teams.teamName')} info={t('info.team.name')} underline {...form.register('name')} error={form.formState.errors.name?.message} />
        <Input label={t('teams.shortName')} info={t('info.team.shortName')} underline {...form.register('shortName')} />
        <Input label={t('common.location')} info={t('info.team.location')} underline {...form.register('location')} />
        <Input label={t('teams.homeGround')} info={t('info.team.homeGround')} underline {...form.register('homeGround')} />
        <Select label={t('tournaments.club')} info={t('info.team.club')} {...form.register('clubId')}>
          <option value="">{t('tournaments.clubOptional')}</option>
          {(clubs.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.city ? `${c.name} · ${c.city}` : c.name}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primaryDark" className="flex-1" disabled={busy}>
            {busy ? t('common.loading') : t('teams.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

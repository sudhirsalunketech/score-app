import { useTranslation } from 'react-i18next';
import { dash, FORMAT_COLS, type SliceView } from '@/lib/player-profile';

type Kind = 'bat' | 'bowl' | 'field';

const BAT_ROWS: Array<{ key: keyof SliceView; label: string }> = [
  { key: 'matches', label: 'profile.matches' },
  { key: 'innings', label: 'profile.innings' },
  { key: 'runs', label: 'profile.runs' },
  { key: 'balls', label: 'profile.ballsFaced' },
  { key: 'highest', label: 'profile.highScore' },
  { key: 'average', label: 'profile.average' },
  { key: 'sr', label: 'profile.strikeRate' },
  { key: 'notOuts', label: 'profile.notOuts' },
  { key: 'ducks', label: 'profile.ducks' },
  { key: 'hundreds', label: 'profile.hundreds' },
  { key: 'fifties', label: 'profile.fifties' },
  { key: 'thirties', label: 'profile.thirties' },
  { key: 'sixes', label: 'profile.sixes' },
  { key: 'fours', label: 'profile.fours' },
];

const BOWL_ROWS: Array<{ key: keyof SliceView; label: string }> = [
  { key: 'matches', label: 'profile.matches' },
  { key: 'bowlInnings', label: 'profile.innings' },
  { key: 'bowlBalls', label: 'profile.ballsFaced' },
  { key: 'bowlRuns', label: 'profile.runs' },
  { key: 'dots', label: 'profile.dots' },
  { key: 'maidens', label: 'profile.maidens' },
  { key: 'wickets', label: 'profile.wickets' },
  { key: 'bowlAverage', label: 'profile.average' },
  { key: 'economy', label: 'profile.economy' },
  { key: 'best', label: 'profile.bestBowling' },
  { key: 'bowlSr', label: 'profile.strikeRate' },
  { key: 'threeW', label: 'profile.threeW' },
  { key: 'fiveW', label: 'profile.fiveW' },
];

const FIELD_ROWS: Array<{ key: keyof SliceView; label: string }> = [
  { key: 'catches', label: 'profile.catches' },
  { key: 'stumpings', label: 'profile.stumpings' },
  { key: 'runOuts', label: 'profile.runouts' },
];

export function FormatStatsTable({
  byFormat,
  kind,
}: {
  byFormat: Record<string, SliceView>;
  kind: Kind;
}) {
  const { t } = useTranslation();
  const rows = kind === 'bat' ? BAT_ROWS : kind === 'bowl' ? BOWL_ROWS : FIELD_ROWS;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[20rem] text-sm">
        <thead>
          <tr>
            <th className="w-24 py-2 text-start" />
            {FORMAT_COLS.map((col) => (
              <th key={col} className="py-2 text-center font-bold text-primary">
                {col === 'CLUB' ? t('profile.club') : col === 'TEST' ? t('profile.test') : col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <th className="py-2.5 text-start font-bold">{t(row.label)}</th>
              {FORMAT_COLS.map((col) => (
                <td key={col} className="py-2.5 text-center">
                  {dash(byFormat[col]?.[row.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

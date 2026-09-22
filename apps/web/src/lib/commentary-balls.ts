import type { BallEvent, PublicBallDto } from '@/types/api';

export function eventsToCommentaryBalls(
  events: Array<Pick<
    BallEvent,
    | 'sequence'
    | 'overNumber'
    | 'ballInOver'
    | 'batsmanRuns'
    | 'extraRuns'
    | 'extraType'
    | 'isWicket'
    | 'commentary'
    | 'bowlerId'
    | 'strikerId'
    | 'dismissalType'
  >>,
  nameOf: (id: string) => string,
): PublicBallDto[] {
  return events.map((ev) => ({
    sequence: ev.sequence,
    overNumber: ev.overNumber,
    ballInOver: ev.ballInOver,
    label: '',
    flash: '',
    commentary: ev.commentary ?? null,
    isWicket: ev.isWicket,
    extraType: ev.extraType,
    batsmanRuns: ev.batsmanRuns,
    extraRuns: ev.extraRuns,
    bowlerName: nameOf(ev.bowlerId),
    strikerName: nameOf(ev.strikerId),
    dismissalType: ev.dismissalType,
  }));
}

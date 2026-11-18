/**
 * One status vocabulary for the whole field-operations system.
 * Every screen (map, roster, drawer, feed) MUST resolve to this — nothing else.
 *
 * Precedence (highest wins):
 *   1. needs_help      — SOS, overrides everything
 *   2. no_update       — telemetry stale > 5 minutes
 *   3. left_early      — departed while a monitored paper is in session
 *   4. finished        — shift concluded (tapped done / paper window ended)
 *   5. on_duty         — checked in / confirmed on station
 *   6. arrived         — detected at the centre, awaiting the confirm tap
 *   7. on_the_way      — signed in today, not yet at any centre
 *   8. off_duty        — not signed in / no live telemetry
 */
export type FieldStatus =
  | 'needs_help'
  | 'no_update'
  | 'left_early'
  | 'finished'
  | 'on_duty'
  | 'arrived'
  | 'on_the_way'
  | 'off_duty';

export interface StatusInput {
  sos?: boolean;
  signedIn?: boolean;
  telemetryFresh?: boolean; // last ping within 5 minutes
  arrived?: boolean; // auto-detected in radius, not yet confirmed
  confirmed?: boolean; // officer tapped "I'm here" (or check-in)
  departed?: boolean; // left the radius / check-out
  departureDuringPaper?: boolean; // left while a monitored paper is in session
  shiftEnded?: boolean; // paper window ended (or officer tapped "I'm done")
}

export function resolveFieldStatus(input: StatusInput): FieldStatus {
  if (input.sos) return 'needs_help';
  if (!input.signedIn && !input.telemetryFresh) return 'off_duty';
  if (input.telemetryFresh === false) return 'no_update';
  if (input.departed && input.departureDuringPaper) return 'left_early';
  if (input.shiftEnded || (input.departed && !input.departureDuringPaper)) return 'finished';
  if (input.confirmed) return 'on_duty';
  if (input.arrived) return 'arrived';
  return 'on_the_way';
}

export const FIELD_STATUS_META: Record<
  FieldStatus,
  { label: string; short: string; tone: 'sos' | 'warn' | 'bad' | 'ok' | 'info' | 'muted' }
> = {
  needs_help: { label: 'Needs help', short: 'SOS', tone: 'sos' },
  no_update: { label: 'No update', short: 'Stale', tone: 'warn' },
  left_early: { label: 'Left early', short: 'Early', tone: 'bad' },
  finished: { label: 'Finished', short: 'Done', tone: 'ok' },
  on_duty: { label: 'On duty', short: 'On duty', tone: 'ok' },
  arrived: { label: 'Arrived — unconfirmed', short: 'Arrived', tone: 'info' },
  on_the_way: { label: 'On the way', short: 'En route', tone: 'muted' },
  off_duty: { label: 'Off duty', short: 'Off duty', tone: 'muted' },
};

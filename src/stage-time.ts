import type { Session } from './domain';
/** Measure time spent in each stage, including pauses and background time. */
export function recordStageTime(session: Session, now: number): Session {
  if (session.phase !== 'training') return session;
  const elapsed = session.stageElapsed ? [...session.stageElapsed] : Array<number | null>(7).fill(null);
  const delta = session.stageClockAt === undefined ? 0 : Math.max(0, now - session.stageClockAt) / 1000;
  elapsed[session.step] = (elapsed[session.step] ?? 0) + delta;
  return { ...session, stageElapsed: elapsed, stageClockAt: now };
}

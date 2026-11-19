import { assessmentLabel, steps, type Answers, type Session } from './domain';
export type SheetRecord = { sessionId: string; updatedAt: string; status: string; row: (string | number | null)[]; stages: (string | number | null)[][] };
export function sessionSheetRecord(session: Session, now = new Date()): SheetRecord {
  const startedAt = session.elapsedStartedAt ? new Date(session.elapsedStartedAt).toISOString() : session.completedAt ?? now.toISOString();
  const updatedAt = now.toISOString();
  const status = session.phase === 'result' ? '완료' : session.phase === 'assessment' ? '자기평가' : '진행 중';
  const label = (key: keyof Answers) => session.answers[key] === undefined ? '' : assessmentLabel(session, key);
  const minutes = (seconds: number) => Math.round(seconds / 60 * 100) / 100;
  return {
    sessionId: session.id, updatedAt, status,
    row: [startedAt, session.url, session.start, session.end, session.end - session.start, session.step + 1, status,
      minutes(session.elapsed), session.counts.reduce((sum,n) => sum + n, 0), label('difficulty'), session.recommendation?.level ?? '',
      label('comprehension'), label('before'), label('after'), label('remaining'), session.completedAt ?? '', session.id, updatedAt],
    stages: (session.stageElapsed ?? []).flatMap((seconds, index) => seconds === null || (seconds === 0 && index > session.step) ? [] : [
      [startedAt, session.url, session.start, session.end, index + 1, steps[index], minutes(seconds), index >= 2 && index <= 4 ? session.counts[index - 2] : '', session.id, `${session.id}:${index + 1}`, updatedAt],
    ]),
  };
}
export type SheetConnection = { endpoint: string; token: string; sheetUrl: string };
export function validSheetConnection(value: SheetConnection) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(value.endpoint)
    && /^[\w-]{24,}$/.test(value.token)
    && /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+(?:\/edit)?(?:[?#].*)?$/.test(value.sheetUrl);
}

import type { SheetConnection, SheetRecord } from './sheet-record';
/** Simple form POST keeps the connection key out of URLs and requires a receipt. */
export function sendSheetRecord(connection: SheetConnection, record?: SheetRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const frame = document.createElement('iframe');
    frame.name = `sheet_${requestId}`; frame.hidden = true; frame.referrerPolicy = 'no-referrer';
    const form = document.createElement('form');
    form.method = 'POST'; form.action = connection.endpoint; form.target = frame.name; form.hidden = true;
    for (const [name, value] of Object.entries({ token: connection.token, requestId, origin: location.origin, action: record ? 'upsert' : 'ping', payload: record ? JSON.stringify(record) : '{}' })) {
      const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.append(input);
    }
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); form.remove(); frame.remove(); };
    const receive = (event: MessageEvent) => {
      if (!/^https:\/\/(?:[\w-]+-)?script\.googleusercontent\.com$/.test(event.origin)) return;
      const result = event.data;
      if (result?.type !== 'listening-lab-sheet-result' || result.requestId !== requestId) return;
      cleanup(); result.ok ? resolve() : reject(new Error(result.reason || '시트 저장에 실패했어요.'));
    };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('시트의 저장 확인을 받지 못했어요. 기록은 전송 대기 중입니다.')); }, 30_000);
    window.addEventListener('message', receive);
    document.body.append(frame, form); form.submit();
  });
}

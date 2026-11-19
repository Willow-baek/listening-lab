import { useEffect, useRef, useState } from 'react';
import type { Session } from './domain';
import { readStorage } from './domain';
import { sessionSheetRecord, validSheetConnection, type SheetConnection, type SheetRecord } from './sheet-record';
import { sendSheetRecord } from './sheet-bridge';
const CONFIG = 'listening-lab.sheets.connection.v1';
const QUEUE = 'listening-lab.sheets.queue.v1';
export function SheetsConnection({ session, history }: {session: Session | null; history: Session[]}) {
  const [connection,setConnection] = useState<SheetConnection | null>(() => readStorage(CONFIG,null));
  const [endpoint,setEndpoint] = useState(connection?.endpoint ?? '');
  const [token,setToken] = useState(connection?.token ?? '');
  const [sheetUrl,setSheetUrl] = useState(connection?.sheetUrl ?? '');
  const [status,setStatus] = useState('');
  const [busy,setBusy] = useState(false);
  const [pending,setPending] = useState(0);
  const latest = useRef({session,history}); latest.current = {session,history};
  const active = useRef(false);
  const generation = useRef(0);
  const enqueue = () => {
    const queue = readStorage<Record<string,SheetRecord>>(QUEUE,{});
    for (const record of [...latest.current.history, ...(latest.current.session ? [latest.current.session] : [])]) queue[record.id] = sessionSheetRecord(record);
    localStorage.setItem(QUEUE,JSON.stringify(queue));
    setPending(Object.keys(queue).length);
  };
  const flush = async (target = connection) => {
    if (!target || !validSheetConnection(target) || active.current) return;
    const run = generation.current;
    active.current = true; setBusy(true); setStatus('동기화 중…');
    try {
      for (let count = 0; count < 100; count++) {
        const record = Object.values(readStorage<Record<string,SheetRecord>>(QUEUE,{}))[0];
        if (!record) break;
        if (generation.current !== run) break;
        await sendSheetRecord(target,record);
        const queue = readStorage<Record<string,SheetRecord>>(QUEUE,{});
        if (queue[record.sessionId]?.updatedAt === record.updatedAt) delete queue[record.sessionId];
        localStorage.setItem(QUEUE,JSON.stringify(queue)); setPending(Object.keys(queue).length);
      }
      if (generation.current === run) setStatus('동기화 완료');
    } catch (error) { setStatus((error as Error).message); }
    finally { active.current = false; setBusy(false); }
  };
  const synchronize = async (target = connection) => {
    try { enqueue(); await flush(target); } catch { setStatus('전송 대기 기록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'); }
  };
  useEffect(() => {
    if (connection && validSheetConnection(connection)) void synchronize();
  }, [connection,session?.id,session?.phase,session?.step,history]);
  useEffect(() => {
    const resume = () => { if (connection) void synchronize(); };
    window.addEventListener('online',resume);
    return () => window.removeEventListener('online',resume);
  }, [connection]);
  return <details className="sheets-connection">
    <summary>Google Sheets {connection ? '연결됨' : '연결'}</summary>
    <form onSubmit={async e => {
      e.preventDefault(); const next = {endpoint:endpoint.trim(),token:token.trim(),sheetUrl:sheetUrl.trim()};
      if (!validSheetConnection(next)) { setStatus('웹 앱 주소, 연결 키와 시트 주소를 확인해 주세요.'); return; }
      setBusy(true); setStatus('연결 확인 중…');
      try { await sendSheetRecord(next); localStorage.setItem(CONFIG,JSON.stringify(next)); generation.current++; setConnection(next); setStatus('연결 확인 완료'); }
      catch (error) { setStatus((error as Error).message); }
      finally { setBusy(false); }
    }}>
      <label className="field">시트 주소<input type="url" required value={sheetUrl} onChange={e=>setSheetUrl(e.target.value)} /></label>
      <label className="field">연결 웹 앱 주소<input type="url" required value={endpoint} onChange={e=>setEndpoint(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" /></label>
      <label className="field">연결 키<input type="password" required autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} /></label>
      <div className="sheets-actions"><button className="quiet" type="submit" disabled={busy}>연결 저장</button>
        {connection && <><button type="button" className="quiet" disabled={busy} onClick={()=>void synchronize()}>지금 동기화</button>
          <a href={connection.sheetUrl} target="_blank" rel="noopener">시트 열기</a>
          <button type="button" className="text-button" disabled={busy} onClick={()=>{ generation.current++; localStorage.removeItem(CONFIG); setConnection(null); setToken(''); setStatus('연결 해제됨'); }}>연결 해제</button></>}
      </div>
    </form>
    <p className="help" role="status">{status}{pending > 0 && ` · 전송 대기 ${pending}개`}</p>
  </details>;
}

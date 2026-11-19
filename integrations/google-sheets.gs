/** Listening Lab: run setup once in the script bound to the destination Sheet. */
function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open this script from the destination spreadsheet.');
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID',spreadsheet.getId());
  props.setProperty('ALLOWED_ORIGIN','https://willow-baek.github.io');
  if (!props.getProperty('CONNECTION_KEY')) props.setProperty('CONNECTION_KEY',Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,''));
  console.log('Connection configured. The key is stored in project Script Properties.');
}
function safeCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  const text = String(value).slice(0,4096);
  return /^[=+@-]/.test(text) ? "'" + text : text;
}
function parsedRow(row, dateColumns) {
  return row.map((value,i) => {
    if (dateColumns.indexOf(i) !== -1 && value) {
      const date = new Date(value);
      return isNaN(date.getTime()) ? '' : date;
    }
    return safeCell(value);
  });
}
function upsert(sheet,row,keyColumn,key,updatedAtColumn) {
  const last = sheet.getLastRow();
  const match = last >= 2 ? sheet.getRange(2,keyColumn,last-1,1).createTextFinder(key).matchEntireCell(true).useRegularExpression(false).findNext() : null;
  const index = match ? match.getRow() : Math.max(2,last+1);
  if (match) {
    const previous = sheet.getRange(index,updatedAtColumn).getValue();
    const incoming = row[updatedAtColumn-1];
    if (previous instanceof Date && incoming instanceof Date && previous.getTime() > incoming.getTime()) return false;
    if (keyColumn === 17 && sheet.getRange(index,7).getValue() === '완료' && row[6] !== '완료') return false;
  }
  sheet.getRange(index,1,1,row.length).setValues([row]);
  sheet.getRange(index,1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(index,updatedAtColumn).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  return true;
}
function receipt(requestId,ok,reason,origin) {
  const result = JSON.stringify({type:'listening-lab-sheet-result',requestId:requestId,ok:ok,reason:reason}).replace(/</g,'\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><script>window.top.postMessage('+result+','+JSON.stringify(origin || 'https://willow-baek.github.io')+');</script>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const origin = props.getProperty('ALLOWED_ORIGIN');
  const requestId = String(e.parameter.requestId || '').slice(0,80);
  let ok = false, reason = 'Connection rejected.';
  try {
    if (!props.getProperty('CONNECTION_KEY') || e.parameter.token !== props.getProperty('CONNECTION_KEY')) throw new Error('Invalid connection key.');
    if (e.parameter.origin !== origin) throw new Error('Unexpected app origin.');
    if (e.parameter.action === 'ping') return receipt(requestId,true,'',origin);
    if (!e.parameter.payload || e.parameter.payload.length > 100000) throw new Error('Record is too large.');
    const record = JSON.parse(e.parameter.payload);
    if (!record.sessionId || !Array.isArray(record.row) || record.row.length !== 18 || !Array.isArray(record.stages) || record.stages.length > 7 || record.row[16] !== record.sessionId) throw new Error('Invalid record.');
    if (!record.stages.every(row => Array.isArray(row) && row.length === 11 && row[8] === record.sessionId)) throw new Error('Invalid stage record.');
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const spreadsheet = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
      const sessions = spreadsheet.getSheetByName('학습 기록');
      const stages = spreadsheet.getSheetByName('단계별');
      if (!sessions || !stages) throw new Error('Destination tabs are missing.');
      const changed = upsert(sessions,parsedRow(record.row,[0,15,17]),17,record.sessionId,18);
      sessions.getRange('H2:H'+Math.max(2,sessions.getLastRow())).setNumberFormat('0.00');
      sessions.getRange('P2:P'+Math.max(2,sessions.getLastRow())).setNumberFormat('yyyy-mm-dd hh:mm:ss');
      if (changed) record.stages.forEach(row => upsert(stages,parsedRow(row,[0,10]),10,String(row[9]),11));
      stages.getRange('G2:G'+Math.max(2,stages.getLastRow())).setNumberFormat('0.00');
      SpreadsheetApp.flush();
      ok = true; reason = '';
    } finally { lock.releaseLock(); }
  } catch (error) { reason = String(error.message || 'Sheet write failed.'); }
  return receipt(requestId,ok,reason,origin);
}
function doGet() { return ContentService.createTextOutput('Listening Lab Sheets connection.'); }

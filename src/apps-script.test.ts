import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createSessions} from './domain';
import {sessionSheetRecord} from './sheet-record';
class Sheet {
 rows:any[][]=[[]];
 getLastRow(){return this.rows.length;}
 getRange(row:number|string,column=1,height=1,width=1):any {
  if(typeof row==='string')return{setNumberFormat:()=>{}};
  const sheet=this;
  return {getValue(){return sheet.rows[row-1]?.[column-1]??'';},setValues(values:any[][]){sheet.rows[row-1]=values[0];return this;},setNumberFormat(){return this;},createTextFinder(key:string){return {matchEntireCell(){return this;},useRegularExpression(){return this;},findNext(){const index=sheet.rows.findIndex((r,i)=>i>0&&r[column-1]===key);return index<0?null:{getRow:()=>index+1};}};}};
 }
}
test('Sheets receiver verifies the key, updates records idempotently and preserves completed results',()=>{
 const sessions=new Sheet(),stages=new Sheet();
 let html='';
 const properties={SHEET_ID:'test-sheet',CONNECTION_KEY:'test-key',ALLOWED_ORIGIN:'https://willow-baek.github.io'};
 const context=vm.createContext({Date,JSON,Number,String,Array,console,PropertiesService:{getScriptProperties:()=>({getProperty:(key:keyof typeof properties)=>properties[key]})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},SpreadsheetApp:{openById:(id:string)=>{assert.equal(id,'test-sheet');return{getSheetByName:(name:string)=>name==='학습 기록'?sessions:stages};},flush(){}},HtmlService:{XFrameOptionsMode:{ALLOWALL:'allow'},createHtmlOutput:(text:string)=>{html=text;return{setXFrameOptionsMode:()=>text};}}});
 vm.runInContext(readFileSync('integrations/google-sheets.gs','utf8'),context);
 const session=createSessions('https://youtu.be/E9sJp2bISxk',7,47,false)[0];session.stageElapsed=[60,0,0,0,0,0,0];
 const post=(record:any,token='test-key',action='upsert')=>context.doPost({parameter:{token,origin:properties.ALLOWED_ORIGIN,requestId:'receipt',action,payload:JSON.stringify(record)}});
 post({},'wrong','ping');assert.match(html,/false/);assert.equal(sessions.rows.length,1);
 post({},'test-key','ping');assert.match(html,/true/);assert.equal(sessions.rows.length,1);
 const record=sessionSheetRecord(session,new Date('2026-11-19T00:00:00Z'));
 post(record);post(record);assert.equal(sessions.rows.length,2);assert.equal(stages.rows.length,2);
 const complete=sessionSheetRecord({...session,phase:'result'},new Date('2026-11-19T00:01:00Z'));post(complete);
 const later=sessionSheetRecord(session,new Date('2026-11-19T00:02:00Z'));post(later);assert.equal(sessions.rows[1][6],'완료');
});

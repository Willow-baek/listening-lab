import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSessions} from './domain';
import {sessionSheetRecord,validSheetConnection} from './sheet-record';
test('sheet records keep exact clip, stage durations, actual repeats and stable identifiers',()=>{
 const s=createSessions('https://youtu.be/E9sJp2bISxk',7,47,false)[0];
 Object.assign(s,{step:5,elapsed:3600,counts:[10,10,10],stageElapsed:[60,120,400,400,400,30,0],answers:{difficulty:2}});
 const record=sessionSheetRecord(s,new Date('2026-11-19T03:00:00Z'));
 assert.equal(record.row.length,18);
 assert.equal(record.row[2],7);assert.equal(record.row[3],47);assert.equal(record.row[7],60);assert.equal(record.row[8],30);
 assert.equal(record.stages.length,6); assert.equal(record.stages[0][6],1);
 assert.equal(record.row[16],s.id);assert.equal(record.stages[0][9],`${s.id}:1`);
 assert.ok(!JSON.stringify(record).includes('transcript'));
 const legacy=sessionSheetRecord({...s,stageElapsed:undefined});assert.equal(legacy.stages.length,0);
});
test('only HTTPS Apps Script endpoints and Google Sheets destinations are accepted',()=>{
 const valid={endpoint:'https://script.google.com/macros/s/EXAMPLE/exec',token:'a'.repeat(32),sheetUrl:'https://docs.google.com/spreadsheets/d/EXAMPLE/edit'};
 assert.equal(validSheetConnection(valid),true);
 assert.equal(validSheetConnection({...valid,endpoint:'https://evil.test/exec'}),false);
 assert.equal(validSheetConnection({...valid,token:'short'}),false);
 assert.equal(validSheetConnection({...valid,sheetUrl:'https://docs.google.com.evil.test/spreadsheets/d/EXAMPLE'}),false);
});

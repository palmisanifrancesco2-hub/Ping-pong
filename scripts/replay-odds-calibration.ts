import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {agreementBlend} from '../server/blind-study.js';
import {oddsCalibration} from '../src/domain/odds-calibration.js';

const [, , source, output]=process.argv;
if(!source||!output)throw Error('INPUT_AND_OUTPUT_REQUIRED');
const raw=await readFile(source,'utf8');
const matches=JSON.parse(raw) as {day:number;prices:[number,number];sports:number;outcome:number}[];
const cases=matches.map(({day,prices:[homeOdds,awayOdds],sports:homeProbability,outcome})=>({
  day,homeOdds,awayOdds,homeProbability,homeWon:outcome===1,
  candidate:agreementBlend(homeProbability,{home:{odds:homeOdds,quoteAt:''},away:{odds:awayOdds,quoteAt:''}}),
}));
const cutoff=739921; // 2026-11-01, Python ordinal of the pre-existing holdout.
const final=cases.filter(row=>row.day>=cutoff);
await writeFile(output,JSON.stringify({sourceSha256:createHash('sha256').update(raw).digest('hex'),
  n:cases.length,finalN:final.length,finalStart:'2026-11-01',retrospective:true,
  full:oddsCalibration(cases),final:oddsCalibration(final)},null,2)+'\n');

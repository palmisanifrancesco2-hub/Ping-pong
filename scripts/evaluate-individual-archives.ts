import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {evaluateSport} from '../server/sport-training.js';

const directory=process.argv[2];
if (!directory) throw Error('Provide directory produced by research/normalize-individual-archives.py');

const sources={
  badminton:{label:'Archivio BWF · singolare maschile e femminile',timeline:'date'},
  darts:{label:'Wharton SABI · PDC Players Championship',timeline:'date'},
  snooker:{label:'Joseph D. O’Brien · archivio storico del circuito',timeline:'season'},
  boxing:{label:'Open Boxing · incontri per il titolo mondiale',timeline:'date'},
  mma:{label:'Nathan Bair · incontri UFC',timeline:'date'},
} as const;
const reports=[];
for (const sport of Object.keys(sources) as (keyof typeof sources)[]){
  const parsed=JSON.parse(await readFile(join(directory,`${sport}-normalized.json`),'utf8')) as unknown[];
  const report=evaluateSport(sport,{source:'postgres',results:parsed},Date.now());
  reports.push({...report,source:'historical',...sources[sport]});
}
console.info(JSON.stringify(reports,null,2));

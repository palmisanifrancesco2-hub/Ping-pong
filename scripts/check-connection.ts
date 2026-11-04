import { loadEnv } from 'vite';
import { OddsApi } from '../server/provider.js';
import { oddsApiKey } from '../server/env.js';
const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const report = await new OddsApi(oddsApiKey(env)).connection();
const { sports, ...summary } = report;
console.info(JSON.stringify(process.argv.includes('--summary') ? { ...summary, sportCount: sports.length } : report, null, 2));
if (report.status !== 'connected') process.exitCode = 1;

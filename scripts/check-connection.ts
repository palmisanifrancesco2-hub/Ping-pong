import { loadEnv } from 'vite';
import { OddsApi } from '../server/provider.js';
const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const report = await new OddsApi(env.THE_ODDS_API_KEY).connection();
console.info(JSON.stringify(report, null, 2));
if (report.status !== 'connected') process.exitCode = 1;

import { checkMoviOdds } from '../server/moviodds-discovery.js';

try { console.info(JSON.stringify(await checkMoviOdds(), null, 2)); }
catch (error) { console.error(error instanceof Error ? error.message : 'MOVIODDS_DISCOVERY_FAILED'); process.exitCode = 1; }

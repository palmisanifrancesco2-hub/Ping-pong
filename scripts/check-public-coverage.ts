import { checkPublicCoverage } from '../server/public-coverage.js';
try { console.info(JSON.stringify(await checkPublicCoverage(), null, 2)); }
catch (error) { console.error(error instanceof Error ? error.message : 'Verifica non riuscita.'); process.exitCode = 1; }

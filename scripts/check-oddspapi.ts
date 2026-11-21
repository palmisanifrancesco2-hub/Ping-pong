import { discoverOddsPapi } from '../server/oddspapi-discovery.js';

// Never part of build, cron, HTTP routes or frontend. No requests without explicit opt-in.
try {
  const report = await discoverOddsPapi(process.env.ODDSPAPI_API_KEY ?? '', process.argv.includes('--consume-free-requests'));
  console.info(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'ODDSPAPI_DISCOVERY_FAILED');
  process.exitCode = 1;
}

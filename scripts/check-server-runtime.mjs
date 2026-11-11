import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Compile the actual deployed entry and its transitive imports. Vite/tsx allow
// extensionless imports that plain Node ESM cannot load in Vercel Functions.
const output = resolve('.server-build');
try {
  rmSync(output, { recursive: true, force: true });
  const compiled = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server.json'], { stdio: 'inherit' });
  if (compiled.status !== 0) throw Error('SERVER_COMPILE_FAILED');
  const entry = pathToFileURL(resolve(output, 'api/[...route].js')).href;
  const smoke = `
    import assert from 'node:assert/strict';
    let externalCalls=0;
    globalThis.fetch=async()=>{externalCalls++;throw Error('UNEXPECTED_EXTERNAL_CALL');};
    const {default:handler}=await import(${JSON.stringify(entry)});
    for(const [url,status] of [['/api/health',200],['/api/access',401],['/api/board',401],['/api/study-run',401],['/api/market-study',401],['/api/prediction-system',401]]){
      const headers={};let body='';
      const res={statusCode:0,setHeader(k,v){headers[k]=v;},end(v){body=v;}};
      await handler({url,method:'GET',headers:{}},res);
      assert.equal(res.statusCode,status,url);
      assert.equal(headers['Cache-Control'],'private, no-store');
      const payload=JSON.parse(body);
      if(status===200)assert.equal(payload.status,'ok');else assert.equal(typeof payload.error,'string');
    }
    assert.equal(externalCalls,0);
    console.info(JSON.stringify({compiledServerRuntime:'success',engine:process.version,health:200,anonymousAccess:401,anonymousBoard:401,anonymousCron:401,anonymousMarketStudy:401,externalCalls}));
  `;
  // No deployment secrets or user sessions enter this smoke process.
  const checked = spawnSync(process.execPath, ['--input-type=module', '-e', smoke], { env: { NODE_ENV: 'test' }, stdio: 'inherit' });
  if (checked.status !== 0) throw Error('SERVER_RUNTIME_FAILED');
} finally {
  rmSync(output, { recursive: true, force: true });
}

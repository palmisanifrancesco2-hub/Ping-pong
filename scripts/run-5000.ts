import{spawn}from'node:child_process';
import{mkdir,writeFile,rename}from'node:fs/promises';
const directory=new URL('../.research-data/',import.meta.url);await mkdir(directory,{recursive:true});
const job=new URL('5000-job.json',directory),began=new Date().toISOString();
async function status(phase:string,reason?:string){const value={phase,startedAt:began,updatedAt:new Date().toISOString(),pid:process.pid,target:5000,progress:'.research-data/5000-data.json.progress.json',report:'research/report-v5.json',reason};await writeFile(new URL('5000-job.tmp',directory),JSON.stringify(value,null,2)+'\n');await rename(new URL('5000-job.tmp',directory),job);}
async function run(args:string[]){await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',...args],{stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`STEP_EXIT_${code}`)));});}
try{
 await status('collecting');
 await run(['scripts/collect-5000.ts','/tmp/pingpong-results-all.json','.research-data/5000-data.json']);
 await status('comparing');
 await run(['scripts/compare-models.ts','.research-data/5000-data.json','.research-data/5000-data.json.empty.json','research/report-v5.json','.research-data/5000-comparison-audit.json','research/protocol-v5.json']);
 await status('completed');console.info('5000_CASE_BENCHMARK_COMPLETED');
}catch(e){await status('blocked',e instanceof Error?e.message:'STEP_FAILED');console.error('5000_CASE_BENCHMARK_BLOCKED_CHECK_PROGRESS');process.exitCode=1;}

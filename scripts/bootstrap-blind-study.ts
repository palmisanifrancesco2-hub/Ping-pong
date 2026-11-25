import {BlindStudy,blindStudyEnabled,logWeeklyDisagreement} from '../server/blind-study.js';

if(process.env.VERCEL_ENV==='production'&&blindStudyEnabled(process.env)){
  try{
    const study=new BlindStudy(process.env);
    const result=await study.run(undefined,Date.now()+155_000,true);
    console.info(JSON.stringify({blindStudyBootstrap:result}));
  }catch(error){
    const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'BLIND_STUDY_BOOTSTRAP_FAILED';
    console.warn(JSON.stringify({blindStudyBootstrap:{status:'failed',code}}));
  }
} else console.info('Test a risultato coperto: avvio iniziale non richiesto.');

if(process.env.VERCEL_ENV==='production'&&process.env.CRON_SECRET&&blindStudyEnabled(process.env)){
  try{
    const study=new BlindStudy(process.env);
    const result=await study.runWeekly(true);
    console.info(JSON.stringify({weeklyPingPongBootstrap:result.status}));
    logWeeklyDisagreement(await study.disagreementSnapshot());
  }catch{
    console.warn('WEEKLY_PING_PONG_BOOTSTRAP_FAILED');
  }
}

import {BlindStudy,blindStudyEnabled} from '../server/blind-study.js';

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

import {MarketStudy} from '../server/market-study.js';
import {ProspectiveStudy} from '../server/prospective-study.js';
// Explicit versioned bootstrap: production only, same already enabled free cron.
// Daily persistent claim prevents re-enrollment when a build is retried.
if(process.env.VERCEL_ENV!=='production'||process.env.APP_FORWARD_STUDY_ENABLED!=='1'){
  console.info('Market study bootstrap: non richiesto.');
}else{
  try{
    const service=new MarketStudy(process.env),owner=await new ProspectiveStudy(process.env).ownerId();
    const result=await service.run(owner),report=await service.report(owner);
    console.info(JSON.stringify({marketStudyBootstrap:result,persisted:{captured:report.captured,settled:report.settled,pending:report.pending,observedDays:report.observedDays,scheduled:report.scheduled,operationallyValidated:false}}));
  }
  catch{console.error('MARKET_STUDY_BOOTSTRAP_FAILED');process.exitCode=1;}
}

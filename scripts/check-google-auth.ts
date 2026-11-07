import{googleAvailability}from'../src/shared/google-auth.js';
if(process.env.VERCEL_ENV!=='production'){console.info('Google Auth verification: non richiesta in questo ambiente.');}
else{try{const report=await googleAvailability(process.env.SUPABASE_URL??'',process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'');console.info(JSON.stringify({googleAuthVerification:'success',googleEnabled:report.enabled,signupEnabled:report.signupEnabled,callbackUrl:report.callbackUrl}));}
catch{console.info(JSON.stringify({googleAuthVerification:'unavailable',googleEnabled:null}));}}

import {PlayerProfiles} from '../server/player-profiles.js';
const profiles=new PlayerProfiles(undefined,Date.now,true);const p=await profiles.lookup('Ma Long');
if(p.status!=='candidate'||p.candidates[0]?.id!=='Q459114')throw Error('PROFILE_REAL_CHECK_FAILED');
console.info(JSON.stringify({profileVerification:'success',source:p.source,license:p.license,status:p.status,publicId:p.candidates[0].id,hasBirthDate:!!p.candidates[0].birthDate,countries:p.candidates[0].countries,checkedAt:p.checkedAt,usedForModel:false}));

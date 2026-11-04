import{describe,it,expect}from'vitest';
import{assessValue,rankValues,type ValueInput}from'../src/domain/value';
import{currentValueReport}from'../server/value';
const row:ValueInput={id:'synthetic',eventId:'test',match:'Test A — Test B',competition:'Synthetic',market:'winner',selection:'Test A',odds:2,quoteAt:'2026-11-04T12:00:00Z',probability:.6,probabilityLower:.55,sampleSize:100,validationSize:200,modelValidated:true,fresh:true,admVerified:true};
describe('statistical value selection (synthetic only)',()=>{
 it('compares model probability with the price and uses a conservative margin',()=>{const r=assessValue(row)!;expect(r.impliedProbability).toBe(.5);expect(r.fairOdds).toBeCloseTo(1/.6);expect(r.ev).toBeCloseTo(.2);expect(r.conservativeEv).toBeCloseTo(.1);expect(r.assessment).toBe('Ottima');});
 it('does not confuse a high price or a likely win with value',()=>{expect(assessValue({...row,odds:6,probability:.1,probabilityLower:.07})).toBeNull();expect(assessValue({...row,odds:1.3,probability:.8,probabilityLower:.7})).toBeNull();});
 it('can identify value in an underdog rather than always choosing the favorite',()=>{expect(assessValue({...row,odds:3.2,probability:.4,probabilityLower:.35})?.ev).toBeCloseTo(.28);});
 it('blocks invalid samples, validation, freshness and unverified bookmakers',()=>{for(const override of [{modelValidated:false},{fresh:false},{sampleSize:29},{validationSize:99},{odds:1.29},{odds:Infinity},{probabilityLower:.7}])expect(assessValue({...row,...override})).toBeNull();expect(assessValue({...row,odds:100,probability:.05,probabilityLower:.03})).not.toBeNull();});
 it('does not require ADM after the explicit user change',()=>{expect(assessValue({...row,admVerified:false})).not.toBeNull();});
 it('ranks conservative value before probability and has no real candidates while blocked',()=>{const rows=rankValues([row,{...row,id:'higher',odds:2.2}]);expect(rows[0].id).toBe('higher');const real=currentValueReport();expect(real.status).toBe('experimental');expect(real.opportunities).toEqual([]);expect(real.modelValidated).toBe(false);});
});

"""Reproducible, read-only inventory of real local sources. Publishes aggregates only.

Remote Supabase counts and configured secrets are deliberately not inspected.
Run: python scripts/inventory-data-v16.py
"""
import csv,hashlib,json,math,re,unicodedata,os
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'.research-data'


def stamp(value):
    if not isinstance(value,str):return None
    try:return datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()*1000
    except ValueError:return None


def normalize(name):
    return ' '.join(unicodedata.normalize('NFKC',name).strip().casefold().split())


def percentage(n,d):return round(100*n/d,4) if d else None
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def load(path):return json.loads(path.read_text())


def score_checks(sets,winner):
    if not sets or any(not isinstance(a,int) or not isinstance(b,int) or min(a,b)<0 or max(a,b)<11 or abs(a-b)<2 or (max(a,b)>11 and abs(a-b)!=2) for a,b in sets):return False
    a=sum(x>y for x,y in sets);b=len(sets)-a;target=max(a,b)
    return target in [3,4] and a!=b and int(a>b)==int(winner) and not any(sum(x>y for x,y in sets[:i])==target or sum(x<y for x,y in sets[:i])==target for i in range(1,len(sets)))


def parse_score(value):
    tokens=value.split(',');matches=[re.fullmatch(r'(\d+)-(\d+)',s.strip()) for s in tokens]
    return [tuple(map(int,m.groups())) for m in matches] if matches and all(matches) else []


def fields_missing(rows,fields):
    return {k:{'missing':sum(r.get(k) in [None,'','NA'] for r in rows),'percent':percentage(sum(r.get(k) in [None,'','NA'] for r in rows),len(rows))} for k in fields}


def normalized_results(rows,label,path):
    seen={};conflicts=set();duplicates=0;counts=Counter();players=set();leagues=Counter();dates=[];availability=[]
    missing=fields_missing(rows,['id','home','away','league','finishedAt','availableAt','sets','homeWon'])
    for r in rows:
        if r['id'] in seen:
            duplicates+=1
            if seen[r['id']]!=r:conflicts.add(r['id'])
        else:seen[r['id']]=r
        if score_checks(r.get('sets',[]),r.get('homeWon',False)):counts['completeCoherentScore']+=1
        else:counts['scoreOrOutcomeInconsistency']+=1
        if r.get('sets'):counts['withIndividualSetPoints']+=1
        a=stamp(r.get('finishedAt'));b=stamp(r.get('availableAt'))
        if a is not None:dates.append(r['finishedAt'])
        if b is not None:availability.append(r['availableAt'])
        if a is None or b is None or b<a:counts['invalidTimeOrAvailabilityBeforeFinish']+=1
        players.update((r.get('league',''),normalize(str(r.get(k,'')))) for k in ['home','away'])
        leagues[r.get('league','')]+=1
        sets=r.get('sets',[])
        if sets:counts['inferredBO'+str(2*max(sum(x>y for x,y in sets),sum(x<y for x,y in sets))-1)]+=1
    return {'source':label,'localFile':str(path.relative_to(ROOT)),'sha256':digest(path),'rows':len(rows),'uniqueMatchIds':len(seen),'duplicateRowsById':duplicates,'conflictingMatchIds':len(conflicts),'playersWithinCompetitionByNormalizedName':len(players),'competitions':dict(leagues),'finishedRange':{'from':min(dates) if dates else None,'to':max(dates) if dates else None},'informationAvailabilityRange':{'from':min(availability) if availability else None,'to':max(availability) if availability else None},'counts':dict(counts),'missingFields':missing,'timestampMeaning':'finishedAt is source-reported finish; availableAt is max(finishedAt, source updated_at). Neither is kickoff or proof of first publication.','historicalOddsEmbeddedRows':0,'reconstructibleLabels':['winner','exact_match_set_score','number_of_sets','match_set_handicap','match_total_points','match_point_handicap','set_winner_if_set_played','set_total_points','set_point_handicap','wins_at_least_one_set','straight_sets','comeback_after_losing_first_set'],'liveRallySequenceAvailable':False,'regulationBeforeEventVerified':False}


def wtt(file,gender):
    path=DATA/file
    with path.open() as f:rows=list(csv.DictReader(f))
    counts=Counter();players=set();events=Counter();ids=set();rawids=set();dates=[]
    for r in rows:
        key=gender+':'+r['match_id']
        if key in ids:counts['duplicateIdsWithinCohort']+=1
        ids.add(key);rawids.add(r['match_id']);events[r['event_name']]+=1
        players.update(normalize(r[k]) for k in ['player1_name','player2_name'] if r[k])
        try:dates.append(datetime.strptime(r['event_date'],'%Y-%m-%d').date().isoformat())
        except ValueError:counts['invalidDate']+=1
        sets=parse_score(r['score'])
        coherent=r['winner'] in ['1','2'] and score_checks(sets,r['winner']=='1')
        if coherent:
            counts['coherentCompleteScoreWithoutTrustingBestOf']+=1
            target=max(sum(a>b for a,b in sets),sum(a<b for a,b in sets))
            if str(2*target-1)==r['best_of']:counts['coherentIncludingDeclaredBestOf']+=1
            else:counts['bestOfContradictsCompletedScore']+=1
        else:counts['inconsistentScoreOrWinner']+=1
        if sets:counts['parsedIndividualSetPoints']+=1
    return {'source':'RSMD WTT / Li02003121 / OSF pjuw8','cohort':gender,'localFile':str(path.relative_to(ROOT)),'sha256':digest(path),'rows':len(rows),'uniqueNamesWithinCohort':len(players),'uniqueNamespacedIds':len(ids),'competitions':dict(events),'dateRange':{'from':min(dates),'to':max(dates)},'counts':dict(counts),'missingFields':fields_missing(rows,list(rows[0])),'historicalOddsRows':0,'verifiedKickoffTimes':0,'firstPublicationTimestamps':0,'declaredDataLicense':'CC BY 4.0','sourceUrl':'https://doi.org/10.17605/OSF.IO/PJUW8','reconstructibleLabels':['winner','score-derived-set-and-point-labels-with-format-metadata-conflict'],'operationalMarketsApproved':[],'limitations':['Source dates may identify event rather than match; first availability unverified.','Seven-day history lag in v15 is a convention, not verified publication timing.','Do not use unverified rankings or best_of as prematch features.','WTT cohorts differ from current minor-league application; performance does not transfer automatically.']},rawids


def setka():
    path=DATA/'setka-september-2022.csv'
    with path.open() as f:rows=list(csv.DictReader(f))
    counts=Counter();players=set();dates=[];unique=set()
    for r in rows:
        unique.add(tuple(v for k,v in r.items() if k!='X'))
        players.update(normalize(r[k]) for k in ['Player1','Player2'] if r[k])
        try:dates.append(datetime.strptime(r['Date'],'%m/%d/%Y').date().isoformat())
        except ValueError:counts['invalidDate']+=1
        sets=[];invalid=False
        for i in range(1,6):
            a=r[f'P1_G{i}'];b=r[f'P2_G{i}']
            if a in ['NA',''] and b in ['NA','']:continue
            try:sets.append((int(a),int(b)))
            except ValueError:invalid=True
        if sets:counts['withIndividualSetPoints']+=1
        if not invalid and score_checks(sets,r['HomeWinner']=='1'):
            counts['coherentScoreAndWinner']+=1
            if (sum(a>b for a,b in sets),sum(a<b for a,b in sets))!=(int(r['Sets_P1']),int(r['Sets_P2'])):counts['declaredSetScoreMismatch']+=1
        else:counts['inconsistentScoreOrWinner']+=1
    return {'source':'Gavin Cassidy / SCORE Sports Data Repository','sourceUrl':'https://data.scorenetwork.org/table_tennis/table_tennis_sept2022.html','localFile':str(path.relative_to(ROOT)),'sha256':digest(path),'rows':len(rows),'uniqueRowsIgnoringIndex':len(unique),'duplicateRowsIgnoringIndex':len(rows)-len(unique),'playersByNormalizedName':len(players),'competitions':{'Setka Cup as described by publisher':len(rows)},'dateRange':{'from':min(dates),'to':max(dates)},'counts':dict(counts),'missingFields':fields_missing(rows,list(rows[0])),'historicalOddsRows':0,'verifiedKickoffTimes':0,'firstPublicationTimestamps':0,'timeOfDayRows':sum(bool(r['Time']) for r in rows),'timezoneVerified':False,'descriptionPeriod':'September 2022','descriptionContradictsCsvDates':True,'redistributionLicenseVerified':False,'reconstructibleLabels':['winner','BO5 exact result/sets/points/set-by-set targets where score checks pass'],'operationalMarketsApproved':[]}


def strict_start(payload,result):
    if not isinstance(payload,dict):return None
    at=stamp(payload.get('kickoff_utc'))
    if at is None:return None
    at-=60000
    selections=payload.get('selections') if isinstance(payload.get('selections'),list) else []
    names={s.get('side') for s in selections if isinstance(s,dict)}
    ids=payload.get('fixture_ids') if isinstance(payload.get('fixture_ids'),list) else []
    finished=stamp(result.get('finishedAt'))
    if payload.get('closed') is not True or payload.get('kickoff_known') is not True or payload.get('kickoff_estimated') is not False or result['id'] not in [payload.get('fixture_id'),*ids] or finished is None or not at<finished<at+6*3600000 or not {result['home'],result['away']}<=names:return None
    return at


def strict_pair(payload,result,at):
    if not isinstance(payload,dict) or not isinstance(payload.get('selections'),list):return False
    if payload.get('pre_close_basis')!='kickoff':return False
    q=[s.get('pre_close') for s in payload.get('selections',[]) if isinstance(s,dict) and s.get('group_id')=='920000' and s.get('market_id')=='920000' and s.get('line')=='To Win' and s.get('side') in [result['home'],result['away']]]
    if len(q)!=2 or any(not isinstance(x,dict) for x in q):return False
    a=next((x for x in q if x.get('side')==result['home']),None);b=next((x for x in q if x.get('side')==result['away']),None)
    if not a or not b or a.get('market_id')!=b.get('market_id') or a.get('period')!=b.get('period'):return False
    return all(x.get('suspended') is False and isinstance(x.get('odds_dec'),(int,float)) and math.isfinite(x['odds_dec']) and x['odds_dec']>1 and stamp(x.get('ts')) is not None and 0<=at-stamp(x['ts'])<=300000 for x in [a,b])


def qualifying_pairs_for_features():
    """Private as-of pairs restricted to the existing causal feature dataset."""
    source=load(DATA/'3000-data.json');results={r['id']:r for r in source['results']}
    feature_rows=load(DATA/'market-v8-features.json')['rows'];pairs=[];cache=DATA/'3000-data.json.cache'
    counts=Counter()
    for f in feature_rows:
        r=results.get(f['id']);path=cache/(f['id']+'.json')
        if not r:counts['resultAbsent']+=1;continue
        try:p=load(path)
        except (OSError,ValueError):counts['payloadAbsentOrUnreadable']+=1;continue
        at=strict_start(p,r)
        if at!=f['at']:counts['kickoffGuardMismatch']+=1;continue
        if not strict_pair(p,r,at):counts['noStrictAsOfPair']+=1;continue
        qs=[s['pre_close'] for s in p['selections'] if s.get('group_id')=='920000' and s.get('market_id')=='920000' and s.get('line')=='To Win' and s.get('side') in [r['home'],r['away']]]
        a=next(q for q in qs if q['side']==r['home']);b=next(q for q in qs if q['side']==r['away']);ah=1/a['odds_dec'];bh=1/b['odds_dec']
        if f['featuresAvailable']>=at:counts['featuresUnavailableAtDecision']+=1;continue
        pairs.append({'id':f['id'],'at':at,'actualKickoff':at+60000,'decisionTime':at,'featuresAt':f['at'],'featuresAvailable':f['featuresAvailable'],'featuresMatched':True,'homeOdds':a['odds_dec'],'awayOdds':b['odds_dec'],'homeQuoteAt':a['ts'],'awayQuoteAt':b['ts'],'rawHomeProbability':ah,'rawAwayProbability':bh,'marketProbability':ah/(ah+bh),'overround':ah+bh-1})
    report={'source':'MoviOdds bet365.com.au','rule':'Exact winner pre_close pair available no later than verified kickoff minus one minute; no more than five minutes old; non-suspended; matched to the same causal feature row.','featureRows':len(feature_rows),'rejected':dict(counts),'rows':pairs,'notADMSiteVerified':True,'operationallyValidated':False}
    path=DATA/'v16-qualified-market-baselines.json'
    with path.open('w') as stream:os.chmod(stream.fileno(),0o600);json.dump(report,stream,allow_nan=False)
    return {'featureRows':len(feature_rows),'qualifyingRows':len(pairs),'rejected':dict(counts),'privateFile':str(path.relative_to(ROOT)),'privateFileSha256':digest(path),'quoteRowsDoNotCertifyExecutability':True}


def closing_inventory(results):
    matched=set();starts=set();pairs=set();counts=Counter();manifest=load(DATA/'3000-data.json')['starts'];manifest_ids={r['id'] for r in manifest}
    cache=DATA/'3000-data.json.cache'
    for path in cache.glob('*.json'):
        counts['cacheEntries']+=1
        try:p=load(path)
        except (OSError,ValueError):counts['unreadableOrBrokenCacheEntries']+=1;continue
        r=results.get(path.stem)
        if not r:counts['outsidePrimarySnapshot']+=1;continue
        matched.add(r['id'])
        at=strict_start(p,r)
        if at is None:continue
        starts.add(r['id'])
        if strict_pair(p,r,at):pairs.add(r['id'])
    return {'counts':dict(counts),'snapshotMatchesWithCachedClosingPayload':len(matched),'strictKickoffGuardsRevalidated':len(starts),'previousManifestStartRows':len(manifest),'manifestIds':len(manifest_ids),'manifestIdsMissingOrFailingRevalidation':len(manifest_ids-starts),'strictFreshTwoSidedWinnerQuotePairsBeforeGuard':len(pairs),'historicalOddsForAll23596Matches':False,'strictQuoteRule':'Same as src/domain/research-source.ts: known nonestimated actual kickoff; exact player pair and match; unsuspended prices >1; timestamp <= kickoff-1m and no older than 5m.','bookmakerSite':'bet365.com.au','admAuthorizationVerifiedForThisSite':False,'scope':'This is historical cache coverage; presence does not prove executable historical prices or recorded predictions.'}


def features():
    reports=[]
    for file in ['market-v8-features.json','market-v8-confirmation-features.json','market-v8-extension-features.json']:
        p=DATA/file;x=load(p);rows=x['rows'];reports.append({'file':str(p.relative_to(ROOT)),'sha256':digest(p),'rows':len(rows),'uniqueIds':len(set(r['id'] for r in rows)),'featureCount':len(rows[0]['x']) if rows else 0,'targets':len(rows[0]['y']) if rows else 0,'invalidCausalOrderWhereOutcomeAvailabilityPresent':sum(not (r['featuresAvailable']<r['at']<r['available']) for r in rows if 'available'in r),'outcomeAvailabilityAbsentRows':sum('available'not in r for r in rows),'alreadyInspectedHistoricalArchive':True})
    return reports


def forward_manifest():
    path=DATA/'forward-v3.json';x=load(path);rows=x['predictions'];counts=Counter()
    for r in rows:
        at=stamp(r['observedAt']);kickoff=stamp(r['scheduledStart'])
        if at is not None and kickoff is not None and at<kickoff:counts['recordedBeforeScheduledStart']+=1
        pair=[(r.get('homeOdds'),r.get('homeQuoteAt')),(r.get('awayOdds'),r.get('awayQuoteAt'))]
        if at is not None and all(isinstance(o,(int,float)) and o>1 and stamp(t)is not None and stamp(t)<=at for o,t in pair):counts['twoSidedQuotePairTimestampedByObservation']+=1
    return {'file':str(path.relative_to(ROOT)),'rows':len(rows),'observedAt':x['observedAt'],'source':x['source'],'bookmakerSite':x['bookmakerSite'],'counts':dict(counts),'resultsNotReScoredHere':True,'productionValidated':False,'notAnAdditionalIndependentHistoricalDataset':True}


def main():
    primary_path=DATA/'3000-data.json';primary=load(primary_path)
    forward_path=DATA/'forward-v3.json.archive.json';forward=load(forward_path)
    a=normalized_results(primary['results'],'MoviOdds collected snapshot',primary_path);b=normalized_results(forward,'MoviOdds forward capture archive',forward_path)
    a['snapshotCollectedAt']=primary['collectedAt'];a['previousVerifiedStartRows']=len(primary['starts'])
    aid={r['id'] for r in primary['results']};bid={r['id'] for r in forward}
    men,mi=wtt('table_tennis_wtt_men_std.csv','men');women,wi=wtt('table_tennis_wtt_women_std.csv','women')
    sql='\n'.join(p.read_text() for p in (ROOT/'supabase/migrations').glob('*.sql'))
    tables=sorted(set(re.findall(r'create table(?: if not exists)?\s+([\w.]+)',sql,re.I)))
    report={'version':'real-data-inventory-v16','generatedAt':datetime.now(timezone.utc).isoformat(),'scope':'Local files and source-code/migration inspection only; no remote secrets, user sessions or DB credentials read.',
      'moviodds':[a,b],'overlap':{'movioddsSnapshotCommonIds':len(aid&bid),'movioddsDistinctUnionIds':len(aid|bid),'forwardSnapshotAdditionalIds':len(bid-aid),'wttRawIdsCollideAcrossGenderFiles':len(mi&wi),'doNotSumAllReportsAsNewMatches':True},
      'wtt':[men,women],'setka':setka(),'historicalClosingCache':closing_inventory({r['id']:r for r in primary['results']}),'qualifiedFeatureOddsSubset':qualifying_pairs_for_features(),'featureDatasets':features(),'recordedForwardManifest':forward_manifest(),
      'database':{'schemaTables':tables,'schemaDefined':True,'remoteRowCountsVerifiedInThisAudit':False,'remoteCounts':None,'quoteFields':['source_updated_at','received_at','decimal_odds','suspended','source','mode'],'resultFields':['available_at','recorded_at','score','source','status'],'forecastIntegrityFields':['features_available_at','predicted_at','model_id','evidence'],'privateProspectiveLedger':'model_versions.parameters stores original v9/v10 cases, forecasts, outcomes and checkpoints behind RLS and owner authorization. Not exported to workspace by this audit.','access':'Supabase Auth + authorized_users/private membership + RLS; schema presence is not evidence of complete live data.'},
      'apiIntegrations':{'activeOddsAndResults':'MoviOdds public bet365.com.au board/results/closing integration','theOddsApi':{'implemented':'server/provider.ts V4 sports/events/markets/odds; server/env.ts private key selection','catalogPingPongCoverageReverifiedNow':False,'configuredKeyPresenceRead':False,'runtimeCallsMadeByInventory':0,'operationalCoverageProvenByThisAudit':False,'note':'Dormant diagnostic preserved; main board does not use this provider. A configured credential is not evidence of table-tennis coverage.'}},
      'marketReadiness':{'reconstructibleTargetsVersusPrediction':'Complete score sequences permit many retrospective labels; prediction requires known prematch format, causal features, timestamps and market-specific validation.','supportedResearch14Targets':['winner','first-set winner','first-set total points 19.5','total sets 3.5','total sets 4.5','total points 74.5','total points 79.5','total points 84.5','home set handicap -1.5','home set handicap +1.5','home point handicap -5.5','home point handicap +5.5','home point handicap -9.5','home point handicap +9.5'],'furtherLabelsFeasible':['exact match result','all played-set winners','all played-set points/handicaps','wins at least a set','straight sets','comeback after losing first set'],'unsupportedWithoutAdditionalData':['point-by-point live model','server/receiver conditioned model','within-rally stroke model','unplayed-set unconditional winner without explicit conditional semantics','ADM operational comparison without site-specific verified authorization'],'noMarketNewlyValidatedByThisInventory':True},
      'blockingRequirements':['Verified prematch format by competition/event, especially inconsistent WTT best_of.','Historical publication/kickoff evidence for dates-only CSV; arbitrary lag is not verification.','Full timestamped historical odds/pairs aligned to forecast instant for odds-input benchmark and executable ROI.','Source-site-specific ADM verification; bet365.com.au is not interchangeable with an Italian site.','Remote prospective counts and outcomes require authorized server report; not guessed from repository code.','A new untouched future test cohort is required after repeated inspection of historical reports.']}
    output=ROOT/'research/data-inventory-v16.json';output.write_text(json.dumps(report,indent=2,ensure_ascii=False,allow_nan=False)+'\n')
    print(json.dumps({'output':str(output.relative_to(ROOT)),'movioddsPrimaryRows':a['rows'],'distinctMovioddsUnion':len(aid|bid),'wttRows':men['rows']+women['rows'],'setkaRows':report['setka']['rows'],'closing':report['historicalClosingCache'],'privateRowsPublished':False},ensure_ascii=False))


if __name__=='__main__':main()

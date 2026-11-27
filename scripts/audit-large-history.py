"""Offline source audit: downloaded rows are not independently validated test matches."""
import csv,json,re,hashlib
from pathlib import Path
from collections import Counter
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'.research-data'


def audit_wtt(file):
    path=DATA/file;rows=list(csv.DictReader(path.open()));counts=Counter();ids=set()
    for r in rows:
        if r['match_id'] in ids:counts['duplicateIdsWithinFile']+=1
        ids.add(r['match_id'])
        if not all(r[k] for k in ['event_date','player1_name','player2_name']):counts['missingIdentityDate']+=1;continue
        try:datetime.strptime(r['event_date'],'%Y-%m-%d')
        except ValueError:counts['invalidDate']+=1;continue
        tokens=r['score'].split(',');matches=[re.fullmatch(r'(\d+)-(\d+)',s.strip()) for s in tokens]
        if not matches or not all(matches):counts['unparsedScore']+=1;continue
        pairs=[tuple(map(int,m.groups())) for m in matches]
        if any(max(a,b)<11 or (max(a,b)==11 and min(a,b)>9) or (max(a,b)>11 and abs(a-b)!=2) for a,b in pairs):counts['illegalOrIncompleteSets']+=1;continue
        a=sum(x>y for x,y in pairs);b=len(pairs)-a
        if a==b or str(1 if a>b else 2)!=r['winner']:counts['winnerMismatch']+=1;continue
        target=max(a,b)
        if target not in [3,4] or any(sum(x>y for x,y in pairs[:i])==target or sum(x<y for x,y in pairs[:i])==target for i in range(1,len(pairs))):counts['stoppingRuleMismatch']+=1;continue
        counts['passesScoreAndWinnerChecksWithoutTrustingBestOf']+=1
        if target!=(int(r['best_of'])+1)//2:counts['declaredBestOfMismatchAmongOtherwiseCoherentRows']+=1
        else:counts['passesIncludingDeclaredBestOf']+=1
    return {'file':file,'rows':len(rows),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'counts':dict(counts),'dateMin':min(r['event_date'] for r in rows),'dateMax':max(r['event_date'] for r in rows),'namespace':'Filename/gender must prefix match_id; IDs repeat across men and women','hasHistoricalOdds':False,'hasKickoffTime':False,'formatAutoCorrected':False}


def run():
    output=ROOT/'research/history-10000-sources.json'
    if output.exists():raise RuntimeError('Do not overwrite an inspected audit')
    setka=DATA/'setka-september-2022.csv';s=list(csv.DictReader(setka.open()));dates=[datetime.strptime(r['Date'],'%m/%d/%Y').date().isoformat() for r in s]
    old=json.loads((DATA/'3000-data.json').read_text())
    report={'generatedAt':datetime.now(timezone.utc).isoformat(),'purpose':'Feasibility and integrity audit for a 10000-match historical study; not a backtest report',
      'movioddsExisting':{'rows':len(old['results']),'uniqueIds':len(set(r['id'] for r in old['results'])),'previouslyVerifiedStarts':len(old['starts']),'note':'Only a subset currently has independently cross-checked kickoff times; do not use result availability as kickoff.'},
      'scoreSetka':{'source':'https://data.scorenetwork.org/table_tennis/table_tennis_sept2022.html','download':'https://data.scorenetwork.org/data/table_tennis-sept2022.csv','rows':len(s),'uniqueRowsIgnoringIndex':len(set(tuple(v for k,v in r.items() if k!='X') for r in s)),'sha256':hashlib.sha256(setka.read_bytes()).hexdigest(),'dateMin':min(dates),'dateMax':max(dates),'pageDescriptionPeriod':'September 2022','descriptionDateMismatch':True,'hasSetScores':True,'hasHistoricalOdds':False,'licenseForRedistributionNotVerified':True},
      'wtt':{'source':'https://github.com/Li02003121/racket-sports-dataset','doi':'https://doi.org/10.17605/OSF.IO/PJUW8','download':'https://osf.io/download/3f6ak/','declaredDataLicense':'CC BY 4.0','files':[audit_wtt(f) for f in ['table_tennis_wtt_men_std.csv','table_tennis_wtt_women_std.csv']]},
      'eloCommercialAlternative':{'source':'https://github.com/lathise2025/table-tennis-elo-dataset','freeSampleRows':2000,'fullDatasetNotAcquired':True},
      'tenThousandRawWttRowsDownloaded':True,'tenThousandIndependentTestMatchesValidated':False,'limitations':['Training/calibration and warmup consume rows; 10000 downloaded rows do not guarantee 10000 test cases.','WTT men/women, Setka 2022 and current minor leagues must remain separate cohorts; no blind pooling.','No verified historical pre-event odds in these CSVs; cannot prove executable EV or ROI.','Published counts and legal scores do not independently certify results as official.','No original prospective study or runtime model changed.']}
    with output.open('x') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps(report))


if __name__=='__main__':run()

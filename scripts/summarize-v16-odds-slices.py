"""Descriptive fixed slices of the frozen odds test; never changes a model."""
import json,hashlib
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
from advanced_benchmark import metrics
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'.research-data'


def main():
    output=ROOT/'research/report-v16-odds-slices.json'
    if output.exists():raise RuntimeError('Do not overwrite inspected descriptive slices')
    report=ROOT/'research/report-v16-odds.json';audit=json.loads((DATA/'v16-odds-audit.json').read_text())
    digest=hashlib.sha256(report.read_bytes()).hexdigest()
    if audit['reportHash']!=digest:raise RuntimeError('Frozen odds report changed')
    q={r['id']:r for r in json.loads((DATA/'v16-qualified-market-baselines.json').read_text())['rows']};features={r['id']:r for r in json.loads((DATA/'market-v8-features.json').read_text())['rows']}
    y=np.asarray(audit['y']);market=np.asarray(audit['market']);odds=np.asarray([q[key]['homeOdds'] if p>.5 else q[key]['awayOdds'] if p<.5 else np.nan for key,p in zip(audit['ids'],market)])
    models={**audit['predictions'],'market-only':audit['market']}
    def sliced(mask):return {name:metrics(y[mask],np.asarray(p)[mask]) for name,p in models.items()} if mask.any() else None
    edges=[(0,1.3),(1.3,1.5),(1.5,2),(2,3),(3,None)];bins=[]
    for low,high in edges:
        mask=np.isfinite(odds)&(odds>=low)&(odds<high if high is not None else True)
        bins.append({'minimumInclusive':low,'maximumExclusive':high,'n':int(mask.sum()),'metrics':sliced(mask)})
    leagues={league:sliced(np.asarray([features[key]['league']==league for key in audit['ids']])) for league in sorted({features[key]['league'] for key in audit['ids']})}
    days={day:sliced(np.asarray([datetime.fromtimestamp(q[key]['at']/1000,timezone.utc).date().isoformat()==day for key in audit['ids']])) for day in sorted({datetime.fromtimestamp(q[key]['at']/1000,timezone.utc).date().isoformat() for key in audit['ids']})}
    result={'version':'asof-odds-v16-descriptive-slices','generatedAt':datetime.now(timezone.utc).isoformat(),'frozenReportHash':digest,'n':len(y),'tiesWithoutModalSelection':int((market==.5).sum()),'quoteBinDefinition':'Decimal price of market-favored selection; ties kept in total but no side/price assigned. Fixed display intervals only, not selected for performance.','oddsBins':bins,'perCompetition':leagues,'perDay':days,'independentValidation':False,'operationallyValidated':False,'roi':None,'limitations':['Descriptive post-report summary; not extra independent evidence or optimized selection rule.','Every bin/league/day is a subset of the same 88 events; do not sum them as new tests.','All odds source AU; no operational ADM qualification.']}
    if sum(b['n'] for b in bins)+result['tiesWithoutModalSelection']!=len(y):raise RuntimeError('Slice coverage mismatch')
    with output.open('x') as f:json.dump(result,f,indent=2,allow_nan=False);f.write('\n')
    print(json.dumps({'n':len(y),'ties':result['tiesWithoutModalSelection'],'bins':[{'lower':b['minimumInclusive'],'upper':b['maximumExclusive'],'n':b['n']} for b in bins],'modelChanges':False}))


if __name__=='__main__':main()

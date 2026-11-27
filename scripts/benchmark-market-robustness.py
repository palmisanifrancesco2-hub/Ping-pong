"""Re-evaluate the model families in an external circuit and audit exact odds pairs."""
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np

from advanced_benchmark import metrics
from coherent_score_model import categorical_metrics, score_class
from odds_outcome_summary import summarize

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / '.research-data'
RESEARCH = ROOT / 'research'


def load(name):
    return json.loads((RESEARCH / name).read_text())


def module(filename):
    import importlib.util
    spec = importlib.util.spec_from_file_location(filename, Path(__file__).with_name(filename))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def wtt_samples(filename, sha, rules, build_features, outcomes):
    path = DATA / filename
    if hashlib.sha256(path.read_bytes()).hexdigest() != sha:
        raise ValueError('Changed WTT input')
    with path.open(newline='') as handle:
        raw = list(csv.DictReader(handle))
    occurrences = Counter(r['match_id'] for r in raw)
    matches, labels = defaultdict(list), defaultdict(list)
    counts = Counter(raw=len(raw))
    for row in raw:
        try:
            day = date.fromisoformat(row['event_date']).toordinal()
            sets = [tuple(map(int, pair.split('-'))) for pair in row['score'].split(',')]
            score = score_class(sets)
            names = tuple(' '.join(row[column].casefold().split()) for column in ('player1_name','player2_name'))
            if (not all(names) or names[0] == names[1] or not row['match_id'] or occurrences[row['match_id']] != 1
                    or row['winner'] != ('1' if score < 3 else '2')):
                raise ValueError('Inconsistent fixture')
        except ValueError:
            counts['outsideCompleteBO5OrInvalid'] += 1
            continue
        margins = [a-b for a,b in sets]
        matches[day].append((names,int(score<3),sum(1 if m>0 else -1 for m in margins),sum(margins),len(sets)))
        labels[day].append((row['match_id'],outcomes(sets,score)))
    rows = build_features(matches,rules)
    for r,(day,(key,target)) in zip(rows,((day,item) for day in sorted(labels) for item in labels[day]),strict=True):
        if r['day'] != day or r['scoreClass'] != target[-1]:
            raise ValueError('Misaligned WTT fixture')
        r.update(league=filename,id=key,target=target)
    counts['acceptedBO5'] = len(rows)
    return rows,counts


def external_test(plan, model_plan, bench, prematch):
    data = load(plan['externalArchive'])
    setka = prematch.load_module('setka','benchmark-setka-2022.py')
    lag = plan['externalHistoryLagCalendarDays']
    boundaries = [date.fromisoformat(plan[k]).toordinal() for k in (
        'externalTrainBefore','externalCalibrationBefore','externalSelectionBefore','externalTestBefore')]
    result = {}
    for filename,sha in data['inputs'].items():
        rows,counts = wtt_samples(filename,sha,{'historyLagCalendarDays':lag,'eloK':data['eloK']},
                                  setka.build_features,bench.target_outcomes)
        supported = [r for r in rows if r['x'][-1] >= plan['externalMinimumPlayerHistory']]
        train,cal,choose,test = [[r for r in supported if start <= r['day'] < end-lag]
                                for start,end in zip([0,*boundaries],boundaries)]
        predictions,selected,_ = bench.pooled_models(model_plan,train,cal,choose,test)
        _,truth = bench.matrix(test)
        markets = {}
        for j,target in enumerate(model_plan['targets']):
            markets[target] = {
                name:categorical_metrics(p,truth[:,j]) if target=='exact-score' else metrics(truth[:,j],p)
                for name,p in predictions[target].items()
            }
        result[filename] = {'counts':counts,'supportedHistory':len(supported),'training':len(train),'calibration':len(cal),
                            'selection':len(choose),'test':len(test),'selected':selected,'markets':markets}
    return result


def market_selection(q, match):
    """Return the v33 target and whether the price describes the target outcome."""
    key = (q.get('group_id'),q.get('market_id'))
    side,period = q.get('side'),q.get('period')
    line,handicap = q.get('line'),q.get('handicap')
    if period=='1' and key in {('920096','920096'),('238','920055')} and not handicap and line in (None,'','To Win'):
        if side in (match['home'],match['away']):
            return 'first-set',side==match['home']
        return None
    try:
        amount = float(handicap if handicap else line)
    except (TypeError,ValueError):
        return None
    if line and line not in ('Total','Line'):
        try:
            if float(line)!=amount:return None
        except ValueError:
            return None
    if side in ('Over','Under'):
        if period=='1' and key in {('238','920056'),('920096','920111')} and amount==19.5:
            return 'first-set-points-over-19.5',side=='Over'
        if not period and key in {('240','920066'),('920000','920014')} and amount in (74.5,79.5,84.5):
            return f'points-over-{amount}',side=='Over'
        if not period and q.get('group_name') in ('Total Sets','Total Games') and amount in (3.5,4.5):
            return f'sets-over-{amount}',side=='Over'
        return None
    if period or side not in (match['home'],match['away']):
        return None
    home = side==match['home']
    amount = amount if home else -amount
    signed = f'{"plus" if amount>0 else "minus"}-{abs(amount)}'
    if abs(amount)==1.5 and key in {('240','920065'),('920000','920008')}:
        return f'home-set-handicap-{signed}',home
    if abs(amount) in (5.5,9.5) and key in {('240','920134'),('920009','920009')}:
        return f'home-point-handicap-{signed}',home
    return None


def exact_pairs(payload, match, day, plan, inventory):
    at = inventory.strict_start(payload,match)
    if at is None or payload.get('pre_close_basis')!='kickoff':
        return {}
    if datetime.fromtimestamp(at/1000,timezone.utc).date().toordinal()!=day:
        return {}
    results = defaultdict(list)
    keys = ('group_id','market_id','period','market_key')
    for q in payload['selections']:
        price = q.get('pre_close')
        picked = market_selection(q,match)
        if not picked or not isinstance(price,dict) or market_selection(price,match)!=picked:
            continue
        ts = inventory.stamp(price.get('ts'))
        odds = price.get('odds_dec')
        if (tuple(q.get(k) for k in keys)!=tuple(price.get(k) for k in keys)
                or q.get('side')!=price.get('side') or q.get('line')!=price.get('line')
                or price.get('suspended') is not False or not isinstance(odds,(int,float)) or not np.isfinite(odds) or odds<=1
                or ts is None or not 0<=at-ts<=plan['maximumQuoteAgeSeconds']*1000):
            continue
        target,outcome=picked
        results[(target,*(q.get(k) for k in keys))].append((outcome,odds))
    candidates=defaultdict(list)
    for (target,*_),prices in results.items():
        if len(prices)==2 and {yes for yes,_ in prices}=={True,False}:
            q=dict(prices)
            candidates[target].append((q[True],q[False]))
    return {target:values[0] for target,values in candidates.items() if len(values)==1}


def quote_audit(plan, model_plan, bench, prematch):
    if plan['minimumQuoteLeadSeconds']!=60 or plan['maximumOutcomeDelayHours']!=6:
        raise ValueError('Protocol must match the existing verified-start rule')
    partition,rows,older,_,_,archive_path=bench.load_rows(model_plan,prematch)
    inventory=prematch.load_module('inventory','inventory-data-v16.py')
    raw={r['id']:r for r in json.loads(archive_path.read_text())}
    first,last=[date.fromisoformat(partition['testBoundariesUtc'][i]).toordinal() for i in (0,-1)]
    rules=['3000-data.json.cache','market-v8-confirmation','market-v8-extension']
    pairs={}
    totals=Counter()
    for r in rows:
        if not first<=r['day']<last:
            continue
        totals['matches']+=1
        path=next((DATA/folder/(r['id']+'.json') for folder in rules if (DATA/folder/(r['id']+'.json')).is_file()),None)
        if path is None:
            continue
        totals['cached']+=1
        prices=exact_pairs(json.loads(path.read_text()),raw[r['id']],r['day'],plan,inventory)
        if prices:
            totals['withExactPairs']+=1
            pairs[r['id']]=prices
    print('Exact prices:',dict(totals),flush=True)
    matched=defaultdict(list)
    original=load('report-secondary-markets-v33.json')['folds']
    for position,(fold,test,predictions) in enumerate(bench.replay(model_plan,partition,rows,older)):
        if fold!=original[position]:
            raise ValueError('The archived Model v33 selection did not reproduce')
        for i,r in enumerate(test):
            for target,(a,b) in pairs.get(r['id'],{}).items():
                j=model_plan['targets'].index(target)
                matched[target].append({'p':float(predictions[target]['chosen-on-prior-day'][i]),'y':r['target'][j],
                                        'homeOdds':a,'awayOdds':b,'day':r['day']})
    if {target:sum(target in v for v in pairs.values()) for target in matched} != {target:len(v) for target,v in matched.items()}:
        raise ValueError('A matched price was not scored')
    with_prices={}
    for target,items in matched.items():
        truth=[r['y'] for r in items]
        probability=[r['awayOdds']/(r['homeOdds']+r['awayOdds']) for r in items]
        above_two = [r for r in items if (r['p']>.5 and r['homeOdds']>2) or (r['p']<.5 and r['awayOdds']>2)]
        with_prices[target]={'pairs':len(items),'days':len({r['day'] for r in items}),
                             'bookmakerNoVig':metrics(truth,probability),
                             'v33PriorSelection':metrics(truth,[r['p'] for r in items]),
                             'chosenAboveTwo':summarize(above_two),
                             'chosenPositiveEv':summarize(items,minimum=plan['minimumMarketPrice'],positive_ev=True)}
    return {'coverage':totals,'perTarget':with_prices,'executabilityVerified':False,'verifiedRoi':None}


def main():
    plan=load('protocol-market-robustness-v34.json')
    model_plan=load(plan['modelProtocol'])
    bench=module('benchmark-secondary-markets.py')
    prematch=module('benchmark-prematch-10000.py')
    quoted=quote_audit(plan,model_plan,bench,prematch)
    external=external_test(plan,model_plan,bench,prematch)
    for file,result in external.items():
        print(file,result['test'],flush=True)
    report={'protocol':plan,'quoteAudit':quoted,'external':external,
            'retrospective':True,'operationallyValidated':False}
    with (RESEARCH/'report-market-robustness-v34.json').open('x') as handle:
        json.dump(report,handle,indent=2,allow_nan=False)
        handle.write('\n')


if __name__=='__main__':
    main()

"""Expand live winner training with verified set sequences from two archives."""
import hashlib
import importlib.util
import json
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path

import joblib

from coherent_score_model import score_class

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('live_replay', Path(__file__).with_name('benchmark-live-setka.py'))
replay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(replay)


def load_moviodds(path, protocol):
    archive = json.loads(path.read_text())
    occurrences = Counter(r['id'] for r in archive)
    counts = Counter(raw=len(archive))
    accepted = defaultdict(list)
    for match in sorted(archive, key=lambda r: (r['finishedAt'], r['id'])):
        if match['league'] not in protocol['leagues']:
            counts['outsideLeagues'] += 1
            continue
        try:
            if occurrences[match['id']] != 1:
                raise ValueError('Duplicate fixture')
            finished = datetime.fromisoformat(match['finishedAt'])
            available = datetime.fromisoformat(match['availableAt'])
            if available < finished or (available.date()-finished.date()).days > 1:
                raise ValueError('Availability cannot be guarded by the date lag')
            won = int(score_class(match['sets']) < 3)
            if won != match['homeWon']:
                raise ValueError('Winner disagrees with sets')
            players = tuple(' '.join(match[side].casefold().split()) for side in ('home','away'))
            if not all(players) or players[0] == players[1]:
                raise ValueError('Invalid participants')
        except (KeyError, TypeError, ValueError):
            counts['invalid'] += 1
            continue
        margins = [a-b for a,b in match['sets']]
        sequence = tuple(int(gap>0) for gap in margins)
        day = finished.date().toordinal()
        eligible_row = (players, won, 2*sum(sequence)-len(sequence), sum(margins), len(sequence))
        accepted[match['league']].append((day, eligible_row, sequence))
        counts['valid'] += 1
    return accepted, counts


def states_by_block(rows, sequences, choose_block, groups):
    if len(rows) != len(sequences):
        raise ValueError('Unaligned fixture histories')
    for row, sets in zip(rows, sequences):
        label = row['y'][0]
        if len(sets) != row['scoreClass']%3+3 or int(sum(sets)==3) != label:
            raise ValueError('Unaligned score history')
        block = choose_block(row['day'])
        if block:
            for stage,state in enumerate(replay.live_states(sets)):
                groups[stage][block].append((row['x'],state,label,row['day']))


def main():
    research = ROOT/'research'
    protocol = json.loads((research/'protocol-live-expanded-v29.json').read_text())
    rules = json.loads((research/protocol['modelProtocol']).read_text())
    setka_protocol = json.loads((research/rules['archive']).read_text())
    paths = [ROOT/'.research-data'/name for name in ('forward-v3.json.archive.json','setka-september-2022.csv')]
    for path, expected in zip(paths, (protocol['movioddsSha256'], setka_protocol['sha256'])):
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('Dataset hash mismatch')
    accepted, counts = load_moviodds(paths[0], protocol)
    cutoff = lambda key: date.fromisoformat(protocol[key]).toordinal()
    def split(day):
        if day <= cutoff('trainingThrough'):
            return 'train'
        if cutoff('calibrationFrom') <= day <= cutoff('calibrationThrough'):
            return 'cal'
        if cutoff('testFrom') <= day <= cutoff('testThrough'):
            return 'test'
        return None

    groups = defaultdict(lambda: defaultdict(list))
    by_league = {}
    for league, matches in sorted(accepted.items()):
        daily = defaultdict(list)
        for day, history, _ in matches:
            daily[day].append(history)
        rows = replay.setka.build_features(daily, protocol)
        by_league[league] = Counter((split(row['day']) or 'historyOnly') for row in rows)
        states_by_block(rows, [seq for _,_,seq in matches], split, groups)

    histories = defaultdict(list)
    setka, setka_counts = replay.setka.read_matches(paths[1], set_history=histories)
    extra = defaultdict(lambda: defaultdict(list))
    states_by_block(replay.setka.build_features(setka, setka_protocol),
                    [seq for day in sorted(histories) for seq in histories[day]], lambda _: 'train', extra)
    pooled = {stage:{**blocks, 'train':extra[stage]['train']+blocks['train']} for stage,blocks in groups.items()}
    reports, artifacts = {}, {}
    for name, sample in [('movioddsOnly',groups),('combined',pooled)]:
        reports[name], artifacts[name] = replay.fit_stages(sample, rules)
    artifact_path = ROOT/'.research-data/live-expanded-v29.joblib'
    with artifact_path.open('xb') as fh:
        artifact_path.chmod(0o600)
        joblib.dump({'models':artifacts,'protocol':protocol,'rules':rules}, fh)
    report = {'protocol':protocol, 'movioddsCounts':counts, 'setkaCounts':setka_counts,
              'byLeague':by_league, 'results':reports,
              'artifactSha256':hashlib.sha256(artifact_path.read_bytes()).hexdigest(),
              'liveOddsAvailable':False, 'operationallyValidated':False}
    with (research/'report-live-expanded-v29.json').open('x') as fh:
        json.dump(report, fh, indent=2, allow_nan=False)
        fh.write('\n')


if __name__ == '__main__':
    main()

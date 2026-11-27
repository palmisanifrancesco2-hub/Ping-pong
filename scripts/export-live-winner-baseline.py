"""Export the tested v29 score-only model without event or player data."""
import hashlib
import json
from pathlib import Path

import joblib

root = Path(__file__).resolve().parents[1]
report = json.loads((root / 'research/report-live-expanded-v29.json').read_text())
path = root / '.research-data/live-expanded-v29.joblib'
if hashlib.sha256(path.read_bytes()).hexdigest() != report['artifactSha256']:
    raise ValueError('Unexpected v29 model artifact')

source = joblib.load(path)
stages = source['models']['combined']
artifact = {
    'version': 'live-score-only-v29',
    'leagues': report['protocol']['leagues'],
    'probabilities': {
        f'{home}-{away}': float(probability)
        for stage, fit in stages.items() if stage > 0
        for (home, away), probability in fit['scoreOnly'].items()
    },
}
print(json.dumps(artifact, indent=2, allow_nan=False))

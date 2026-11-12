"""Helpers for nested chronological experiments. No runtime/production imports."""
import numpy as np

DAY=86400000


def nested_split(rows,start,end,protocol):
    calibration_start=start-protocol['calibrationDays']*DAY
    tuning_start=calibration_start-protocol['tuningDays']*DAY
    train=[r for r in rows if r['at']<tuning_start and r['available']<tuning_start]
    tune=[r for r in rows if tuning_start<=r['at']<calibration_start and r['available']<calibration_start]
    refit=[r for r in rows if r['at']<calibration_start and r['available']<calibration_start]
    cal=[r for r in rows if calibration_start<=r['at']<start and r['available']<start]
    # A label may settle after an intermediate fold ends. Its prediction still
    # belongs to that fold; the caller applies the final evaluation snapshot.
    test=[r for r in rows if start<=r['at']<end]
    return train,tune,refit,cal,test


def choose_shrink(raw,baseline,y,weights):
    raw=np.asarray(raw);baseline=np.asarray(baseline);y=np.asarray(y)
    if raw.shape!=baseline.shape or raw.shape!=y.shape or not len(y):raise ValueError('Invalid calibration shapes')
    if not all(np.isfinite(a).all() for a in [raw,baseline,y]):raise ValueError('Nonfinite calibration')
    loss=np.asarray([np.mean((baseline+w*(raw-baseline)-y)**2,axis=0) for w in weights])
    return np.asarray(weights)[np.argmin(loss,axis=0)]


def metrics(y,p):
    y=np.asarray(y);p=np.asarray(p)
    if y.shape!=p.shape or p.ndim!=1 or not len(y) or not np.isfinite(p).all() or np.any((p<0)|(p>1)) or np.any((y!=0)&(y!=1)):raise ValueError('Invalid scoring input')
    clipped=np.clip(p,1e-9,1-1e-9);correct=int(np.sum(((p>.5)==y)&(p!=.5)));undecided=int(np.sum(p==.5));bins=[]
    indices=np.minimum(9,(p*10).astype(int))
    for i in range(10):
        mask=indices==i
        if mask.any():bins.append({'from':i/10,'to':(i+1)/10,'n':int(mask.sum()),'probability':float(p[mask].mean()),'frequency':float(y[mask].mean())})
    return {'n':len(y),'correct':correct,'wrong':len(y)-correct-undecided,'undecided':undecided,'accuracy':correct/(len(y)-undecided) if len(y)>undecided else None,'coverage':1-undecided/len(y),'brier':float(np.mean((p-y)**2)),'logLoss':float(-np.mean(y*np.log(clipped)+(1-y)*np.log(1-clipped))),'ece':float(sum(b['n']*abs(b['probability']-b['frequency']) for b in bins)/len(y)),'calibration':bins}

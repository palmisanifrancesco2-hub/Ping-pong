"""Fixed pooling and diversity diagnostics. No fitted weights or outcome filtering."""
import numpy as np


def aligned_indices(ids, other_ids):
    if len(ids)!=len(set(ids)) or len(other_ids)!=len(set(other_ids)):
        raise ValueError('Duplicate event IDs')
    if set(ids)!=set(other_ids):raise ValueError('Different event sets')
    index={key:i for i,key in enumerate(other_ids)}
    return [index[key] for key in ids]


def linear_pool(components,weights):
    arrays=[np.asarray(a,dtype=float) for a in components]
    w=np.asarray(weights,dtype=float)
    if not arrays or len(w)!=len(arrays) or not np.all(np.isfinite(w)) or np.any(w<0) or not np.isclose(w.sum(),1,atol=1e-12,rtol=0):
        raise ValueError('Invalid mixture weights')
    if any(a.shape!=arrays[0].shape or a.ndim!=1 or not len(a) or not np.all(np.isfinite(a)) or np.any((a<0)|(a>1)) for a in arrays):
        raise ValueError('Invalid/misaligned probabilities')
    return np.sum(np.stack(arrays)*w[:,None],axis=0)


def correlation(a,b):
    if np.std(a)<1e-12 or np.std(b)<1e-12:return None
    return float(np.corrcoef(a,b)[0,1])


def paired_interval(rows,loss,protocol):
    days=np.asarray([r['at'] for r in rows],dtype=np.int64)//86400000
    days-=days.min();span=int(days.max())+1
    sums=np.bincount(days,weights=loss,minlength=span);counts=np.bincount(days,minlength=span)
    observed=int((counts>0).sum())
    if observed<7:return {'lower':None,'upper':None,'days':observed}
    block=protocol['blockDays'];bs=np.convolve(sums,np.ones(block),'valid');bn=np.convolve(counts,np.ones(block),'valid')
    rng=np.random.default_rng(protocol['seed'])
    chosen=rng.integers(0,len(bs),size=(protocol['bootstrapReplicates'],int(np.ceil(span/block))))
    n=bn[chosen].sum(axis=1);values=bs[chosen].sum(axis=1)[n>0]/n[n>0]
    alpha=.05/protocol['familyComparisons'];lo,hi=np.quantile(values,[alpha/2,1-alpha/2])
    return {'lower':float(lo),'upper':float(hi),'days':observed,'blockDays':block,'familyComparisons':protocol['familyComparisons']}


def diversity(y,components):
    y=np.asarray(y,dtype=int);arrays=[np.asarray(a,dtype=float) for a in components]
    linear_pool(arrays,[1/len(arrays)]*len(arrays))
    if y.shape!=arrays[0].shape or np.any((y!=0)&(y!=1)):raise ValueError('Invalid outcomes')
    agreement=np.logical_and.reduce([(a>.5)==(arrays[0]>.5) for a in arrays])
    agreement &= np.logical_and.reduce([a!=.5 for a in arrays])
    pairs=[]
    for i in range(len(arrays)):
        for j in range(i+1,len(arrays)):
            # Ties are undecided, never converted into a winning selection.
            mi=(arrays[i]>.5)!=y;mj=(arrays[j]>.5)!=y;decided=(arrays[i]!=.5)&(arrays[j]!=.5)
            pairs.append({'a':i,'b':j,'residualCorrelation':correlation(arrays[i]-y,arrays[j]-y),
                          'mistakeCorrelation':correlation(mi[decided].astype(float),mj[decided].astype(float)) if decided.any() else None})
    n=int(agreement.sum());correct=int(np.sum(((arrays[0]>.5)==y)&agreement))
    return {'pairs':pairs,'agreement':{'n':n,'coverage':n/len(y),'correct':correct,'wrong':n-correct,
                                      'accuracy':correct/n if n else None,'descriptiveOnly':True}}

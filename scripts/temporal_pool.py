"""Causal weight/temperature fitting on previous out-of-sample forecasts only."""
import numpy as np
from scipy.special import expit,logit
from scipy.optimize import minimize


def calibration_rows(rows,start):
    return [r for r in rows if r['at']<start and r['available']<start]


def predict(rows,weight,temperature):
    if not 0<=weight<=1 or not .5<=temperature<=1.5:raise ValueError('Invalid pooling parameters')
    a=np.asarray([r['full'] for r in rows]);b=np.asarray([r['projection'] for r in rows])
    if not np.all(np.isfinite(a)) or not np.all(np.isfinite(b)) or np.any((a<0)|(a>1)|(b<0)|(b>1)):raise ValueError('Invalid probabilities')
    return expit(temperature*logit(np.clip((1-weight)*a+weight*b,1e-9,1-1e-9)))


def fit(rows,kind,ridge=.001):
    if not rows:raise ValueError('Empty calibration set')
    if kind not in ['learned-weight','learned-weight-temperature']:raise ValueError('Unknown candidate')
    y=np.asarray([r['y'] for r in rows],dtype=float)
    if np.any((y!=0)&(y!=1)):raise ValueError('Invalid outcomes')
    joint=kind=='learned-weight-temperature'
    a=np.asarray([r['full'] for r in rows]);b=np.asarray([r['projection'] for r in rows])
    predict(rows,.5,1)
    def objective(params):
        w=params[0];t=params[1] if joint else 1
        raw=(1-w)*a+w*b;p=np.clip(raw,1e-9,1-1e-9);z=logit(p);s=expit(t*z)
        scale=2*(s-y)*s*(1-s)
        active=(raw>1e-9)&(raw<1-1e-9)
        dw=np.mean(scale*t*(b-a)*active/(p*(1-p)))+2*ridge*(w-.5)
        dt=np.mean(scale*z)+2*ridge*(t-1)
        value=float(np.mean((s-y)**2)+ridge*((w-.5)**2+(t-1)**2))
        return value,np.asarray([dw,dt] if joint else [dw])
    result=minimize(objective,[.5,1] if joint else [.5],jac=True,method='L-BFGS-B',bounds=[(0,1)]+([(.5,1.5)] if joint else []),options={'maxiter':1000,'ftol':1e-12,'gtol':1e-8})
    if not result.success or not np.isfinite(result.fun):raise RuntimeError('Pooling optimization failed')
    return {'weight':float(result.x[0]),'temperature':float(result.x[1]) if joint else 1,'objective':float(result.fun)}

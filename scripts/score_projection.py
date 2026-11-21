"""Coherent stopped-score marginals. No random draws or invented outcomes."""
from math import comb
import numpy as np
from scipy.special import expit, betaln, digamma
from scipy.linalg import eigh_tridiagonal
from scipy.optimize import minimize

TARGETS=['winner','first-set','first-set-points-over-19.5','sets-over-3.5','sets-over-4.5',
         'points-over-74.5','points-over-79.5','points-over-84.5',
         'home-set-handicap-minus-1.5','home-set-handicap-plus-1.5',
         'home-point-handicap-minus-5.5','home-point-handicap-plus-5.5',
         'home-point-handicap-minus-9.5','home-point-handicap-plus-9.5']


def saturated_convolve(a,b,cap):
    full=np.convolve(a,b)
    result=np.zeros(cap+1)
    result[:min(cap,len(full))]=full[:cap]
    result[cap]=full[cap:].sum()
    return result


def set_kernels(p,cap=86):
    if not np.isfinite(p) or not 0<=p<=1 or cap<22:raise ValueError('Invalid point probability/cap')
    q=1-p;wt=np.zeros(cap+1);lt=np.zeros(cap+1);wd=np.zeros(23);ld=np.zeros(23)
    for loser in range(10):
        c=comb(10+loser,loser)
        w=c*p**11*q**loser;l=c*q**11*p**loser
        wt[min(11+loser,cap)]+=w;lt[min(11+loser,cap)]+=l
        wd[11+11-loser]+=w;ld[11-11+loser]+=l
    reach=comb(20,10)*p**10*q**10
    ratio=2*p*q;den=p*p+q*q
    # The complete infinite tail has margin +/-2 irrespective of deuce length.
    wd[13]+=reach*p*p/den;ld[9]+=reach*q*q/den
    j=0
    while 22+2*j<cap:
        wt[22+2*j]+=reach*ratio**j*p*p
        lt[22+2*j]+=reach*ratio**j*q*q
        j+=1
    # Censor all larger totals into a true overflow bin, not a discarded tail.
    wt[cap]+=reach*ratio**j*p*p/den
    lt[cap]+=reach*ratio**j*q*q/den
    return wt,lt,wd,ld


def project_point_probability(p,cap=86):
    if cap<86:raise ValueError('Cap must preserve every declared threshold')
    wt,lt,wd,ld=set_kernels(p,cap)
    tw=[np.eye(1,cap+1,0)[0],wt];tl=[tw[0].copy(),lt]
    dw=[np.array([1.]),wd];dl=[np.array([1.]),ld]
    for _ in range(2,4):
        tw.append(saturated_convolve(tw[-1],wt,cap));tl.append(saturated_convolve(tl[-1],lt,cap))
        dw.append(np.convolve(dw[-1],wd));dl.append(np.convolve(dl[-1],ld))
    totals=np.zeros(cap+1);margins=np.zeros(111);endings=[]
    for lost in range(3):
        n=3+lost;factor=comb(2+lost,lost)
        for home,away in [(3,lost),(lost,3)]:
            t=factor*saturated_convolve(tw[home],tl[away],cap)
            d=factor*np.convolve(dw[home],dl[away])
            totals+=t;offset=55-11*n;margins[offset:offset+len(d)]+=d
            endings.append((home,away,float(t.sum())))
    if abs(totals.sum()-1)>1e-10 or abs(margins.sum()-1)>1e-10:raise ArithmeticError('Projection mass lost')
    y=[sum(m for a,b,m in endings if a>b),float(wt.sum()),float(wt[20:].sum()+lt[20:].sum()),
       sum(m for a,b,m in endings if a+b>3.5),sum(m for a,b,m in endings if a+b>4.5),
       float(totals[75:].sum()),float(totals[80:].sum()),float(totals[85:].sum()),
       sum(m for a,b,m in endings if a-b>1.5),sum(m for a,b,m in endings if a-b>-1.5),
       float(margins[61:].sum()),float(margins[50:].sum()),float(margins[65:].sum()),float(margins[46:].sum())]
    return np.clip(y,0,1)


def projection_grid(intervals=4096):
    grid=np.linspace(0,1,intervals+1)
    return grid,np.asarray([project_point_probability(float(p)) for p in grid])


def fit_point_model(rows,kind,regularization=1,kappa_bounds=(20,5000),initial_kappa=200,max_iter=1000):
    x=np.asarray([r['x'][:8] for r in rows]);a=np.asarray([r['pointsFor'] for r in rows]);b=np.asarray([r['pointsAgainst'] for r in rows]);total=a+b
    if not len(rows) or np.any(total<=0):raise ValueError('Empty/invalid training data')
    beta_binomial=kind=='rally-beta-binomial'
    initial=np.zeros(9 if beta_binomial else 8)
    if beta_binomial:initial[-1]=np.log(initial_kappa)
    def loss(params):
        theta=params[:8];eta=x@theta;m=np.clip(expit(eta),1e-9,1-1e-9)
        if beta_binomial:
            k=np.exp(params[-1]);alpha=k*m;beta=k*(1-m)
            ll=betaln(alpha+a,beta+b)-betaln(alpha,beta)
            da=digamma(alpha+a)-digamma(k+total)-digamma(alpha)+digamma(k)
            db=digamma(beta+b)-digamma(k+total)-digamma(beta)+digamma(k)
            de=k*m*(1-m)*(da-db)
            grad=np.r_[-x.T@de/len(rows)+regularization*theta,-np.mean(k*(m*da+(1-m)*db))]
        else:
            ll=a*(-np.logaddexp(0,-eta))+b*(-np.logaddexp(0,eta))
            grad=x.T@(total*m-a)/len(rows)+regularization*theta
        value=-ll.mean()+regularization*np.dot(theta,theta)/2
        return float(value),grad
    bounds=[(-3,3)]*8+([(np.log(kappa_bounds[0]),np.log(kappa_bounds[1]))] if beta_binomial else [])
    result=minimize(loss,initial,jac=True,method='L-BFGS-B',bounds=bounds,options={'maxiter':max_iter,'ftol':1e-11,'gtol':1e-7})
    if not np.isfinite(result.fun) or not np.all(np.isfinite(result.x)):raise ArithmeticError('Nonfinite point model')
    return {'kind':kind,'weights':result.x[:8].tolist(),'kappa':float(np.exp(result.x[-1])) if beta_binomial else None,'success':bool(result.success),'objective':float(result.fun),'message':str(result.message)}


def projection_predict(model,rows,grid,table,temperature=1,nodes=21):
    x=np.asarray([r['x'][:8] for r in rows]);means=expit((x@np.asarray(model['weights']))*temperature)
    def interpolate(p):return np.asarray([np.interp(p,grid,table[:,j]) for j in range(len(TARGETS))]).T
    if model['kappa'] is None:return interpolate(means)
    result=[]
    for m in means:
        z,w=beta_quadrature(float(m),model['kappa'],nodes)
        result.append((interpolate(z)*w[:,None]).sum(axis=0))
    return np.clip(result,0,1)


def beta_quadrature(mean,kappa,nodes=21):
    """Normalized Gauss-Jacobi via Golub-Welsch; avoids overflowing Beta weights."""
    if not 0<mean<1 or kappa<20 or nodes<2:raise ValueError('Invalid beta quadrature')
    a=kappa*(1-mean)-1;b=kappa*mean-1;s=a+b
    n=np.arange(nodes,dtype=float)
    diagonal=(b*b-a*a)/((2*n+s)*(2*n+s+2))
    n=np.arange(1,nodes,dtype=float)
    off=2/(2*n+s)*np.sqrt(n*(n+a)*(n+b)*(n+s)/((2*n+s-1)*(2*n+s+1)))
    z,v=eigh_tridiagonal(diagonal,off)
    weights=v[0]**2;weights/=weights.sum()
    if not np.all(np.isfinite(weights)) or np.any(weights<0):raise ArithmeticError('Quadrature weights invalid')
    return np.clip((z+1)/2,0,1),weights

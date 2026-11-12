import {useMemo,useState} from 'react';
import {coherentMatchMarkets,exactSetScoreProbability,pointHandicap,setHandicap,totalPointsLine,totalSetsLine} from './domain/coherent-markets';
type Outcome={over:number;under:number;push:number};
const percent=(n:number)=>new Intl.NumberFormat('it-IT',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
const show=(n:number)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:2}).format(n);
function Choice({title,result,labels=['Over','Under']}:{title:string;result:Outcome;labels?:[string,string]}){
 return <div className="sim-choice"><h3>{title}</h3><div className="sim-line"><span>{labels[0]} <strong>{percent(result.over)}</strong></span><span>{labels[1]} <strong>{percent(result.under)}</strong></span></div><div className="sim-bar"><span style={{width:percent(result.over)}}/></div>{result.push>0.00001&&<small>Rimborso {percent(result.push)}</small>}</div>;
}
function LineInput({title,value,set,min=0,max=255,step=.5}:{title:string;value:number;set:(n:number)=>void;min?:number;max?:number;step?:number}){
 return <label className="sim-input">{title}<input type="number" min={min} max={max} step={step} value={value} onChange={e=>{if(e.target.value.trim()){const v=Number(e.target.value);if(Number.isFinite(v))set(Math.max(min,Math.min(max,v)));}}}/></label>;
}
export function MarketSimulator(){
 const[p,setP]=useState(53);
 const[best,setBest]=useState<5|7>(5);
 const[totalSetLine,setTotalSetLine]=useState(3.5);
 const[totalPointLine,setTotalPointLine]=useState(79.5);
 const[firstSetLine,setFirstSetLine]=useState(19.5);
 const[handicapSet,setHandicapSet]=useState(-1.5);
 const[handicapPoint,setHandicapPoint]=useState(-5.5);
 const[odds,setOdds]=useState(1.85);
 const r=useMemo(()=>coherentMatchMarkets(p/100,{bestOf:best,pointsToWin:11,winBy:2},256),[p,best]);
 return <div className="sim-container">
  <section className="panel"><span className="eyebrow">SIMULATORE MATEMATICO · SOLO RICERCA</span><h2>Vincente, set, punti e handicap</h2><p>Un unico modello di punti e set calcola probabilità coerenti per tutti i mercati, applicando il regolamento della partita.</p><div className="banner"><strong>Non è una previsione sportiva:</strong> la probabilità di vincere un singolo punto è scelta da te, non stimata dalle statistiche dei giocatori. Nessun risultato qui è validato per le scommesse.</div></section>
  <section className="panel"><h2>Imposta lo scenario</h2><div className="sim-range"><label htmlFor="point-prob">Probabilità che A vinca un punto</label><strong>{show(p)}%</strong></div><input id="point-prob" type="range" min="35" max="65" step=".5" value={p} onChange={e=>setP(Number(e.target.value))}/><p className="fine">Il 53% iniziale è illustrativo: modificalo per osservare le differenze.</p>
   <label className="sim-input">Formato match<select value={best} onChange={e=>setBest(Number(e.target.value)===7?7:5)}><option value="5">Al meglio di 5 set</option><option value="7">Al meglio di 7 set</option></select></label>
   <div className="sim-fields">
    <LineInput title="Linea set totali" value={totalSetLine} set={setTotalSetLine} max={best}/>
    <LineInput title="Linea punti totali" value={totalPointLine} set={setTotalPointLine}/>
    <LineInput title="Linea punti 1° set" value={firstSetLine} set={setFirstSetLine}/>
    <LineInput title="Handicap set A" value={handicapSet} set={setHandicapSet} min={-7} max={7}/>
    <LineInput title="Handicap punti A" value={handicapPoint} set={setHandicapPoint} min={-100} max={100}/>
    <LineInput title="Quota ipotetica A" value={odds} set={setOdds} min={1.01} max={100} step={.01}/>
   </div>
  </section>
  <div className="sim-summary">{[['Vittoria A',percent(r.winner.home)],['Vittoria B',percent(r.winner.away)],['Primo set A',percent(r.setHomeProbability)],['Punti attesi match',show(r.expectedMatchPoints)]].map(([label,value])=><article className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>Scenario matematico</small></article>)}</div>
  <div className="sim-grid">
   <Choice title={`Totale set · ${show(totalSetLine)}`} result={totalSetsLine(r,totalSetLine)}/>
   <Choice title={`Totale punti · ${show(totalPointLine)}`} result={totalPointsLine(r.matchPoints,totalPointLine)}/>
   <Choice title={`Punti primo set · ${show(firstSetLine)}`} result={totalPointsLine(r.setPoints,firstSetLine)}/>
   <Choice title={`Handicap set A · ${show(handicapSet)}`} result={setHandicap(r,'home',handicapSet)} labels={['Coperto','Non coperto']}/>
   <Choice title={`Handicap punti A · ${show(handicapPoint)}`} result={pointHandicap(r.pointMargin,'home',handicapPoint)} labels={['Coperto','Non coperto']}/>
   <div className="sim-choice"><h3>Quote e valore teorici</h3><p>Quota equa A: <strong>{show(1/r.winner.home)}</strong></p><p>EV con quota ipotetica {show(odds)}: <strong>{r.winner.home*odds-1>=0?'+':''}{show(100*(r.winner.home*odds-1))}%</strong></p><small>Solo esercizio matematico: non considera errore predittivo, commissioni o imposte.</small></div>
  </div>
  <section className="panel"><h2>Risultato esatto</h2><div className="sim-scores">{r.exactMatchScores.map(s=><div className="sim-score" key={`${s.home}-${s.away}`}><span>{s.home} – {s.away}</span><div className="sim-bar"><span style={{width:percent(s.probability)}}/></div><strong>{percent(s.probability)}</strong></div>)}</div>
   <details className="sim-more"><summary>Altre probabilità</summary><p>A vince 3/4 set senza perderne uno: {percent(r.sweep.home)}</p><p>A rimonta dopo aver perso il primo set: {percent(r.comeback.probability)}</p><p>Primo set 11–8 per A: {percent(exactSetScoreProbability(r,11,8))}</p></details>
  </section><p className="fine">Assunzioni: punti indipendenti, probabilità costante, nessuna informazione su servizio, fatica, forma o punteggio live. Le probabilità non vengono salvate né associate a eventi reali.</p>
 </div>;
}

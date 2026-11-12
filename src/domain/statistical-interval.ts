/** Descriptive binomial interval. Repeated opponents violate independence. */
export function wilsonInterval(wins:number,total:number){
 if(!Number.isInteger(total)||!Number.isInteger(wins)||total<=0||wins<0||wins>total)return null;
 const z=1.96,p=wins/total,den=1+z*z/total,center=(p+z*z/(2*total))/den;
 const half=z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/den;
 return{lower:Math.max(0,center-half),upper:Math.min(1,center+half)};
}

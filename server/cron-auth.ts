import{timingSafeEqual}from'node:crypto';
export function authorizedStudyCron(header:string|undefined,secret:string|undefined){if(!secret||secret.length<32||!header)return false;const a=Buffer.from(header),b=Buffer.from(`Bearer ${secret}`);return a.length===b.length&&timingSafeEqual(a,b);}

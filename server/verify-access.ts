import { randomUUID } from 'node:crypto';
import type { Database } from './migrations.js';
export async function verifyPrivateAccess(db: Database, ownerEmail: string | undefined) {
  if (!ownerEmail?.trim()) throw new Error('DB_OWNER_NOT_CONFIGURED');
  await db.query('begin read only');
  try {
    await db.query("set local statement_timeout = '10s'");
    const rows = await db.query(`select u.id, u.email_confirmed_at is not null as email_verified,
      exists(select 1 from public.authorized_users a where a.user_id=u.id) as member
      from auth.users u where lower(trim(u.email))=$1`,[ownerEmail.trim().toLowerCase()]);
    if (rows.rows.length !== 1) throw new Error('DB_OWNER_NOT_FOUND_OR_AMBIGUOUS');
    const owner = rows.rows[0];
    if (owner.email_verified !== true) throw new Error('DB_OWNER_EMAIL_UNCONFIRMED');
    if (owner.member !== true) throw new Error('DB_OWNER_NOT_AUTHORIZED');
    const anonymous = await db.query(`select
      has_table_privilege('anon','public.profiles','select') as can_read_profiles,
      has_function_privilege('anon','public.is_authorized_user()','execute') as can_call_membership`);
    if (anonymous.rows[0].can_read_profiles !== false || anonymous.rows[0].can_call_membership !== false) throw new Error('DB_ANONYMOUS_ACCESS');
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner.id]);
    const membership = await db.query('select public.is_authorized_user() as member');
    const profiles = await db.query('select user_id from public.profiles');
    if (membership.rows[0].member !== true || profiles.rows.length !== 1 || profiles.rows[0].user_id !== owner.id) throw new Error('DB_OWNER_RLS');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[randomUUID()]);
    const outsider = await db.query('select public.is_authorized_user() as member');
    const outsiderProfiles = await db.query('select user_id from public.profiles');
    if (outsider.rows[0].member !== false || outsiderProfiles.rows.length !== 0) throw new Error('DB_OUTSIDER_RLS');
    return { ownerExists:true, ownerEmailConfirmed:true, ownerIsMember:true, ownerProfileVisible:true, outsidersDenied:true, anonymousAccessDenied:true };
  } finally { await db.query('rollback'); }
}

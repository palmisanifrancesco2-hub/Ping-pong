import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { studyPhase, virtualProfit, blockInterval, type StudyCase } from '../src/domain/study-metrics';
import { authorizedStudyCron } from '../server/cron-auth';
import { studyCase, studyProtocol } from '../server/prospective-study';
import { scoreModelVersion } from '../server/score-signals';
import model from '../research/prospective-value-v1-model.json';
import { createHandler } from '../server/handler';

const at = Date.parse(studyProtocol.createdAt);
const make = (status: StudyCase['status'], odds = 2): StudyCase => ({ id: 'case', at, p: .6, baseline: .5, odds, status, modelVersion: 'frozen' });
describe('frozen prospective evidence', () => {
  it('freezes the exact model artifact, independently from app estimates', () => {
    const bytes = readFileSync(new URL('../research/prospective-value-v1-model.json', import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(studyProtocol.modelFileHash);
    expect(model.validated).toBe(false);
    expect(createHash('sha256').update(readFileSync(new URL('../src/domain/score-model.ts', import.meta.url))).digest('hex')).toBe(studyProtocol.featureCodeHash);
    expect(studyProtocol.enrollmentDays).toBe(2 * studyProtocol.phaseDays);
    expect(studyProtocol.maximumPerDay).toBe(100);
  });
  it('keeps missing data inconclusive and computes flat virtual returns', () => {
    const empty = studyPhase([]); expect(empty.roi).toBeNull(); expect(empty.model.brier).toBeNull(); expect(empty.preliminaryPass).toBe(false);
    expect(virtualProfit(2.5, 'won')).toBe(1.5); expect(virtualProfit(2, 'lost')).toBe(-1); expect(virtualProfit(2, 'void')).toBe(0); expect(virtualProfit(2, 'pending')).toBeNull();
    const phase = studyPhase([make('won', 2.5), make('lost'), make('void'), make('pending'), make('invalid')]);
    expect(phase.roi).toBeCloseTo(.5 / 3); expect(phase.pessimisticRoi).toBeCloseTo(-1.5 / 5); expect(phase.settled).toBe(3); expect(phase.invalid).toBe(1); expect(phase.preliminaryPass).toBe(false);
    expect(phase.model.brier).toBeCloseTo((.16 + .36) / 2);
    expect(phase.market.brier).toBe(.25);
  });
  it('uses date blocks rather than treating correlated matches as independent', () => {
    expect(blockInterval(Array.from({ length: 2000 }, () => ({ at, value: 1 }))).lower).toBeNull();
    const rows = Array.from({ length: 14 }, (_, i) => ({ at: at + i * 86400000, value: i % 2 ? -1 : 1 }));
    const first = blockInterval(rows); expect(first).toEqual(blockInterval(rows));
    expect(first.lower!).toBeLessThan(0); expect(first.upper!).toBeGreaterThan(0);
    const allWins = studyPhase(Array.from({ length: 999 }, (_, i) => ({ ...make('won'), id: String(i), at: at + (i % 14) * 86400000 })));
    expect(allWins.preliminaryPass).toBe(false);
  });
  it('requires a matching result, frozen version and verified pre-start observation', () => {
    const row = { id: 'p', predicted_at: new Date(at).toISOString(), selection: 'A', probability: .6, evidence: { studyId: studyProtocol.id, frozenModel: scoreModelVersion(model), marketProbability: .5 }, market: { event_id: 'e', event: { source_id: 'source', competition: { name: 'league' }, home_id: 'a', away_id: 'b', home: { display_name: 'A' }, away: { display_name: 'B' } } }, quote: { decimal_odds: 2 }, outcome: { status: 'won', result_event_id: 'e', result: { status: 'reported', available_at: new Date(at + 7200000).toISOString(), score: { verifiedKickoff: new Date(at + 3600000).toISOString() } } } };
    expect(studyCase(row, at + 8000000).status).toBe('won');
    expect(studyCase(row, at + 5000000).status).toBe('pending');
    expect(studyCase({ ...row, outcome: { ...row.outcome, result_event_id: 'another' } }, at + 8000000).status).toBe('pending');
    expect(studyCase({ ...row, outcome: null }, at + 8000000).status).toBe('pending');
    expect(studyCase({ ...row, predicted_at: new Date(at + 3600000).toISOString() }, at + 8000000).status).toBe('invalid');
    expect(() => studyCase({ ...row, evidence: { ...row.evidence, frozenModel: 'changed' } }, at + 8000000)).toThrow('STUDY_ROW_INVALID');
  });
});
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>(r => s.close(() => r())))); });
it('authenticates cron independently and keeps user reports private', async () => {
  const secret = 'synthetic-only-cron-secret-of-sufficient-length';
  expect(authorizedStudyCron('Bearer short', 'short')).toBe(false);
  expect(authorizedStudyCron(undefined, secret)).toBe(false);
  expect(authorizedStudyCron(`Bearer ${secret}x`, secret)).toBe(false);
  expect(authorizedStudyCron(`Bearer ${secret}`, secret)).toBe(true);
  const study = { run: vi.fn(async (user?: string) => { if (user) throw Error('STUDY_OWNER_ONLY'); return { captured: 0 }; }), report: vi.fn() };
  const server = createServer(createHandler({ env: { CRON_SECRET: secret }, study, authorize: async t => t === 'member' ? 'member-id' : null }));
  servers.push(server); await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); const addr = server.address(); if (!addr || typeof addr === 'string') throw Error();
  const base = `http://127.0.0.1:${addr.port}`;
  expect((await fetch(`${base}/api/study`)).status).toBe(401);
  expect((await fetch(`${base}/api/study-run`, { headers: { 'user-agent': 'vercel-cron/1.0' } })).status).toBe(401);
  expect(study.run).not.toHaveBeenCalled();
  expect((await fetch(`${base}/api/study-run`, { headers: { Authorization: `Bearer ${secret}` } })).status).toBe(200);
  expect((await fetch(`${base}/api/study`, { method: 'POST', headers: { Authorization: 'Bearer member' } })).status).toBe(403);
  expect(study.report).not.toHaveBeenCalled();
});

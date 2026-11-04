import data from '../research/report-v2.json' with {type:'json'};
import type {ResearchReport} from '../src/shared/research.js';
// Keep individual reconstruction rows in the audit artifact, not in API responses.
const {finalPredictions:_,...summary}=data;
export const researchReport:ResearchReport=summary;

import scoreData from '../research/report-v3.json' with {type:'json'};
import forwardData from '../research/forward-v3-manifest.json' with {type:'json'};
import type{ScoreResearchReport,ForwardManifest}from'../src/shared/score-research.js';
const {finalPredictions:_scoreRows,...scoreSummary}=scoreData;
export const scoreResearchReport:ScoreResearchReport=scoreSummary;
export const forwardStudy:ForwardManifest=forwardData;

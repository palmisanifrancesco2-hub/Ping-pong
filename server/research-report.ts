import data from '../research/report-v2.json' with {type:'json'};
import type {ResearchReport} from '../src/shared/research.js';
// Keep individual reconstruction rows in the audit artifact, not in API responses.
const {finalPredictions:_,...summary}=data;
export const researchReport:ResearchReport=summary;

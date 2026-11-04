import type{ResearchMetrics}from'./research';
export type ScoreResearchReport={chosen:string;requested:number;knownStarts:number;trainingSamples:number;selectionSamples:number;calibrationSamples:number;metrics:ResearchMetrics;accuracy:number|null;baselines:{neutral:ResearchMetrics;elo:ResearchMetrics};checks:{label:string;passed:boolean}[];retrospectiveGatesPassed:boolean;productionValidated:boolean;reason:string;candidates:(ResearchMetrics&{name:string})[]};
export type ForwardManifest={observedAt:string;events:number;captureHash:string;policy:{minimumFinalEvents:number;minimumDays:number}};

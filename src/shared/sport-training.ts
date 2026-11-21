import type { AdditionalSport } from './individual-sports.js';

export type WinnerMetrics = { n:number; hits:number; accuracy:number; brier:number; logLoss:number };
export type SportCandidate = {
  name:string;
  calibration:WinnerMetrics;
  test:WinnerMetrics;
  coefficients?:number[];
};
export type SportTraining = {
  sport:AdditionalSport;
  source:string;
  raw:number;
  complete:number;
  withScheduledStart:number;
  withPublication:number;
  eligible:number;
  from:string|null;
  to:string|null;
  train:number;
  calibration:number;
  test:number;
  selected:string|null;
  candidates:SportCandidate[];
  checkedAt:string;
  error?:string;
};

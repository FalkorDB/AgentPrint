export interface MonthlyMetricResult {
  month: string; // YYYY-MM
  activeDevs: number;
  activeCodeContributors: number;
  linesChangedPerDev: number | null;
  prMergeRatePerDev: number | null;
  prRejectionRate: number | null;
  firstTimeContribRatio: number | null;
  medianTtmHours: number | null;
  medianTtcHours: number | null;
}

export interface ProjectMetricSummary {
  projectId: string;
  owner: string;
  repo: string;
  metrics: MonthlyMetricResult[];
}

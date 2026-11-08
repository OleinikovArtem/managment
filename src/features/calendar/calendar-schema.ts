export class CalendarError extends Error {}
export type CalendarRuleData = {
  id: string;
  instanceId: string;
  revision: number;
  lockoutKey: string;
  lockoutLabel?: string;
  timezone: string;
  type: string;
  localTime: string;
  isoWeekdays: number[];
  effectiveFrom: Date;
};

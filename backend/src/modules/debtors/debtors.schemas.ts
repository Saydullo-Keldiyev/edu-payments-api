import { z } from 'zod';
import { monthSchema } from '../../common/validation';

export const debtorsQuerySchema = z.object({
  month: monthSchema('month'),
});

export interface MonthRange {
  /** First day of the month, inclusive (YYYY-MM-DD). */
  start: string;
  /** First day of the following month, exclusive (YYYY-MM-DD). */
  end: string;
}

/** Half-open [start, end) range covering one calendar month; handles the December -> January rollover. */
export function monthRange(month: string): MonthRange {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  // Plain string arithmetic: Date#toISOString renders year 10000 as "+010000", which PostgreSQL rejects.
  const [nextYear, nextMonth] = monthNumber === 12 ? [year + 1, 1] : [year, monthNumber + 1];
  return {
    start: `${month}-01`,
    end: `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

/**
 * LoadGuard — priority-aware concurrency limiter for heartbeat runs.
 *
 * Prevents more than `maxHighPriorityConcurrent` high-/critical-priority runs
 * from executing simultaneously within a single company.  Excess high-priority
 * wakeup requests are left in `queued` state and will be picked up once a
 * running slot becomes available.
 *
 * Integration point: call `canStartHighPriorityRun` inside
 * `startNextQueuedRunForAgent` before invoking `claimQueuedRun`.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@msproltd/db";
import { heartbeatRuns, issues } from "@msproltd/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const HIGH_PRIORITY_LABELS = ["high", "critical"] as const;
export type IssuePriority = (typeof HIGH_PRIORITY_LABELS)[number];

/** Default cap on simultaneously running high/critical-priority heartbeat runs. */
export const MAX_HIGH_PRIORITY_CONCURRENT_DEFAULT = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoadGuardOptions {
  /** Maximum allowed concurrent running runs with priority "high" or "critical". */
  maxHighPriorityConcurrent?: number;
}

export interface LoadGuard {
  /**
   * Count the number of currently running heartbeat runs whose linked issue
   * has priority "high" or "critical".
   */
  countRunningHighPriority(companyId: string): Promise<number>;

  /**
   * Returns `true` if a new high/critical-priority run may start, i.e. the
   * current count of running high-priority runs is below the configured cap.
   */
  canStartHighPriorityRun(companyId: string): Promise<boolean>;

  /**
   * Returns `true` if `priority` is considered "high" for guard purposes.
   * Pure helper — does not touch the database.
   */
  isHighPriority(priority: string | null | undefined): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a {@link LoadGuard} bound to the given database connection.
 *
 * @example
 * ```ts
 * const guard = createLoadGuard(db);
 * if (guard.isHighPriority(issue.priority)) {
 *   if (!(await guard.canStartHighPriorityRun(companyId))) {
 *     return; // leave run in queue
 *   }
 * }
 * ```
 */
export function createLoadGuard(db: Db, opts: LoadGuardOptions = {}): LoadGuard {
  const max = opts.maxHighPriorityConcurrent ?? MAX_HIGH_PRIORITY_CONCURRENT_DEFAULT;

  function isHighPriority(priority: string | null | undefined): boolean {
    return HIGH_PRIORITY_LABELS.includes(priority as IssuePriority);
  }

  async function countRunningHighPriority(companyId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(heartbeatRuns)
      .innerJoin(
        issues,
        and(
          eq(issues.id, sql`(${heartbeatRuns.contextSnapshot}->>'issueId')::uuid`),
          eq(issues.companyId, companyId),
        ),
      )
      .where(
        and(
          eq(heartbeatRuns.companyId, companyId),
          eq(heartbeatRuns.status, "running"),
          inArray(issues.priority, [...HIGH_PRIORITY_LABELS]),
        ),
      );
    return Number(rows[0]?.count ?? 0);
  }

  async function canStartHighPriorityRun(companyId: string): Promise<boolean> {
    const current = await countRunningHighPriority(companyId);
    return current < max;
  }

  return { isHighPriority, countRunningHighPriority, canStartHighPriorityRun };
}

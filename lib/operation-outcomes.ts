const successes = new Set(["completed", "success", "succeeded"]);
const failures = new Set(["error", "failed", "timeout", "timed_out"]);
/** Pending, cancelled, approval and unknown states are never counted as successes. */
export function summarizeOperationOutcomes(rows: Array<{ status: unknown }>) {
  const success = rows.filter(row => successes.has(String(row.status).toLowerCase())).length;
  const failed = rows.filter(row => failures.has(String(row.status).toLowerCase())).length;
  const completed = success + failed;
  return { success, failed, completed, other: rows.length - completed, successRate: completed ? Math.round(success / completed * 100) : null };
}

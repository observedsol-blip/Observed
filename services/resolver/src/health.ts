// Dead man's switch. The service is only a service if somebody notices it stopping.
//
// Two checks at healthchecks.io (or any ping service):
//   RUN     — pinged at the end of every run. Period 1 h, grace 90 min: three failed runs in a row
//             (or a dead Worker) means no ping arrives and the alert fires by itself.
//   BACKLOG — pinged only when nothing is stuck: no round unresolved for more than 12 h and the
//             hot wallet still above the floor. Otherwise it gets /fail.
export type HealthUrls = { run: string; backlog: string };

async function ping(url: string, path: "" | "/fail" | "/start", body?: string): Promise<void> {
  try {
    await fetch(`${url}${path}`, { method: "POST", body: body?.slice(0, 500) ?? "" });
  } catch {
    // A failing ping service must never take the resolver down.
  }
}

export const runStarted = (h: HealthUrls) => ping(h.run, "/start");
export const runOk = (h: HealthUrls, summary: string) => ping(h.run, "", summary);
export const runFailed = (h: HealthUrls, error: string) => ping(h.run, "/fail", error);
export const backlogOk = (h: HealthUrls, summary: string) => ping(h.backlog, "", summary);
export const backlogAlarm = (h: HealthUrls, reason: string) => ping(h.backlog, "/fail", reason);

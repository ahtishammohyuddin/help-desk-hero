// Escalation form state. Pure logic (no browser), tested with Node.
//
// After the right answer on some tickets, the player sends the ticket on to another team:
// they pick the team and tick the details to include. The server checks the choices
// against the reviewed problem file; this file only keeps track of what the player picked.

export const TEAM_ICONS = { network: '🌐', security: '🛡️', server: '🗄️', vendor: '📦' };

/** A fresh form from the server's escalation data ({ teams, details }). */
export function newEscalation(form) {
  return { form, team: null, picked: [], sending: false, error: false, review: null };
}

export function pickTeam(esc, team) {
  if (esc.review || !esc.form.teams.some((t) => t.id === team)) return esc;
  return { ...esc, team };
}

export function toggleDetail(esc, id) {
  if (esc.review || !esc.form.details.some((d) => d.id === id)) return esc;
  const picked = esc.picked.includes(id) ? esc.picked.filter((x) => x !== id) : [...esc.picked, id];
  return { ...esc, picked };
}

/** A team must be chosen, plus at least one detail. */
export const canSend = (esc) => !esc.review && !esc.sending && esc.team !== null && esc.picked.length > 0;

/** Body for POST /problems/{id}/escalate. */
export const escalationBody = (esc) => ({ team: esc.team, details: [...esc.picked].sort((a, b) => a - b) });

/** Short summary of the server's review, for the result banner. */
export function reviewSummary(review) {
  const missed = review.details.filter((d) => d.send && !d.chosen).length;
  const extra = review.details.filter((d) => !d.send && d.chosen).length;
  return { perfect: review.perfect, teamCorrect: review.team_correct, missed, extra };
}

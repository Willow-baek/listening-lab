// Stop before the currently announced 2027 hosting overage period.
// 2026-12-30 00:00 Australia/Melbourne. Resumption requires the owner's review.
export const CAPTION_PAUSE_AT = Date.parse('2026-12-29T13:00:00Z');
export function captionRequestsAllowed(now = Date.now()) {
  return Number.isFinite(now) && now < CAPTION_PAUSE_AT;
}

// Pure helpers for a scoped review session. Decisions remain on file records;
// deferral only controls which pending files are left in this session.
const DECIDED = new Set(['keep', 'archive', 'trash']);
const RETURN_PAGES = new Set(['', 'home', 'files', 'projects', 'dashboard', 'activity', 'quick', 'explore', 'browse']);
const RETURN_PARAMS = new Map([
 ['type', 64], ['view', 64], ['project', 300], ['bucket', 64],
 ['q', 500], ['metric', 32], ['sort', 32], ['group', 32]
]);
const idsOf = review => Array.isArray(review?.ids) ? review.ids.filter(id => typeof id === 'string') : [];
const deferredOf = review => new Set(Array.isArray(review?.deferred) ? review.deferred : []);
const filesById = files => new Map((Array.isArray(files) ? files : []).filter(file => file && typeof file.id === 'string').map(file => [file.id, file]));
const pending = file => !!file && !DECIDED.has(file.decision);

export function getSessionSummary(review, files) {
 const lookup = filesById(files), deferredIds = deferredOf(review);
 let total = 0, reviewed = 0, deferred = 0, remaining = 0;
 for (const id of new Set(idsOf(review))) {
  const file = lookup.get(id);
  if (!file) continue;
  total++;
  if (!pending(file)) reviewed++;
  else if (deferredIds.has(id)) deferred++;
  else remaining++;
 }
 return {total, reviewed, deferred, remaining, complete:remaining === 0};
}

export function nextPendingIndex(review, files, from = review?.cursor) {
 const ids = idsOf(review), lookup = filesById(files), deferred = deferredOf(review);
 const current = Number.isFinite(from) ? Math.max(-1, Math.min(ids.length, Math.trunc(from))) : -1;
 const available = index => pending(lookup.get(ids[index])) && !deferred.has(ids[index]);
 for (let index = current + 1; index < ids.length; index++) if (available(index)) return index;
 for (let index = 0; index <= current && index < ids.length; index++) if (available(index)) return index;
 return ids.length;
}

export function adjacentReviewIndex(review, direction) {
 const length = idsOf(review).length;
 if (!length) return 0;
 const current = Number.isFinite(review?.cursor) ? Math.max(0, Math.min(length, Math.trunc(review.cursor))) : 0;
 const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
 return Math.max(0, Math.min(length - 1, current + step));
}

// Return targets are internal workspace destinations, never transient screens
// or a URL. Only known display/filter parameters survive serialization.
export function validReturnRoute(value) {
 if (typeof value !== 'string' || value.length > 4000 || !value.startsWith('#') || /[\u0000-\u001f\u007f\\]/.test(value)) return '#files';
 const fragment = value.slice(1), separator = fragment.indexOf('?');
 const page = separator < 0 ? fragment : fragment.slice(0, separator);
 if (!RETURN_PAGES.has(page)) return '#files';
 const canonicalPage = page === 'home' ? '' : page;
 const source = new URLSearchParams(separator < 0 ? '' : fragment.slice(separator + 1));
 const params = new URLSearchParams();
 for (const [key, limit] of RETURN_PARAMS) {
  const item = source.get(key);
  if (item && !/[\u0000-\u001f\u007f]/.test(item)) params.set(key, item.slice(0, limit));
 }
 return '#' + canonicalPage + (params.size ? '?' + params.toString() : '');
}

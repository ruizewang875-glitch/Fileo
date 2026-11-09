export const TRASH_RETENTION_DAYS = 180;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 86400000;

export function isActiveFile(file) {
 return !!file && file.decision !== 'archive' && file.decision !== 'trash';
}

export function trashExpiresAt(file) {
 if (!file || file.decision !== 'trash' || !Number.isFinite(file.trashedAt) || file.trashedAt < 0) return null;
 return file.trashedAt + TRASH_RETENTION_MS;
}

export function trashDaysRemaining(file, now=Date.now()) {
 const deadline=trashExpiresAt(file);
 return deadline===null ? null : Math.max(0,Math.min(TRASH_RETENTION_DAYS,Math.ceil((deadline-now)/86400000)));
}

export function isExpiredTrash(file, now=Date.now()) {
 const deadline=trashExpiresAt(file);
 return deadline!==null && deadline<=now;
}

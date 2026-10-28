const DECISION_LABELS = {pending:'To review',keep:'Keep',archive:'Archive',trash:'Trash'};
const ACTION_LABELS = {keep:'Kept',archive:'Archived',trash:'Moved to Trash',pending:'Marked to review',import:'Imported'};

function recordedOutcome(event) {
 const decisions = [...new Set((Array.isArray(event.after) ? event.after : []).map(file => file.decision).filter(value => Object.hasOwn(DECISION_LABELS,value)))];
 return decisions.length === 1 ? DECISION_LABELS[decisions[0]] : '';
}
function actionLabel(event) {
 const outcome = recordedOutcome(event);
 if (event.action === 'clarify') return outcome ? `Clarified → ${outcome}` : 'Clarified';
 if (event.action === 'restore') return outcome ? `Restored → ${outcome}` : 'Restored previous decisions';
 return ACTION_LABELS[event.action] || 'Updated';
}
function dayKey(value) {
 const date = new Date(value);
 return Number.isNaN(date.getTime()) ? 'unknown' : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
function dayLabel(value) {
 const date = new Date(value), today = new Date(), yesterday = new Date();
 yesterday.setDate(today.getDate() - 1);
 if (Number.isNaN(date.getTime())) return 'Earlier';
 if (dayKey(value) === dayKey(today)) return 'Today';
 if (dayKey(value) === dayKey(yesterday)) return 'Yesterday';
 return date.toLocaleDateString('en-GB',{day:'numeric',month:'long',...(date.getFullYear() !== today.getFullYear() ? {year:'numeric'} : {})});
}

/** Activity reads the immutable event result; only the three summary cards show current state. */
export function createActivity({getState,canUndo,onPreview,onUndo,thumb,badge,escapeHtml}) {
 const esc = escapeHtml;
 function render() {
  const state = getState(), summary = document.querySelector('#activity-summary'), list = document.querySelector('#activity-list');
  const labels = {keep:'Kept',archive:'Archived',trash:'In Trash'};
  summary.setAttribute('aria-label','Current file decisions');
  summary.innerHTML = ['keep','archive','trash'].map(decision => {
   const count = state.files.filter(file => file.decision === decision).length;
   return `<a class="activity-stat-card" data-decision="${decision}" href="#browse?view=${decision}" aria-label="${labels[decision]}: ${count} ${count === 1 ? 'file' : 'files'}"><span>${labels[decision]}</span><strong>${count}</strong></a>`;
  }).join('');
  if (!state.history.length) {
   list.innerHTML = '<div class="activity-empty"><h2>Your decisions will appear here</h2></div>';
   return;
  }
  const filesById = new Map(state.files.map(file => [file.id,file]));
  const groups = new Map();
  for (const event of state.history) {
   const key = dayKey(event.at);
   if (!groups.has(key)) groups.set(key,{label:dayLabel(event.at),events:[]});
   groups.get(key).events.push(event);
  }
  list.innerHTML = [...groups.values()].map((group,index) => `<section class="activity-day" aria-labelledby="activity-day-${index}"><h2 id="activity-day-${index}" class="activity-day-label">${esc(group.label)}</h2><ol class="activity-events">${group.events.map(event => {
   const files = event.fileIds.map(id => filesById.get(id)).filter(Boolean), first = files[0];
   const title = files.length === 1 ? first.file : `${files.length} files`;
   const date = new Date(event.at), validDate = !Number.isNaN(date.getTime());
   const time = validDate ? date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
   const dateTime = validDate ? date.toISOString() : '';
   const undoable = canUndo(event.id);
   return `<li class="activity-event" data-event-id="${esc(event.id)}" data-action="${esc(event.action)}"${event.undone ? ' data-undone="true"' : ''}>
    <div class="activity-event-thumbnail" aria-hidden="true">${first ? thumb(first) : '<span class="file-format">FILE</span>'}${files.length > 1 ? `<span class="activity-file-count">${files.length}</span>` : ''}</div>
    <div class="activity-event-copy"><div class="activity-event-heading"><h3>${esc(actionLabel(event))}</h3>${event.undone ? '<span class="activity-undone-label">Undone</span>' : ''}</div><button class="activity-event-file" type="button" data-activity-preview="${esc(first?.id || '')}"${first ? '' : ' disabled'}>${esc(title)}</button>${first && files.length === 1 ? badge(first) : ''}</div>
    <time class="activity-event-time" datetime="${esc(dateTime)}"${validDate ? ` title="${esc(date.toLocaleString('en-GB'))}"` : ''}>${esc(time)}</time>
    <div class="activity-event-tools">${undoable ? `<button type="button" class="activity-undo" data-activity-undo="${esc(event.id)}" aria-label="Undo ${esc(actionLabel(event).toLowerCase())} for ${esc(title)}">Undo</button>` : ''}</div>
   </li>`;
  }).join('')}</ol></section>`).join('');
  list.querySelectorAll('[data-activity-preview]').forEach(button => button.onclick = () => {if(button.dataset.activityPreview) onPreview(button.dataset.activityPreview);});
  list.querySelectorAll('[data-activity-undo]').forEach(button => button.onclick = () => onUndo(button.dataset.activityUndo));
 }
 return {render};
}

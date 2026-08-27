/* ============================================================
   APP.JS — the "photo swapper." Handles navigation, login state,
   and swapping content into the #view-container "picture frame."
   ============================================================ */

// Maps nav item keys to their view file + display label + which
// roles are allowed to see them in the nav.
const NAV_CONFIG = [
  { key: 'dashboard',        label: 'Dashboard',                roles: ['Director','Area Manager','Approved Provider'], type: 'blue' },
  { key: 'new-report',       label: 'New / Saved Report',       roles: ['Director','Area Manager','Approved Provider'], type: 'blue' },
  { key: 'owna-review',      label: 'OWNA Review',              roles: ['Director','Area Manager','Approved Provider'], type: 'amber' },
  { key: 'additional-checks',label: 'Additional Checks',        roles: ['Director','Area Manager','Approved Provider'], type: 'amber' },
  { key: 'monthly-programming',label: 'Monthly Programming',    roles: ['Director','Area Manager','Approved Provider'], type: 'amber' },
  { key: 'compliance-certificates',label: 'Compliance Certificates', roles: ['Director','Area Manager','Approved Provider'], type: 'amber' },
  { key: 'sawd-qip',         label: 'SAWD QIP',                 roles: ['Director','Area Manager','Approved Provider'], type: 'amber' },
  { key: 'displays',         label: 'Displays',                 roles: ['Director','Area Manager','Approved Provider'], type: 'amber' },
  { key: 'social-media-consent', label: 'Social Media Consent', roles: ['Director','Area Manager','Approved Provider'], type: 'amber' },
  { key: 'supplied-devices', label: 'Supplied Devices',         roles: ['Director','Area Manager','Approved Provider'], type: 'amber' },
  { key: 'appraisals',       label: 'Appraisals & Meetings',    roles: ['Director','Area Manager','Approved Provider'], type: 'amber' },
  { key: 'discussion-points',label: 'Discussion Points',        roles: ['Director','Area Manager','Approved Provider'], type: 'amber' },
  { key: 'feedback-thread',  label: 'AP/AM Feedback',           roles: ['Director','Area Manager','Approved Provider'], type: 'amber' },
  { key: 'admin',            label: 'Admin',                    roles: ['Area Manager','Approved Provider'], type: 'wine' },
  { key: 'provider-settings',label: 'Provider Settings',        roles: ['Approved Provider'], type: 'red' }
];

let currentView = null;

/* ============================================================
   VIEW LOADING — fetches a view's HTML fragment and swaps it in
   ============================================================ */

async function loadView(viewKey) {
  const container = document.getElementById('view-container');
  const skeleton = document.getElementById('loading-skeleton');

  container.innerHTML = '';
  skeleton.classList.remove('hidden');

  try {
    const response = await fetch('views/' + viewKey + '.html');
    if (!response.ok) throw new Error('View not found: ' + viewKey);
    const html = await response.text();

    skeleton.classList.add('hidden');
    container.innerHTML = html;
    container.classList.remove('view-fade-in');
    void container.offsetWidth; // forces the browser to restart the animation each time
    container.classList.add('view-fade-in');
    currentView = viewKey;

    updateActiveNavItem(viewKey);

    // IMPORTANT: <script> tags inserted via innerHTML do NOT execute
    // automatically (browser security behaviour) — so we manually
    // re-create each script tag, which forces it to actually run.
    const scriptTags = container.querySelectorAll('script');
    scriptTags.forEach(function(oldScript) {
      const newScript = document.createElement('script');
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    // Each view file defines its own init function, e.g. initDashboard()
    // Called automatically once its script has executed and defined it.
    const initFnName = 'init' + viewKey.split('-').map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('');

    if (typeof window[initFnName] === 'function') {
      window[initFnName]();
    }
  } catch (err) {
    skeleton.classList.add('hidden');
    container.innerHTML = '<div class="card"><p class="text-muted">Could not load this page. Please try again.</p></div>';
    console.error(err);
  }
}

function updateActiveNavItem(viewKey) {
  document.querySelectorAll('.nav-item').forEach(function(el) {
    el.classList.toggle('active', el.dataset.view === viewKey);
  });
}

/* ============================================================
   NAV RENDERING — built dynamically based on logged-in user's role
   ============================================================ */

function renderNav() {
  const session = Session.get();
  const navList = document.getElementById('nav-list');
  navList.innerHTML = '';

  if (!session) return;

  NAV_CONFIG.forEach(function(item) {
    if (item.roles.indexOf(session.role) === -1) return;
    const li = document.createElement('li');
    li.className = 'nav-item nav-type-' + item.type;
    li.dataset.view = item.key;
    li.textContent = item.label;
    li.addEventListener('click', function() { loadView(item.key); });
    navList.appendChild(li);
  });
}

/* ============================================================
   LOGIN / LOGOUT STATE HANDLING
   ============================================================ */

function showAppShell() {
  document.getElementById('top-bar').classList.remove('hidden');
  document.getElementById('side-nav').classList.remove('hidden');
  const session = Session.get();
  document.getElementById('user-display').textContent = session.username + ' (' + session.role + ')';
  renderNav();
}

function hideAppShell() {
  document.getElementById('top-bar').classList.add('hidden');
  document.getElementById('side-nav').classList.add('hidden');
}

function handleLoginSuccess(sessionData) {
  Session.save(sessionData);
  showAppShell();
  loadView('dashboard');
}

function handleLogout() {
  Session.clear();
  hideAppShell();
  loadView('login');
}

/* ============================================================
   SHARED UI HELPERS — used by every view file
   ============================================================ */

function showToast(message, type) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'info');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3500);
}

function showModal(innerHtml) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.innerHTML = innerHtml;
  overlay.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-box').innerHTML = '';
}

/**
 * Export modal — triggered by the top bar [⬇ Export] button on any page.
 */
async function openExportModal() {
  const session = Session.get();
  const isAdmin = session.role === 'Area Manager' || session.role === 'Approved Provider';
  const tabs = await api('getExportableTabList');
  const centres = isAdmin ? await getCachedCentres() : [];

  let centreOptionsHtml = '<option value="All">All Centres</option>' +
    centres.map(function(c) { return '<option value="' + c.centreId + '">' + c.centreName + '</option>'; }).join('');

  let tabOptionsHtml = '<option value="__ALL__">📦 All Tabs (ZIP of CSVs)</option>' +
    tabs.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');

  showModal(
    '<h3 class="card-title">Export Data</h3>' +
    '<div class="form-group"><label>Tab</label><select id="exp-tab">' + tabOptionsHtml + '</select></div>' +
    (isAdmin ? '<div class="form-group"><label>Centre</label><select id="exp-centre">' + centreOptionsHtml + '</select></div>' : '') +
    '<div class="form-group"><label>Your Password (required to export)</label><input type="password" id="exp-password"></div>' +
    '<div class="flex-gap" style="justify-content:flex-end;"><button class="btn btn-secondary" id="exp-cancel">Cancel</button><button class="btn btn-primary" id="exp-confirm">Export</button></div>'
  );

  document.getElementById('exp-cancel').addEventListener('click', closeModal);
  document.getElementById('exp-confirm').addEventListener('click', async function() {
    const tabName = document.getElementById('exp-tab').value;
    const centreScope = isAdmin ? document.getElementById('exp-centre').value : null;
    const password = document.getElementById('exp-password').value;
    if (!password) { showToast('Password required.', 'error'); return; }
    closeModal();
    showToast('Preparing export...', 'info');

    let result;
    if (tabName === '__ALL__') {
      result = await api('generateExportAllCsv', password, centreScope, null, null);
    } else {
      result = await api('generateExportCsv', password, tabName, centreScope, null, null);
    }
    downloadBase64File(result.filename, result.mimeType, result.base64Data);
    showToast('Export downloaded.', 'success');
  });
}

function downloadBase64File(filename, mimeType, base64Data) {
  const link = document.createElement('a');
  link.href = 'data:' + mimeType + ';base64,' + base64Data;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Reusable password-confirmation modal — used by every delete/export
 * action per the locked "AP must re-enter password" rule.
 * onConfirm receives the entered password as its argument.
 */
function showPasswordConfirmModal(title, message, onConfirm) {
  showModal(
    '<h3 class="card-title">' + title + '</h3>' +
    '<p class="text-muted">' + message + '</p>' +
    '<div class="form-group">' +
      '<label>Re-enter your password to confirm</label>' +
      '<input type="password" id="confirm-password-input">' +
    '</div>' +
    '<div class="flex-gap" style="justify-content:flex-end;">' +
      '<button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>' +
      '<button class="btn btn-danger" id="modal-confirm-btn">Confirm</button>' +
    '</div>'
  );
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-confirm-btn').addEventListener('click', function() {
    const pw = document.getElementById('confirm-password-input').value;
    closeModal();
    onConfirm(pw);
  });
}

/* ============================================================
   CENTRE SELECTOR HELPER — used by Dashboard, New Report, and
   any other view needing an AM/AP-facing centre dropdown.
   ============================================================ */

async function populateCentreSelect(selectEl, onChangeCallback, initialCentreId) {
  const centres = await getCachedCentres();
  selectEl.innerHTML = '';
  centres.forEach(function(c) {
    const opt = document.createElement('option');
    opt.value = c.centreId;
    opt.textContent = c.centreName;
    selectEl.appendChild(opt);
  });

  const defaultId = initialCentreId || (centres.length > 0 ? centres[0].centreId : null);
  if (defaultId) selectEl.value = defaultId;

  selectEl.addEventListener('change', function() {
    onChangeCallback(selectEl.value);
  });

  if (defaultId) onChangeCallback(defaultId);
}

/* ============================================================
   CHECKLIST TAB ENGINE — shared by OWNA Review, SAWD QIP,
   Displays, Monthly Programming. Mirrors the backend's Pattern A
   design: one engine, driven by whatever schema each category
   returns, rather than 4 separate near-identical blocks of code.
   ============================================================ */

let cachedCurrentPeriod = null;
async function getCurrentPeriodClient() {
  if (!cachedCurrentPeriod) cachedCurrentPeriod = await api('getCurrentPeriod');
  return cachedCurrentPeriod;
}

function statusBadgeClassFor(status) {
  if (status === 'approved') return 'badge-green';
  if (status === 'submittedPending') return 'badge-blue';
  if (status === 'sentBack') return 'badge-orange';
  if (status === 'draft') return 'badge-yellow';
  return 'badge-grey';
}

function ynSelectHtml(rowIndex, fieldName, value, disabled) {
  const options = ['', 'Y', 'N', 'N/A'];
  let html = '<select data-row="' + rowIndex + '" data-field="' + fieldName + '" ' + (disabled ? 'disabled' : '') + '>';
  options.forEach(function(o) {
    html += '<option value="' + o + '" ' + (value === o ? 'selected' : '') + '>' + (o === '' ? '—' : o) + '</option>';
  });
  html += '</select>';
  return html;
}

function textareaHtml(rowIndex, fieldName, value, disabled) {
  return '<textarea data-row="' + rowIndex + '" data-field="' + fieldName + '" rows="2" ' + (disabled ? 'disabled' : '') + '>' + (value || '') + '</textarea>';
}

function dateForInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

/**
 * Builds a header cell with an optional ✏️ rename icon — only visible
 * to AM/AP (matches backend's requireAdmin gate on renameColumnHeader).
 * sheetName must match _Config_ColumnMap's SheetName column exactly.
 * Pass sheetName/logicalField as null to render a plain, non-editable header.
 */
function renderHeaderCell(colClass, label, sheetName, logicalField) {
  const session = Session.get();
  // Extended per updated rule: all logged-in roles (Director, AM, AP)
  // can rename headers now — previously AM/AP-only.
  if (!session || !sheetName || !logicalField) {
    return '<div class="' + colClass + '">' + label + '</div>';
  }
  return '<div class="' + colClass + '">' + label +
    ' <span class="header-edit-btn" data-sheet="' + sheetName + '" data-field="' + logicalField + '" data-label="' + label + '" title="Rename this column">✏️</span></div>';
}

function openRenameHeaderModal(sheetName, logicalField, currentLabel) {
  showModal(
    '<h3 class="card-title">Rename Column</h3>' +
    '<p class="text-muted">This changes the column name on the actual sheet for everyone.</p>' +
    '<div class="form-group"><label>New label for "' + currentLabel + '"</label><input type="text" id="rh-new-label" value="' + currentLabel + '"></div>' +
    '<div class="flex-gap" style="justify-content:flex-end;"><button class="btn btn-secondary" id="rh-cancel">Cancel</button><button class="btn btn-primary" id="rh-confirm">Save</button></div>'
  );
  document.getElementById('rh-cancel').addEventListener('click', closeModal);
  document.getElementById('rh-confirm').addEventListener('click', async function() {
    const newLabel = document.getElementById('rh-new-label').value.trim();
    if (!newLabel) { showToast('Please enter a label.', 'error'); return; }
    closeModal();
    await api('renameColumnHeader', sheetName, logicalField, newLabel);
    showToast('Column renamed.', 'success');
    if (currentView) loadView(currentView);
  });
}

async function handleFieldSave(e, category, centreId) {
  const el = e.target;
  if (!el.dataset || !el.dataset.field) return;
  const rowIndex = Number(el.dataset.row);
  const fieldName = el.dataset.field;
  const value = el.value;
  try {
    await api('saveChecklistField', category, centreId, rowIndex, fieldName, value);
    el.style.transition = 'background-color 0.3s';
    el.style.backgroundColor = '#E8F5EC';
    setTimeout(function() { el.style.backgroundColor = ''; }, 600);
  } catch (err) { /* api() already shows an error toast */ }
}

function openAddItemModal(category, centreId, periodKey, onAdded) {
  showModal(
    '<h3 class="card-title">Add New Item</h3>' +
    '<div class="form-group"><label>Item Name</label><input type="text" id="new-item-name"></div>' +
    '<div class="form-group"><label>Recurrence</label><select id="new-item-recurrence">' +
      '<option>Monthly</option><option>Yearly</option><option>Permanent</option><option>This month only</option>' +
    '</select></div>' +
    '<div class="flex-gap" style="justify-content:flex-end;">' +
      '<button class="btn btn-secondary" id="ai-cancel">Cancel</button>' +
      '<button class="btn btn-primary" id="ai-confirm">Add</button>' +
    '</div>'
  );
  document.getElementById('ai-cancel').addEventListener('click', closeModal);
  document.getElementById('ai-confirm').addEventListener('click', async function() {
    const name = document.getElementById('new-item-name').value.trim();
    const recurrence = document.getElementById('new-item-recurrence').value;
    if (!name) { showToast('Please enter an item name.', 'error'); return; }
    closeModal();
    await api('addDirectorRowToTab', category, name, recurrence, periodKey);
    showToast('Item added.', 'success');
    onAdded();
  });
}

function renderTabHeaderInfo(headerEl, headerInfo, category, centreId, periodKey, refreshCallback) {
  const session = Session.get();
  const isAdmin = session.role === 'Area Manager' || session.role === 'Approved Provider';

  let html = '<div class="card flex-between" style="align-items:center; flex-wrap:wrap; gap:0.75rem;"><div>';
  html += '<span class="badge ' + statusBadgeClassFor(headerInfo.status) + '">' + headerInfo.statusLabel + '</span> ';
  html += '<span class="text-muted">Last saved: ' + headerInfo.lastSavedDisplay + ' ' + headerInfo.lastSavedDaysAgo + '</span>';
  if (headerInfo.sentBackComment) {
    html += '<div class="mt-1" style="color:var(--orange);"><strong>Sent back:</strong> ' + headerInfo.sentBackComment + '</div>';
  }
  html += '</div><div class="flex-gap">';
  if (!headerInfo.isReadOnly) html += '<button class="btn btn-secondary btn-small" id="add-item-btn">+ Add Item</button>';
  if (isAdmin && headerInfo.status === 'submittedPending') {
    html += '<button class="btn btn-primary btn-small" id="approve-tab-btn">✅ Approve</button>';
    html += '<button class="btn btn-secondary btn-small" id="sendback-tab-btn">↩ Send Back</button>';
  }
  html += '</div></div>';
  headerEl.innerHTML = html;

  if (!headerInfo.isReadOnly) {
    document.getElementById('add-item-btn').addEventListener('click', function() {
      openAddItemModal(category, centreId, periodKey, refreshCallback);
    });
  }
  if (isAdmin && headerInfo.status === 'submittedPending') {
    document.getElementById('approve-tab-btn').addEventListener('click', async function() {
      await api('approveTab', category, centreId, periodKey);
      showToast('Tab approved.', 'success');
      refreshCallback();
    });
    document.getElementById('sendback-tab-btn').addEventListener('click', function() {
      showModal(
        '<h3 class="card-title">Send Back</h3>' +
        '<div class="form-group"><label>Comment (required)</label><textarea id="sendback-comment"></textarea></div>' +
        '<div class="flex-gap" style="justify-content:flex-end;">' +
          '<button class="btn btn-secondary" id="sb-cancel">Cancel</button>' +
          '<button class="btn btn-danger" id="sb-confirm">Send Back</button>' +
        '</div>'
      );
      document.getElementById('sb-cancel').addEventListener('click', closeModal);
      document.getElementById('sb-confirm').addEventListener('click', async function() {
        const comment = document.getElementById('sendback-comment').value;
        if (!comment.trim()) { showToast('A comment is required.', 'error'); return; }
        closeModal();
        await api('sendBackTab', category, centreId, periodKey, comment);
        showToast('Sent back to Director.', 'success');
        refreshCallback();
      });
    });
  }
}

function renderChecklistTable(category, data, contentEl, centreId, isReadOnly) {
  const session = Session.get();
  const isAdmin = session.role === 'Area Manager' || session.role === 'Approved Provider';
  const canEditDir = !isReadOnly && ((session.role === 'Director' && session.centreId === centreId) || isAdmin);
  const canEditAdmin = !isReadOnly && isAdmin;
  const schema = data.schema;
  const adminLabel = schema.adminCheckField === 'ManagerCheck' ? 'Manager Check' : 'Compliance Check';

  let html = '<div class="data-table"><div class="table-header">' + renderHeaderCell('col-text-short', 'Item', category, 'ItemName');
  if (schema.hasLocationColumn) html += renderHeaderCell('col-text-short', 'Location', category, 'Location');
  html += renderHeaderCell('col-narrow', 'Self-Assess', category, 'DirSelfAssess');
  if (schema.mitigationField) html += renderHeaderCell('col-text-long', 'Mitigation', category, schema.mitigationField);
  html += renderHeaderCell('col-narrow', adminLabel, category, schema.adminCheckField);
  if (category === 'Monthly Programming') html += renderHeaderCell('col-date', 'Target Date', category, 'TargetCompletionDate');
  html += renderHeaderCell('col-text-long', 'Manager Notes', category, 'ManagerNotes') + renderHeaderCell('col-text-long', 'Director Notes', category, 'DirectorNotes') + '</div>';

  data.items.forEach(function(item) {
    html += '<div class="table-row">';
    html += '<div class="col-text-short" data-label="Item">' + item.itemName +
      (item.rowOrigin === 'DirectorAdded' ? ' <span class="badge badge-blue">🆕</span>' : '') +
      (item.isQAOfTheMonth ? ' <span class="badge badge-yellow">This Month</span>' : '') +
      (!item.scheduledThisMonth ? ' <span class="badge badge-grey">Not due this month</span>' : '') + '</div>';
    if (schema.hasLocationColumn) html += '<div class="col-text-short" data-label="Location">' + (item.location || '—') + '</div>';
    html += '<div class="col-narrow" data-label="Self-Assess">' + ynSelectHtml(item.rowIndex, 'DirSelfAssess', item.dirSelfAssess, !canEditDir) + '</div>';
    if (schema.mitigationField) html += '<div class="col-text-long" data-label="Mitigation">' + textareaHtml(item.rowIndex, schema.mitigationField, item.dirMitigation, !canEditDir) + '</div>';
    html += '<div class="col-narrow" data-label="' + adminLabel + '">' + ynSelectHtml(item.rowIndex, schema.adminCheckField, item.adminCheck, !canEditAdmin) + '</div>';
    if (category === 'Monthly Programming') {
      html += '<div class="col-date" data-label="Target Date"><input type="date" data-row="' + item.rowIndex + '" data-field="TargetCompletionDate" value="' + dateForInput(item.targetCompletionDate) + '" ' + (!canEditAdmin ? 'disabled' : '') + '></div>';
    }
    html += '<div class="col-text-long" data-label="Manager Notes">' + textareaHtml(item.rowIndex, 'ManagerNotes', item.managerNotes, !canEditAdmin) + '</div>';
    html += '<div class="col-text-long" data-label="Director Notes">' + textareaHtml(item.rowIndex, 'DirectorNotes', item.directorNotes, !canEditDir) + '</div>';
    html += '</div>';
  });
  html += '</div>';
  contentEl.innerHTML = html;

  contentEl.addEventListener('change', function(e) { handleFieldSave(e, category, centreId); });
  contentEl.addEventListener('focusout', function(e) { if (e.target.tagName === 'TEXTAREA') handleFieldSave(e, category, centreId); });
}

async function renderChecklistTab(category, contentEl, headerEl, centreId) {
  contentEl.innerHTML = '<p class="text-muted">Loading...</p>';
  const period = await getCurrentPeriodClient();
  const [data, headerInfo] = await Promise.all([
    api('getChecklistData', category, centreId, period.periodKey),
    api('getTabHeaderInfo', category, centreId, period.periodKey)
  ]);

  renderTabHeaderInfo(headerEl, headerInfo, category, centreId, period.periodKey, function() {
    renderChecklistTab(category, contentEl, headerEl, centreId);
  });
  renderChecklistTable(category, data, contentEl, centreId, headerInfo.isReadOnly);
}

/* ============================================================
   APP STARTUP
   ============================================================ */

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('export-btn').addEventListener('click', function() {
    if (typeof openExportModal === 'function') openExportModal();
  });

  // Mobile nav toggle — shows/hides the side nav as an overlay drawer
  // on screens narrower than 900px (fixes Gap 1: nav previously vanished).
  document.getElementById('mobile-nav-toggle').addEventListener('click', function() {
    document.getElementById('side-nav').classList.toggle('mobile-open');
  });
  document.querySelector('.content-area').addEventListener('click', function() {
    document.getElementById('side-nav').classList.remove('mobile-open');
  });

  // Delegated listener for column-header rename pencils — added once
  // here rather than per-view, since header pencils appear everywhere.
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.header-edit-btn');
    if (!btn) return;
    openRenameHeaderModal(btn.dataset.sheet, btn.dataset.field, btn.dataset.label);
  });

  if (Session.isLoggedIn()) {
    showAppShell();
    loadView('dashboard');
  } else {
    hideAppShell();
    loadView('login');
  }
});
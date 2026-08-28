/* ============================================================
   API.JS — the only file that talks to Google Apps Script.
   Your deployment URL is hardcoded below.
   ============================================================ */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzmGzR7NmUfIZmdHLx5eISge-ywLwakBr6ugYY2-Le0wyoyqqnjGpUPqRvB3wk8Bbrh5A/exec';

// Actions that do NOT require a login token as their first parameter
const NO_TOKEN_ACTIONS = ['loginUser', 'requestPasswordReset'];

const Session = {
  KEY: 'lb_session',
  save(sessionData) { sessionStorage.setItem(this.KEY, JSON.stringify(sessionData)); },
  get() { const raw = sessionStorage.getItem(this.KEY); return raw ? JSON.parse(raw) : null; },
  clear() { sessionStorage.removeItem(this.KEY); },
  getToken() { const s = this.get(); return s ? s.token : null; },
  isLoggedIn() { return !!this.getToken(); }
};

async function rawApiCall(action, params) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // deliberate — avoids CORS preflight failure
    body: JSON.stringify({ action: action, params: params })
  });
  if (!response.ok) throw new Error('Network error (' + response.status + ')');
  return response.json();
}

/**
 * Main function every view will use to call the backend.
 * Usage: await api('getChecklistData', category, centreId, periodKey)
 * — token is automatically included, you never pass it yourself.
 */
// Any action starting with one of these prefixes performs a WRITE.
// If offline, we block it immediately with a clear message instead
// of letting the user believe it saved (or waiting on a doomed
// network request that fails anyway).
const WRITE_ACTION_PREFIXES = ['save','add','update','delete','deactivate','reset','create','approve','sendBack','review','rename','mark','set','edit','request'];

function isWriteAction(action) {
  return WRITE_ACTION_PREFIXES.some(function(p) { return action.indexOf(p) === 0; });
}

async function api(action, ...args) {
  if (!navigator.onLine && isWriteAction(action)) {
    showToast('You are offline — this action was NOT saved. Please reconnect and try again.', 'error');
    throw new Error('OFFLINE_BLOCKED');
  }

  let params = args;
  if (NO_TOKEN_ACTIONS.indexOf(action) === -1) {
    params = [Session.getToken(), ...args];
  }

  let result;
  try {
    result = await rawApiCall(action, params);
  } catch (networkErr) {
    showToast('Connection problem. Please check your internet and try again.', 'error');
    throw networkErr;
  }

  if (!result.success) {
    if (result.error === 'SESSION_EXPIRED') {
      Session.clear();
      showToast('Your session has expired. Please log in again.', 'error');
      loadView('login');
      throw new Error('SESSION_EXPIRED');
    }
    if (result.error === 'PERMISSION_DENIED') {
      showToast('You do not have permission to do that.', 'error');
    } else if (result.error === 'INCORRECT_PASSWORD') {
      showToast('Incorrect password.', 'error');
    } else {
      showToast(result.error || 'Something went wrong. Please try again.', 'error');
    }
    throw new Error(result.error);
  }

  return result.data;
}

/* ============================================================
   AUSTRALIAN DATE FORMATTING — used by every view for consistency
   with the server-side format (dd/MM/yyyy).
   ============================================================ */

function formatDateAU(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value.toString();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
}

function formatDateTimeAU(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const datePart = formatDateAU(value);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return datePart + ', ' + hours + ':' + minutes + ampm;
}

/* ============================================================
   CLIENT-SIDE CACHE — rarely-changing reference data (centre
   list, master item library) is fetched once per session, not
   re-fetched on every tab switch. Fixes performance gap.
   ============================================================ */

const ReferenceCache = { centres: null, masterLibrary: {} };

async function getCachedCentres() {
  if (!ReferenceCache.centres) {
    ReferenceCache.centres = await api('getActiveCentresSorted');
  }
  return ReferenceCache.centres;
}

async function getCachedMasterItems(category, centreId) {
  const cacheKey = category + '_' + centreId;
  if (!ReferenceCache.masterLibrary[cacheKey]) {
    ReferenceCache.masterLibrary[cacheKey] = await api('getMasterItemsForCentre', category, centreId);
  }
  return ReferenceCache.masterLibrary[cacheKey];
}

function clearReferenceCache() {
  ReferenceCache.centres = null;
  ReferenceCache.masterLibrary = {};
}
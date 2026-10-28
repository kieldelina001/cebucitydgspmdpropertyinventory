/* =========================================================================
   🖨️ PRINT QUEUE
   Workflow:  search → "+ Queue" → search something else → "+ Queue" → Print

   How it works (the standard "shopping basket" pattern):
   • The queue is its own list, completely separate from the table filters, so
     searching / resetting / paging never loses it.
   • Items are identified by their Article no./TCT no. (NOT the row index, which
     changes every time the sheet reloads). The live row is looked up again at
     print time, so the report always uses fresh data.
   • A floating button shows the live count. It opens a drawer where you can
     review, re-order, remove, clear (with Undo) and finally Print / Download.
   • Saved in sessionStorage → survives a page refresh, disappears when the tab
     is closed (safer on shared office computers).

   Depends on globals from script.js: inventoryData, currentFilteredData,
   headerMapping, downloadSearchedHTML, getDirectImageUrl, escapeHtml,
   showToast, removeToast.
   ========================================================================= */
(function () {
    'use strict';

    const STORE_KEY = 'printQueue.v1';
    const $ = id => document.getElementById(id);

    let queue = [];          // ordered: [{ key, article, description }]
    let lastCleared = null;  // snapshot used by "Undo"
    let busy = false;
    let drawerOpen = false;
    let lastFocus = null;

    // ------------------------------------------------------------------ data helpers
    function field(row, name) {
        const k = headerMapping && headerMapping[name];
        return k ? String(row[k] || '').trim() : '';
    }
    const articleOf = row => field(row, 'article/item');
    const keyOf = row => articleOf(row) || ('row-' + row._rowId);

    const has = key => queue.some(q => q.key === key);

    function add(row) {
        const key = keyOf(row);
        if (has(key)) return false;
        queue.push({ key: key, article: articleOf(row) || key, description: field(row, 'description') });
        return true;
    }
    function removeKey(key) {
        const i = queue.findIndex(q => q.key === key);
        if (i < 0) return false;
        queue.splice(i, 1);
        return true;
    }
    function toggle(row) {
        if (!removeKey(keyOf(row))) add(row);
        changed(true);
    }

    // key -> live row (first match wins)
    function liveMap() {
        const m = new Map();
        (typeof inventoryData !== 'undefined' ? inventoryData : []).forEach(r => {
            const k = keyOf(r);
            if (!m.has(k)) m.set(k, r);
        });
        return m;
    }
    function resolve() {
        const live = liveMap();
        const rows = [];
        let missing = 0;
        queue.forEach(q => { const r = live.get(q.key); if (r) rows.push(r); else missing++; });
        return { rows: rows, missing: missing, live: live };
    }

    // ------------------------------------------------------------------ persistence
    function load() {
        try {
            const raw = sessionStorage.getItem(STORE_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            queue = Array.isArray(arr) ? arr.filter(x => x && x.key) : [];
        } catch (e) { queue = []; }
    }
    function save() {
        try { sessionStorage.setItem(STORE_KEY, JSON.stringify(queue)); } catch (e) { /* private mode etc. */ }
    }

    // ------------------------------------------------------------------ table integration
    // Called by renderTable() for every row: adds the "+ Queue" cell as the first column.
    function decorateRow(tr, row) {
        const td = document.createElement('td');
        td.className = 'pq-cell';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pq-btn';
        btn.dataset.key = keyOf(row);
        btn.setAttribute('aria-label', 'Print queue: ' + (articleOf(row) || 'this item'));
        paint(btn, has(btn.dataset.key));
        btn.addEventListener('click', e => { e.stopPropagation(); toggle(row); }); // don't open the details popup
        td.addEventListener('click', e => e.stopPropagation());
        td.appendChild(btn);
        tr.insertBefore(td, tr.firstChild);
    }
    // Called by renderHeaders(): puts an "Add all" button under the "Queue" heading
    function decorateHeader(headerRow, getRows) {
        const th = headerRow && headerRow.firstElementChild;
        if (!th) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pq-all';
        btn.textContent = '＋ Add all results';
        btn.title = 'Add every record in the table below to the print queue';
        btn.addEventListener('click', () => queueAllResults(getRows));
        th.appendChild(btn);
    }
    function paint(btn, on) {
        const txt = on ? '✓ Queued' : '＋ Queue';
        if (btn.textContent !== txt) btn.textContent = txt;
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.title = on ? 'In the print queue — click to remove' : 'Add to the print queue';
    }
    function syncButtons() {
        document.querySelectorAll('#tableBody .pq-btn, #insBody .pq-btn').forEach(b => paint(b, has(b.dataset.key)));
    }

    function queueAllResults(getRows) {
        const rows = (typeof getRows === 'function' ? getRows() : (typeof currentFilteredData !== 'undefined' && currentFilteredData)) || [];
        if (!rows.length) { showToast('Nothing to add yet — run a search first.', 'warning'); return; }
        if (rows.length > 150 && !confirm('Add all ' + rows.length + ' results to the print queue?')) return;
        let added = 0;
        rows.forEach(r => { if (add(r)) added++; });
        changed(true);
        if (added) showToast('Added ' + added + ' item' + (added === 1 ? '' : 's') + ' to the print queue (' + queue.length + ' total).', 'success');
        else showToast('All of these results are already in the print queue.', 'info');
    }

    // ------------------------------------------------------------------ state change
    function changed(bump) {
        save();
        syncButtons();
        renderBadge(bump);
        if (drawerOpen) renderDrawer();
    }
    function renderBadge(bump) {
        const fab = $('pqFab');
        if (!fab) return;
        $('pqBadge').textContent = queue.length;
        fab.classList.toggle('has-items', queue.length > 0);
        fab.classList.toggle('pq-hidden', queue.length === 0); // only show the button when something is queued
        fab.setAttribute('aria-label', 'Open print queue, ' + queue.length + (queue.length === 1 ? ' item' : ' items'));
        if (bump) { fab.classList.remove('bump'); void fab.offsetWidth; fab.classList.add('bump'); }
    }

    // ------------------------------------------------------------------ drawer
    function thumbFor(row) {
        if (!row) return '';
        const keys = ['photo 1', 'photo 2', 'map coordinates', 'tax declaration'];
        for (let i = 0; i < keys.length; i++) {
            const v = field(row, keys[i]);
            if (v) { const u = getDirectImageUrl(v, 'view'); if (u) return u + '=w96-h96-c'; }
        }
        return '';
    }

    function renderDrawer() {
        const n = queue.length;
        $('pqSub').textContent = n ? n + (n === 1 ? ' item' : ' items') + ' · prints in this order' : 'Nothing queued yet';
        ['pqDownload', 'pqClear'].forEach(id => { $(id).disabled = !n || busy; });

        const list = $('pqList');
        const st = list.scrollTop;
        if (!n) {
            list.innerHTML =
                '<div class="pq-empty"><div class="pq-empty-ic">🖨️</div><b>Your print queue is empty</b>' +
                '<span>Search for an item and press <em>＋ Queue</em> on its row. Search for another and add it too — ' +
                'the queue keeps everything until you print.</span></div>';
            return;
        }
        const live = liveMap();
        list.innerHTML = '<ol class="pq-ol">' + queue.map((q, i) => {
            const row = live.get(q.key);
            const desc = row ? field(row, 'description') : q.description;
            const th = thumbFor(row);
            return '<li class="pq-item' + (row ? '' : ' stale') + '" data-key="' + escapeHtml(q.key) + '">' +
                '<span class="pq-n">' + (i + 1) + '</span>' +
                '<span class="pq-thumb">' + (th ? '<img loading="lazy" decoding="async" alt="" src="' + escapeHtml(th) + '" onerror="this.remove()">' : '') + '</span>' +
                '<div class="pq-meta"><b>' + escapeHtml(q.article) + '</b>' +
                '<span>' + escapeHtml(desc || '—') + '</span>' +
                (row ? '<button type="button" class="pq-view" data-act="view" title="Open Property Details for this item">🔍 View details</button>'
                     : '<em>Not in the current data — will be skipped</em>') + '</div>' +
                '<div class="pq-ctl">' +
                '<button type="button" data-act="up" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
                '<button type="button" data-act="down" aria-label="Move down"' + (i === n - 1 ? ' disabled' : '') + '>▼</button>' +
                '<button type="button" data-act="rm" class="rm" aria-label="Remove from queue">&times;</button>' +
                '</div></li>';
        }).join('') + '</ol>';
        list.scrollTop = st;
    }

    function openDrawer() {
        if (drawerOpen) return;
        drawerOpen = true;
        lastFocus = document.activeElement;
        renderDrawer();
        $('pqDrawer').classList.add('open');
        $('pqScrim').classList.add('open');
        $('pqDrawer').setAttribute('aria-hidden', 'false');
        $('pqFab').setAttribute('aria-expanded', 'true');
        setTimeout(() => { const c = $('pqClose'); if (c) c.focus(); }, 50);
    }
    function closeDrawer() {
        if (!drawerOpen) return;
        drawerOpen = false;
        $('pqDrawer').classList.remove('open');
        $('pqScrim').classList.remove('open');
        $('pqDrawer').setAttribute('aria-hidden', 'true');
        $('pqFab').setAttribute('aria-expanded', 'false');
        if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    }

    function onListClick(e) {
        const b = e.target.closest('button[data-act]');
        if (!b) return;
        const li = b.closest('.pq-item');
        const key = li && li.dataset.key;
        const i = queue.findIndex(q => q.key === key);
        if (i < 0) return;
        const act = b.dataset.act;
        if (act === 'view') {
            const row = liveMap().get(key);
            if (row && typeof openPopUp === 'function') openPopUp(row._rowId);   // drawer stays open underneath
            else showToast('This item is no longer in the current data.', 'warning');
            return;
        }
        if (act === 'rm') queue.splice(i, 1);
        else if (act === 'up' && i > 0) { const t = queue[i - 1]; queue[i - 1] = queue[i]; queue[i] = t; }
        else if (act === 'down' && i < queue.length - 1) { const t = queue[i + 1]; queue[i + 1] = queue[i]; queue[i] = t; }
        changed(false);
        // keep keyboard focus on the same control after the list re-renders
        if (act !== 'rm') {
            const again = $('pqList').querySelector('.pq-item[data-key="' + CSS.escape(key) + '"] [data-act="' + act + '"]');
            if (again && !again.disabled) again.focus();
        }
    }

    function clearAll() {
        if (!queue.length) return;
        lastCleared = queue.slice();
        queue = [];
        changed(false);
        const t = showToast('Print queue cleared.', 'info', 9000);
        if (t) {
            const u = document.createElement('button');
            u.type = 'button';
            u.className = 'pq-undo';
            u.textContent = 'Undo';
            u.addEventListener('click', () => {
                if (lastCleared) { queue = lastCleared; lastCleared = null; changed(true); }
                if (typeof removeToast === 'function') removeToast(t);
            });
            t.querySelector('.ux-toast-msg').appendChild(u);
        }
    }

    // ------------------------------------------------------------------ print / export
    // IMPORTANT: this must call downloadSearchedHTML synchronously from the click,
    // otherwise the browser treats window.open() as an unwanted pop-up.
    async function run(mode) {
        if (busy) return;
        const res = resolve();
        if (!res.rows.length) {
            showToast(queue.length
                ? 'None of the queued items exist in the current data. Reload the data and try again.'
                : 'The print queue is empty.', 'warning');
            return;
        }
        busy = true;
        closeDrawer();
        try {
            if (res.missing) showToast(res.missing + ' queued item' + (res.missing === 1 ? ' is' : 's are') + ' no longer in the data and will be skipped.', 'warning');
            await downloadSearchedHTML(res.rows, mode);
        } catch (err) {
            console.error(err);
            showToast('Could not build the report: ' + (err && err.message ? err.message : err), 'error');
        } finally {
            busy = false;
        }
    }

    // ------------------------------------------------------------------ UI build
    const STYLES = `
    #inventoryTable thead th:first-child, #inventoryTable td.pq-cell, #insTable thead th:first-child, #insTable td.pq-cell { width: 108px; min-width: 108px; max-width: 108px; text-align: center; padding: 8px 6px; }
    #inventoryTable thead th:first-child, #insTable thead th:first-child { vertical-align: middle; }
    #insTable thead th:first-child { cursor: default; }
    .pq-all { display: block; margin: 6px auto 0; padding: 4px 8px; border: 1px solid rgba(255,255,255,.5); border-radius: 999px; background: rgba(255,255,255,.14); color: #fff; font: 600 10.5px Inter, 'Segoe UI', sans-serif; letter-spacing: .2px; text-transform: none; white-space: nowrap; cursor: pointer; transition: background .15s, color .15s; }
    .pq-all:hover { background: #fff; color: var(--navy-800); }
    .pq-btn { font: 600 12px Inter, 'Segoe UI', sans-serif; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--blue-400); background: #fff; color: var(--blue-600); cursor: pointer; white-space: nowrap; transition: background .15s, color .15s, border-color .15s, transform .12s; }
    .pq-btn:hover { background: var(--blue-100); }
    .pq-btn:active { transform: scale(.95); }
    .pq-btn.on { background: var(--green); border-color: var(--green); color: #fff; }
    .pq-btn.on:hover { background: #15803d; border-color: #15803d; }
    @media (max-width: 768px) { .export-group { flex-wrap: wrap; } .export-group .export-btn { flex: 1 1 45%; width: auto; } }

    #pqFab { position: fixed; left: 28px; bottom: 28px; z-index: 9999; display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 14px 0 18px; border: none; border-radius: 999px; background: linear-gradient(180deg, var(--navy-700), var(--navy-900)); color: #fff; font: 600 13px Inter, 'Segoe UI', sans-serif; letter-spacing: .3px; cursor: pointer; box-shadow: var(--shadow-md); transition: transform .2s ease, box-shadow .2s ease; }
    #pqFab.pq-hidden { display: none; }
    #pqFab:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
    #pqFab .pq-badge { min-width: 26px; height: 26px; padding: 0 8px; box-sizing: border-box; border-radius: 999px; background: rgba(255,255,255,.18); font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
    #pqFab.has-items .pq-badge { background: var(--amber); color: #3b2a04; }
    #pqFab.bump .pq-badge { animation: pqBump .35s ease; }
    @keyframes pqBump { 0% { transform: scale(1); } 40% { transform: scale(1.4); } 100% { transform: scale(1); } }
    @media (max-width: 600px) { #pqFab { left: 16px; bottom: 16px; } #pqFab .pq-fab-label { display: none; } #pqFab { padding: 0 10px; } }

    #pqScrim { position: fixed; inset: 0; z-index: 100040; background: rgba(11,31,58,.45); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); opacity: 0; visibility: hidden; transition: opacity .22s ease, visibility 0s .22s; }
    #pqScrim.open { opacity: 1; visibility: visible; transition: opacity .22s ease, visibility 0s; }
    #pqDrawer { position: fixed; top: 0; bottom: 0; left: 0; z-index: 100050; width: 440px; max-width: 100vw; display: flex; flex-direction: column; background: #f8fafc; box-shadow: var(--shadow-lg); font-family: Inter, 'Segoe UI', Arial, sans-serif; color: var(--ink-900); transform: translateX(-100%); visibility: hidden; transition: transform .28s cubic-bezier(.16,1,.3,1), visibility 0s .28s; }
    #pqDrawer.open { transform: none; visibility: visible; transition: transform .28s cubic-bezier(.16,1,.3,1), visibility 0s; }
    #pqDrawer .pq-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px 16px; color: #fff; background: linear-gradient(135deg, var(--navy-900), var(--navy-700)); }
    #pqDrawer .pq-head h3 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -.01em; }
    #pqDrawer .pq-head p { margin: 3px 0 0; font-size: 12.5px; color: #b9cdea; }
    #pqDrawer .pq-x { width: 34px; height: 34px; border: none; border-radius: 50%; background: rgba(255,255,255,.14); color: #fff; font-size: 22px; line-height: 1; cursor: pointer; transition: background .15s; }
    #pqDrawer .pq-x:hover { background: rgba(255,255,255,.28); }
    #pqDrawer .pq-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 14px 16px; }
    #pqDrawer .pq-ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    #pqDrawer .pq-item { display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 8px; background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow-sm); }
    #pqDrawer .pq-item.stale { background: #fffbeb; border-color: #fde7a8; }
    #pqDrawer .pq-n { flex: none; width: 24px; text-align: center; font-size: 12px; font-weight: 800; color: var(--ink-400); font-variant-numeric: tabular-nums; }
    #pqDrawer .pq-thumb { flex: none; width: 44px; height: 44px; border-radius: 8px; background: var(--blue-50); border: 1px solid var(--line); overflow: hidden; }
    #pqDrawer .pq-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    #pqDrawer .pq-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    #pqDrawer .pq-meta b { font-size: 13.5px; color: var(--navy-900); overflow-wrap: anywhere; }
    #pqDrawer .pq-meta span { font-size: 12px; color: var(--ink-500); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    #pqDrawer .pq-meta em { font-size: 11.5px; font-style: normal; font-weight: 600; color: #b45309; }
    #pqDrawer .pq-ctl { flex: none; display: flex; gap: 4px; }
    #pqDrawer .pq-ctl button { width: 28px; height: 28px; padding: 0; border: 1px solid var(--line-strong); border-radius: 8px; background: #fff; color: var(--ink-700); font-size: 11px; cursor: pointer; transition: background .12s, color .12s; }
    #pqDrawer .pq-ctl button:hover:not(:disabled) { background: var(--blue-100); }
    #pqDrawer .pq-ctl button:disabled { opacity: .35; cursor: default; }
    #pqDrawer .pq-ctl .rm { font-size: 18px; line-height: 1; color: var(--red); border-color: #fca5a5; }
    #pqDrawer .pq-ctl .rm:hover { background: #fee2e2 !important; }
    #pqDrawer .pq-meta .pq-view { align-self: flex-start; margin-top: 4px; padding: 3px 10px; border: 1px solid var(--blue-400); border-radius: 999px; background: #fff; color: var(--blue-600); font: 600 11.5px Inter, 'Segoe UI', sans-serif; cursor: pointer; transition: background .15s; }
    #pqDrawer .pq-meta .pq-view:hover { background: var(--blue-100); }
    /* Property Details must open ABOVE the queue drawer (drawer is 100050; the upload window is 100100) */
    .modal-overlay { z-index: 100060 !important; }
    #pqDrawer .pq-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 54px 22px; text-align: center; color: var(--ink-500); font-size: 13px; line-height: 1.55; }
    #pqDrawer .pq-empty b { color: var(--navy-900); font-size: 15px; }
    #pqDrawer .pq-empty-ic { font-size: 38px; margin-bottom: 4px; }
    #pqDrawer .pq-foot { display: flex; gap: 10px; flex-wrap: wrap; padding: 14px 16px; background: #fff; border-top: 1px solid var(--line); }
    #pqDrawer .pq-act { flex: 1 1 auto; height: 42px; padding: 0 16px; border-radius: 10px; border: 1px solid transparent; font: 700 13px Inter, 'Segoe UI', sans-serif; cursor: pointer; transition: transform .12s, box-shadow .15s, background .15s; }
    #pqDrawer .pq-act:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-md); }
    #pqDrawer .pq-act:disabled { opacity: .45; cursor: not-allowed; }
    #pqDrawer .pq-act.primary { flex: 2 1 160px; background: linear-gradient(180deg, #22c55e, var(--green)); color: #fff; }
    #pqDrawer .pq-act.ghost { background: #fff; color: var(--blue-600); border-color: var(--blue-400); }
    #pqDrawer .pq-act.danger { background: #fff; color: var(--red); border-color: #fca5a5; }
    .pq-undo { margin-left: 10px; padding: 2px 10px; border: 1px solid var(--blue-400); border-radius: 999px; background: #fff; color: var(--blue-600); font: 700 12px Inter, sans-serif; cursor: pointer; }
    .pq-undo:hover { background: var(--blue-100); }
    @media (prefers-reduced-motion: reduce) { #pqDrawer, #pqScrim, #pqFab, .pq-btn { transition: none !important; } #pqFab.bump .pq-badge { animation: none; } }
    `;

    function build() {
        const style = document.createElement('style');
        style.textContent = STYLES;
        document.head.appendChild(style);

        // Mounted inside #mainApp so it automatically hides on the login screen / after logout
        const host = $('mainApp') || document.body;

        const fab = document.createElement('button');
        fab.id = 'pqFab';
        fab.type = 'button';
        fab.setAttribute('aria-haspopup', 'dialog');
        fab.setAttribute('aria-expanded', 'false');
        fab.innerHTML = '<span aria-hidden="true">🖨️</span><span class="pq-fab-label">Print Queue</span><span class="pq-badge" id="pqBadge">0</span>';
        host.appendChild(fab);

        const scrim = document.createElement('div');
        scrim.id = 'pqScrim';
        host.appendChild(scrim);

        const drawer = document.createElement('aside');
        drawer.id = 'pqDrawer';
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-modal', 'true');
        drawer.setAttribute('aria-labelledby', 'pqTitle');
        drawer.setAttribute('aria-hidden', 'true');
        drawer.innerHTML =
            '<div class="pq-head"><div><h3 id="pqTitle">Print Queue</h3><p id="pqSub"></p></div>' +
            '<button type="button" class="pq-x" id="pqClose" aria-label="Close print queue">&times;</button></div>' +
            '<div class="pq-body" id="pqList"></div>' +
            '<div class="pq-foot">' +
            '<button type="button" class="pq-act danger" id="pqClear">Clear all</button>' +
            '<button type="button" class="pq-act ghost" id="pqDownload">Download HTML</button>' +
            '</div>';
        host.appendChild(drawer);

        fab.addEventListener('click', () => (drawerOpen ? closeDrawer() : openDrawer()));
        scrim.addEventListener('click', closeDrawer);
        $('pqClose').addEventListener('click', closeDrawer);
        $('pqList').addEventListener('click', onListClick);
        $('pqClear').addEventListener('click', clearAll);
        $('pqDownload').addEventListener('click', () => run('download'));
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawerOpen) closeDrawer(); });
    }

    function init() {
        load();
        build();
        renderBadge(false);
    }

    window.PrintQueue = {
        decorateRow: decorateRow, decorateHeader: decorateHeader,
        add: add, toggle: toggle, remove: removeKey,
        open: openDrawer, close: closeDrawer,
        items: () => queue.slice(),
        count: () => queue.length
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

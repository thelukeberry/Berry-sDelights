// /js/admin.js
// Backoffice: stats dashboard, orders list with month filter, order detail
// with status-save dropdown, feedback browser.

import { $, fmt, show, hide, refreshIcons, toast } from "./ui.js";
import { loadAllOrders, updateOrderStatus, STATUSES, STATUS_LABELS,
         loadFeedbacks, loadSessionsStats } from "./orders.js";
import { FLAVORS } from "./cart.js";
import { ADMIN_EMAIL } from "./firebase.js";

const ADMIN_PASS = "LuBe25031997.";
const SK_ADMIN = "bd_admin_session_v1";

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (k) => { const [y, m] = k.split("-"); return `${MONTHS[+m - 1]} ${y}`; };

let _filter = "all";
let _activeView = "orders"; // "orders" | "feedback"

export function isAdminAuthed() { return localStorage.getItem(SK_ADMIN) === "1"; }
export function setAdminAuthed(v) {
  if (v) localStorage.setItem(SK_ADMIN, "1");
  else localStorage.removeItem(SK_ADMIN);
}

export function bindAdminUI() {
  $("#bo-entry")?.addEventListener("click", () => {
    if (isAdminAuthed()) openBackoffice();
    else { show("#bo-login"); setTimeout(() => $("#bo-user")?.focus(), 50); }
  });
  $("#bo-login-close")?.addEventListener("click", () => {
    hide("#bo-login"); $("#bo-pass").value = ""; hide("#bo-login-err");
  });
  $("#bo-login-btn")?.addEventListener("click", tryLogin);
  $("#bo-pass")?.addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });
  $("#bo-logout")?.addEventListener("click", () => {
    setAdminAuthed(false); hide("#backoffice"); hide("#bo-detail"); document.body.style.overflow = "";
  });
  $("#bo-detail-back")?.addEventListener("click", () => { hide("#bo-detail"); show("#backoffice"); });

  // View toggles
  $("#bo-tab-orders")?.addEventListener("click", () => switchView("orders"));
  $("#bo-tab-feedback")?.addEventListener("click", () => switchView("feedback"));
}

function tryLogin() {
  const u = ($("#bo-user").value || "").trim().toLowerCase();
  const p = $("#bo-pass").value || "";
  if (u === ADMIN_EMAIL.toLowerCase() && p === ADMIN_PASS) {
    setAdminAuthed(true);
    hide("#bo-login"); $("#bo-pass").value = ""; hide("#bo-login-err");
    openBackoffice();
  } else {
    show("#bo-login-err");
    $("#bo-pass").classList.add("error");
    setTimeout(() => $("#bo-pass").classList.remove("error"), 1200);
  }
}

async function openBackoffice() {
  show("#backoffice");
  document.body.style.overflow = "hidden";
  await render();
  refreshIcons();
}

function switchView(v) {
  _activeView = v;
  $("#bo-tab-orders")?.classList.toggle("active", v === "orders");
  $("#bo-tab-feedback")?.classList.toggle("active", v === "feedback");
  toggle("#bo-view-orders", v === "orders");
  toggle("#bo-view-feedback", v === "feedback");
  render();
}

function toggle(sel, visible) {
  const el = typeof sel === "string" ? $(sel) : sel;
  if (el) el.classList.toggle("hidden", !visible);
}

async function render() {
  const [orders, feedbacks, sessions] = await Promise.all([
    loadAllOrders(), loadFeedbacks(), loadSessionsStats(),
  ]);
  renderStats(orders, sessions, feedbacks);
  if (_activeView === "orders")   renderOrdersList(orders);
  if (_activeView === "feedback") renderFeedbackList(feedbacks);
}

function renderStats(orders, sessions, feedbacks) {
  const totalOrders  = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + (o?.pricing?.grandTotal  || 0), 0);
  const totalSavings = orders.reduce((s, o) => s + (o?.pricing?.totalDiscount || 0), 0);

  // Best-selling flavor (renner)
  const flavorTotals = { chocolate: 0, vanilla: 0, caramel: 0 };
  orders.forEach(o => {
    flavorTotals.chocolate += o?.qty?.chocolate || 0;
    flavorTotals.vanilla   += o?.qty?.vanilla   || 0;
    flavorTotals.caramel   += o?.qty?.caramel   || 0;
  });
  const sortedFlavors = Object.entries(flavorTotals).sort((a, b) => b[1] - a[1]);
  const topName = sortedFlavors[0]?.[0] ? (FLAVORS.find(f => f.id === sortedFlavors[0][0])?.name || "—") : "—";

  // Status breakdown
  const byStatus = {};
  STATUSES.forEach(s => byStatus[s] = 0);
  orders.forEach(o => { byStatus[o.paymentStatus || "zahlung_ausstehend"] = (byStatus[o.paymentStatus || "zahlung_ausstehend"] || 0) + 1; });

  const avgMin = sessions.avgDurationMs ? Math.round(sessions.avgDurationMs / 60_000 * 10) / 10 : 0;
  const totalVisits = sessions.totalSessions || 0;
  const totalPints = flavorTotals.chocolate + flavorTotals.vanilla + flavorTotals.caramel;
  const avgOrderValue = totalOrders ? (totalRevenue / totalOrders) : 0;

  const html = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${statCard("Bestellungen", totalOrders, "shopping-bag")}
      ${statCard("Umsatz", fmt(totalRevenue), "trending-up")}
      ${statCard("Rabatte ausgegeben", fmt(totalSavings), "percent")}
      ${statCard("Ø Warenkorb", fmt(avgOrderValue), "calculator")}
      ${statCard("Besucher (Sessions)", totalVisits, "users")}
      ${statCard("Ø Verweildauer", avgMin + " Min", "clock")}
      ${statCard("Pints insgesamt", totalPints, "ice-cream-cone")}
      ${statCard("Feedbacks", feedbacks.length, "message-square")}
    </div>

    <div class="mt-5 rounded-2xl bg-white border border-espresso/8 p-4 shadow-soft">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-display text-base font-semibold">Renner-Penner Liste</h3>
        <span class="text-[10px] uppercase tracking-widest text-espresso/55">Sorten</span>
      </div>
      <ol class="space-y-2">
        ${sortedFlavors.map(([id, n], i) => {
          const fl = FLAVORS.find(f => f.id === id);
          return `<li class="flex items-center justify-between text-sm">
            <span><strong class="text-berry">${i + 1}.</strong> ${fl ? fl.name : id}</span>
            <span class="font-semibold tabular-nums">${n}× verkauft</span>
          </li>`;
        }).join("")}
      </ol>
      <p class="mt-2 text-xs text-espresso/55">🏆 Top-Sorte: <strong>${topName}</strong></p>
    </div>

    <div class="mt-3 rounded-2xl bg-white border border-espresso/8 p-4 shadow-soft">
      <h3 class="font-display text-base font-semibold mb-3">Status-Übersicht</h3>
      <div class="grid grid-cols-2 gap-2 text-sm">
        ${STATUSES.map(s => `
          <div class="flex justify-between rounded-xl bg-cream/40 px-3 py-2">
            <span>${STATUS_LABELS[s]}</span>
            <span class="font-semibold tabular-nums">${byStatus[s] || 0}</span>
          </div>`).join("")}
      </div>
    </div>
  `;
  const wrap = $("#bo-stats");
  if (wrap) wrap.innerHTML = html;
}

function statCard(title, value, icon) {
  return `
    <div class="rounded-2xl bg-white border border-espresso/8 p-3 shadow-soft">
      <div class="flex items-center gap-2 text-[10px] uppercase tracking-widest text-espresso/55">
        <i data-lucide="${icon}" class="w-3 h-3"></i> ${title}
      </div>
      <div class="font-display text-xl font-semibold mt-1">${value}</div>
    </div>`;
}

function renderOrdersList(orders) {
  // Month filter
  const months = new Set();
  orders.forEach(o => { try { months.add(monthKey(new Date(o.timestamp))); } catch {} });
  const monthList = [...months].sort().reverse();

  const pills = [`<button class="filter-pill ${_filter === "all" ? "active" : ""}" data-filter="all">Alle (${orders.length})</button>`];
  monthList.forEach(k => {
    const count = orders.filter(o => monthKey(new Date(o.timestamp)) === k).length;
    pills.push(`<button class="filter-pill ${_filter === k ? "active" : ""}" data-filter="${k}">${monthLabel(k)} (${count})</button>`);
  });
  const filters = $("#bo-filters"); if (filters) filters.innerHTML = pills.join("");
  filters?.querySelectorAll("[data-filter]").forEach(b => {
    b.addEventListener("click", () => { _filter = b.dataset.filter; render(); });
  });

  // Filtered list
  let list = orders.slice();
  if (_filter !== "all") list = list.filter(o => monthKey(new Date(o.timestamp)) === _filter);

  const empty = $("#bo-empty"), boList = $("#bo-list");
  if (!list.length) { boList?.classList.add("hidden"); empty?.classList.remove("hidden"); return; }
  empty?.classList.add("hidden"); boList?.classList.remove("hidden");

  boList.innerHTML = list.map(o => {
    const d = new Date(o.timestamp);
    const dStr = d.toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const totalItems = (o.qty?.chocolate || 0) + (o.qty?.vanilla || 0) + (o.qty?.caramel || 0);
    const status = o.paymentStatus || "zahlung_ausstehend";
    return `
      <button class="order-card no-select w-full text-left" data-order-id="${o.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="text-[10px] uppercase tracking-widest text-espresso/55">${dStr}</div>
            <div class="font-display text-base font-semibold mt-0.5">${o.id} · ${o.name || "Gast"}</div>
            <div class="text-xs text-espresso/60 mt-1 truncate">${totalItems} Pint${totalItems === 1 ? "" : "s"} · ${o.email || "—"}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="font-display text-lg font-semibold">${(o.pricing?.grandTotal || 0).toFixed(2)}</div>
            <div class="text-[10px] uppercase tracking-widest text-espresso/55">CHF</div>
            <div class="mt-1 status-pill status-${status.replace(/_/g, "-")}">${STATUS_LABELS[status] || status}</div>
          </div>
        </div>
      </button>`;
  }).join("");

  boList.querySelectorAll("[data-order-id]").forEach(b => {
    b.addEventListener("click", () => showOrderDetail(b.dataset.orderId, orders));
  });
}

async function showOrderDetail(id, ordersCache) {
  const orders = ordersCache || await loadAllOrders();
  const o = orders.find(x => x.id === id);
  if (!o) return;
  const d = new Date(o.timestamp);
  const p = o.pricing || {};

  const itemRows = FLAVORS.filter(f => (o.qty?.[f.id] || 0) > 0).map(f => `
    <div class="flex justify-between text-sm py-1">
      <span>${o.qty[f.id]}× ${f.name}</span>
      <span class="text-espresso/70">${(o.qty[f.id] * 12).toFixed(2)} CHF</span>
    </div>`).join("");

  const discountRows = [];
  if (p.tenDiscount  > 0) discountRows.push(line("10er-Pack (10%)", -p.tenDiscount, "text-berry"));
  if (p.fiveDiscount > 0) discountRows.push(line("5er-Pack (5%)",   -p.fiveDiscount, "text-berry"));
  if (p.refDiscount  > 0 && o.referral) discountRows.push(line(`Empfehlung ${o.referral.code} (5%)`, -p.refDiscount, "text-berry"));
  if (p.tipAmount    > 0) discountRows.push(line("Trinkgeld", p.tipAmount, "text-espresso/60"));

  const statusButtons = STATUSES.map(s => `
    <option value="${s}" ${o.paymentStatus === s ? "selected" : ""}>${STATUS_LABELS[s]}</option>
  `).join("");

  $("#bo-detail-content").innerHTML = `
    <div class="rounded-2xl bg-white border border-espresso/8 p-5 shadow-card">
      <div class="text-[10px] uppercase tracking-widest text-espresso/55">${d.toLocaleString("de-CH")}</div>
      <h2 class="font-display text-2xl font-semibold mt-1">${o.id}</h2>
      <p class="text-espresso/70 text-sm mt-1">${o.name || "Gast"}</p>
    </div>

    <div class="mt-4 rounded-2xl bg-white border border-espresso/8 p-5 shadow-soft">
      <p class="text-[10px] uppercase tracking-widest text-espresso/55 mb-2">Kontakt</p>
      <div class="space-y-1.5 text-sm">
        <div class="flex items-center gap-2"><i data-lucide="user" class="w-4 h-4 text-espresso/55"></i><span>${o.name || "—"}</span></div>
        <div class="flex items-center gap-2"><i data-lucide="mail" class="w-4 h-4 text-espresso/55"></i><a class="underline" href="mailto:${o.email}">${o.email || "—"}</a></div>
        <div class="flex items-center gap-2"><i data-lucide="phone" class="w-4 h-4 text-espresso/55"></i><a class="underline" href="tel:${o.phone}">${o.phone || "—"}</a></div>
        ${o.userId === "guest" ? '<div class="mt-1 text-[10px] uppercase tracking-widest text-espresso/55">Gast-Bestellung</div>' : ""}
      </div>
    </div>

    ${o.notes ? `
    <div class="mt-4 rounded-2xl bg-blush/30 border border-berry/15 p-5 shadow-soft">
      <p class="text-[10px] uppercase tracking-widest text-berryd mb-2">Hinweise des Kunden</p>
      <p class="text-sm text-espresso/85 whitespace-pre-line">${escapeHtml(o.notes)}</p>
    </div>` : ""}

    <div class="mt-4 rounded-2xl bg-white border border-espresso/8 p-5 shadow-soft">
      <p class="text-[10px] uppercase tracking-widest text-espresso/55 mb-2">Artikel</p>
      ${itemRows || '<p class="text-sm text-espresso/55">Keine Artikel</p>'}
    </div>

    <div class="mt-4 rounded-2xl bg-white border border-espresso/8 p-5 shadow-soft">
      <p class="text-[10px] uppercase tracking-widest text-espresso/55 mb-2">Abrechnung</p>
      ${line("Zwischensumme", p.subtotal, "text-espresso/60")}
      ${discountRows.join("")}
      <div class="hairline my-3"></div>
      <div class="flex justify-between"><span class="font-display text-base">Total</span><span class="font-display text-lg font-semibold">${(p.grandTotal || 0).toFixed(2)} CHF</span></div>
    </div>

    ${o.referral ? `
    <div class="mt-4 rounded-2xl bg-white border border-espresso/8 p-5 shadow-soft">
      <p class="text-[10px] uppercase tracking-widest text-espresso/55 mb-2">Empfehlung</p>
      <div class="text-sm space-y-1">
        <div>Code: <strong>${o.referral.code}</strong> (${o.referral.percent}%)</div>
        ${o.referral.ownerUid ? `<div>Werber-UID: <code class="text-xs">${o.referral.ownerUid}</code></div>` : ""}
        <div>Bonus an Werber: <strong>${o.referral.bonusApplied ? "ausbezahlt ✓" : "wartet auf 'bezahlt'"}</strong></div>
      </div>
    </div>` : ""}

    <div class="mt-4 rounded-2xl bg-white border border-espresso/8 p-5 shadow-soft">
      <p class="text-[10px] uppercase tracking-widest text-espresso/55 mb-2">Status</p>
      <div class="flex gap-2 items-center">
        <select id="bo-status-select" class="input flex-1">${statusButtons}</select>
        <button id="bo-status-save" class="px-4 rounded-2xl btn-berry text-sm font-medium">Status Speichern</button>
      </div>
      <p id="bo-status-msg" class="hidden mt-2 text-xs text-berry"></p>
    </div>
  `;
  hide("#backoffice"); show("#bo-detail");
  window.scrollTo?.({ top: 0, behavior: "instant" });
  refreshIcons();

  $("#bo-status-save")?.addEventListener("click", async () => {
    const sel = $("#bo-status-select");
    const newS = sel.value;
    sel.disabled = true;
    try {
      await updateOrderStatus(o.id, newS);
      o.paymentStatus = newS;
      $("#bo-status-msg").innerHTML = `<span class="text-berry font-medium">✓ Gespeichert</span> · Status ist jetzt <strong>${STATUS_LABELS[newS]}</strong>`;
      show("#bo-status-msg");
      toast(`Status gespeichert: ${STATUS_LABELS[newS]}`, { color: "#8B1A3B" });
    } catch (e) {
      $("#bo-status-msg").textContent = "Speichern fehlgeschlagen: " + e.message;
      show("#bo-status-msg");
    } finally { sel.disabled = false; }
  });
}

function renderFeedbackList(items) {
  const wrap = $("#bo-feedback-list"); if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = `<div class="text-center py-10 text-sm text-espresso/55">Noch kein Feedback eingegangen.</div>`;
    return;
  }
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  wrap.innerHTML = items.map(f => {
    const d = new Date(f.createdAt);
    return `<div class="rounded-2xl bg-white border border-espresso/8 p-4 shadow-soft">
      <div class="flex items-start justify-between gap-3 mb-2">
        <div>
          <div class="text-[10px] uppercase tracking-widest text-espresso/55">${d.toLocaleString("de-CH")}</div>
          <div class="text-sm font-medium">${f.email || "Anonym"}</div>
          ${f.orderId ? `<div class="text-[10px] text-espresso/50">Bestellung ${f.orderId}</div>` : ""}
        </div>
        ${f.rating != null ? `<div class="text-lg">${stars(f.rating)}</div>` : ""}
      </div>
      <p class="text-sm text-espresso/80 whitespace-pre-line">${escapeHtml(f.text || "")}</p>
    </div>`;
  }).join("");
}

function stars(n) { n = Math.max(0, Math.min(5, Math.round(n))); return "★".repeat(n) + "☆".repeat(5 - n); }
function line(label, n, cls = "") { return `<div class="flex justify-between text-sm ${cls}"><span>${label}</span><span>${Number(n).toFixed(2)} CHF</span></div>`; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }

// /js/app.js
// Entry point. Wires modules to the DOM declared in index.html.
// Imported once via <script type="module" src="./js/app.js"></script>.

import { FB_READY } from "./firebase.js";
import { $, $$, fmt, show, hide, toast, refreshIcons,
         isEmailValid, validateSwissMobile, ERR } from "./ui.js";
import { state, FLAVORS, PRICE, REFERRAL_PCT,
         priceCart, saveCart, loadCart, clearCartItems, savingsToPints } from "./cart.js";
import { initAuth, onAuthChange, currentUser, registerCustomer, loginCustomer,
         logoutCustomer, verifyFromURL, getProfile, adjustReferralBonus } from "./auth.js";
import { bindReferralUI, handleRefURLParam } from "./referral.js";
import { STATUSES, STATUS_LABELS, serializeOrder, saveOrder,
         loadOrdersForUser, submitFeedback, startSessionTracking, startPresence } from "./orders.js";
import { bindAdminUI, isAdminAuthed } from "./admin.js";

// Defensive: stub lucide so other modules can call createIcons safely
if (!window.lucide || typeof window.lucide.createIcons !== "function") {
  window.lucide = { createIcons: () => {} };
}

// ════════════════════════════════════════════════════════════════
// FLAVOR CARDS
// ════════════════════════════════════════════════════════════════
function renderFlavors() {
  const grid = $("#flavor-grid"); if (!grid) return;
  grid.innerHTML = FLAVORS.map(f => `
    <article class="bg-white rounded-3xl p-4 shadow-card border border-espresso/5">
      <div class="flex gap-4 items-center">
        <div class="${f.gradient} rounded-2xl w-24 h-28 shrink-0 relative overflow-hidden flex items-center justify-center">
          <div class="pint"><div class="pint-label" style="color:${f.labelColor}">Berry's<small>${f.id.toUpperCase()}</small></div></div>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-display text-lg font-semibold leading-tight">${f.name}</h3>
          <p class="text-xs text-espresso/55 mt-0.5">${f.tagline}</p>
          <div class="mt-3 flex items-center justify-between gap-2">
            <span class="font-display text-base font-semibold">${fmt(PRICE)}</span>
            <div class="flex items-center gap-2">
              <button class="qty-btn" data-act="dec" data-id="${f.id}" aria-label="Weniger"><i data-lucide="minus" class="w-4 h-4"></i></button>
              <span class="count font-display text-lg font-semibold w-6 text-center" data-count="${f.id}">0</span>
              <button class="qty-btn primary" data-act="inc" data-id="${f.id}" aria-label="Mehr"><i data-lucide="plus" class="w-4 h-4"></i></button>
            </div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-3">
        <button class="pack-btn" data-pack="${f.id}" data-size="5"><i data-lucide="plus" class="w-4 h-4"></i><span>5er-Pack</span><span class="save">−5%</span></button>
        <button class="pack-btn" data-pack="${f.id}" data-size="10"><i data-lucide="plus" class="w-4 h-4"></i><span>10er-Pack</span><span class="save">−10%</span></button>
      </div>
    </article>`).join("");
  refreshIcons();

  grid.addEventListener("click", (e) => {
    const qbtn = e.target.closest("[data-act]");
    const pbtn = e.target.closest("[data-pack]");
    if (qbtn) {
      const id = qbtn.dataset.id, act = qbtn.dataset.act;
      if (act === "inc") state.qty[id]++;
      else if (act === "dec" && state.qty[id] > 0) state.qty[id]--;
      bump(id); renderAll();
    } else if (pbtn) {
      state.qty[pbtn.dataset.pack] += Number(pbtn.dataset.size) || 5;
      bump(pbtn.dataset.pack); renderAll();
    }
  });
}

function bump(id) {
  $$(`[data-count="${id}"]`).forEach(el => {
    el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 220);
  });
}

// ════════════════════════════════════════════════════════════════
// FULL CART RENDER
// ════════════════════════════════════════════════════════════════
function renderAll() {
  const p = priceCart();
  FLAVORS.forEach(f => $$(`[data-count="${f.id}"]`).forEach(el => el.textContent = state.qty[f.id]));

  toggle($("#cart-bar"), p.totalItems > 0);
  $("#cart-count")  && ($("#cart-count").textContent   = p.totalItems);
  $("#cart-summary")&& ($("#cart-summary").textContent = `${p.totalItems} ${p.totalItems === 1 ? "Pint" : "Pints"}`);
  $("#cart-total")  && ($("#cart-total").textContent   = fmt(p.grandTotal));

  toggle($("#cart-badge"), p.totalItems > 0);
  if (p.totalItems > 0 && $("#cart-badge")) $("#cart-badge").textContent = p.totalItems;

  toggle($("#cart-empty"), p.totalItems === 0);
  toggle($("#cart-detail"), p.totalItems > 0);

  if (p.totalItems > 0) {
    renderCartItems();
    renderSummary(p);
    renderExpress(p);
    renderTip(p);
  }
  saveCart();
}

function toggle(el, vis) { if (el) el.classList.toggle("hidden", !vis); }

function renderCartItems() {
  const wrap = $("#cart-items"); if (!wrap) return;
  wrap.innerHTML = FLAVORS.filter(f => state.qty[f.id] > 0).map(f => `
    <div class="flex items-center gap-3 bg-white rounded-2xl p-2.5 border border-espresso/8">
      <div class="${f.gradient} w-12 h-14 rounded-xl shrink-0"></div>
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm truncate">${f.name}</div>
        <div class="text-xs text-espresso/55 mt-0.5">${fmt(PRICE)} · Pint</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="qty-btn" data-act="dec" data-id="${f.id}"><i data-lucide="minus" class="w-4 h-4"></i></button>
        <span class="count w-5 text-center text-sm font-semibold" data-count="${f.id}">${state.qty[f.id]}</span>
        <button class="qty-btn primary" data-act="inc" data-id="${f.id}"><i data-lucide="plus" class="w-4 h-4"></i></button>
      </div>
    </div>`).join("");
  refreshIcons();
  wrap.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.id, act = b.dataset.act;
    if (act === "inc") state.qty[id]++;
    else if (act === "dec" && state.qty[id] > 0) state.qty[id]--;
    renderAll();
  }));
}

function renderSummary(p) {
  const lines = [];
  if (p.tens > 0)  lines.push(rowBadge("10er", `Choco ${p.packs.chocolate.tens}× · Vanilla ${p.packs.vanilla.tens}× · Caramel ${p.packs.caramel.tens}×`, "10%", -p.tenDiscount));
  if (p.fives > 0) lines.push(rowBadge("5er", `Choco ${p.packs.chocolate.fives}× · Vanilla ${p.packs.vanilla.fives}× · Caramel ${p.packs.caramel.fives}×`, "5%", -p.fiveDiscount));
  if (p.refDiscount > 0 && state.referral) lines.push(rowBadge("Buddy", state.referral.code, REFERRAL_PCT + "%", -p.refDiscount));
  const dl = $("#discount-lines"); if (dl) { dl.innerHTML = lines.join(""); dl.classList.toggle("hidden", lines.length === 0); }

  $("#subtotal").textContent   = fmt(p.subtotal);
  $("#grand-total").textContent = fmt(p.grandTotal);
  const dt = $("#discount-total-line");
  if (p.totalDiscount > 0) {
    dt?.classList.remove("hidden"); dt?.classList.add("flex");
    $("#discount-total").textContent = `−${p.totalDiscount.toFixed(2)} CHF`;
    show("#save-note"); $("#save-amount").textContent = p.totalDiscount.toFixed(2);
  } else {
    dt?.classList.add("hidden"); dt?.classList.remove("flex");
    hide("#save-note");
  }
  const tl = $("#tip-line");
  if (p.tipAmount > 0) { tl?.classList.remove("hidden"); tl?.classList.add("flex"); $("#tip-line-amount").textContent = fmt(p.tipAmount); }
  else { tl?.classList.add("hidden"); tl?.classList.remove("flex"); }
}
function rowBadge(label, detail, pct, delta) {
  return `<div class="flex items-center justify-between">
    <span class="flex items-center gap-2 min-w-0"><span class="badge badge-bundle">${label}</span><span class="text-espresso/65 text-xs truncate">${detail} · ${pct}</span></span>
    <span class="text-berry font-medium">${delta.toFixed(2)} CHF</span>
  </div>`;
}

function renderExpress(p) {
  const banner = $("#guest-banner");
  if (banner) banner.classList.toggle("hidden", !!currentUser() || p.totalItems === 0);
  const counter = $("#protein-counter"); if (counter) counter.classList.toggle("hidden", p.totalItems === 0);
  $("#pc-protein") && ($("#pc-protein").textContent = p.proteinG);
  $("#pc-savings") && ($("#pc-savings").textContent = (p.totalDiscount || 0).toFixed(2));
}

function renderTip(p) {
  $("#tip-amount").textContent = fmt(p.tipAmount);
  document.querySelectorAll(".tip-pill").forEach(b => {
    const v = b.dataset.tip;
    let active = false;
    if (v === "custom") active = state.tip.type === "fixed";
    else active = state.tip.type === "percent" && state.tip.value === Number(v);
    b.classList.toggle("active", active);
  });
}

// Tip pills
document.addEventListener("click", (e) => {
  const b = e.target.closest(".tip-pill"); if (!b) return;
  const v = b.dataset.tip;
  if (v === "custom") {
    state.tip = { type: "fixed", value: Number($("#tip-custom").value) || 0 };
    $("#tip-custom-wrap").classList.remove("hidden");
    setTimeout(() => $("#tip-custom")?.focus(), 50);
  } else {
    state.tip = { type: "percent", value: Number(v) };
    $("#tip-custom-wrap").classList.add("hidden"); $("#tip-custom").value = "";
  }
  renderAll();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "tip-custom") {
    state.tip = { type: "fixed", value: Number(e.target.value) || 0 }; renderAll();
  }
});

// ════════════════════════════════════════════════════════════════
// CART SHEET
// ════════════════════════════════════════════════════════════════
function openCart()  { $("#cart-sheet").classList.add("open");    document.body.style.overflow = "hidden"; }
function closeCart() { $("#cart-sheet").classList.remove("open"); document.body.style.overflow = ""; }
$("#open-cart")?.addEventListener("click", openCart);
$("#open-cart-top")?.addEventListener("click", openCart);
$("#close-cart")?.addEventListener("click", closeCart);
$("#cart-sheet")?.addEventListener("click", (e) => { if (e.target.id === "cart-sheet") closeCart(); });

// Customer form fields → state
["f-name","f-email","f-phone","f-notes"].forEach(id => {
  document.addEventListener("input", (e) => {
    if (e.target && e.target.id === id) {
      const k = id === "f-name" ? "name" : id === "f-email" ? "email" : id === "f-phone" ? "phone" : "notes";
      state.customer[k] = e.target.value;
      saveCart();
      e.target.classList.remove("error");
    }
  });
});

function hydrateForm() {
  if (state.customer.name)  $("#f-name").value  = state.customer.name;
  if (state.customer.email) $("#f-email").value = state.customer.email;
  if (state.customer.phone) $("#f-phone").value = state.customer.phone;
  if (state.customer.notes) $("#f-notes").value = state.customer.notes;
  if (state.referral?.code) $("#ref-input").value = state.referral.code;
  if (state.tip?.type === "fixed" && state.tip.value > 0) {
    $("#tip-custom").value = state.tip.value;
    $("#tip-custom-wrap").classList.remove("hidden");
  }
}

// ════════════════════════════════════════════════════════════════
// CHECKOUT (TWINT)
// ════════════════════════════════════════════════════════════════
const MERCHANT_TWINT = "+41 78 919 98 38";
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
function openTwintApp() {
  if (!isMobile) return;
  const a = document.createElement("a");
  a.href = "twint://"; a.style.display = "none";
  document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 100);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

$("#pay-twint")?.addEventListener("click", async () => {
  if (document.activeElement?.blur) document.activeElement.blur();

  const name  = state.customer.name = ($("#f-name").value || "").trim();
  const email = state.customer.email = ($("#f-email").value || "").trim().toLowerCase();
  const phone = ($("#f-phone").value || "").trim();
  const notes = state.customer.notes = ($("#f-notes").value || "").trim();

  let ok = true; const formErr = $("#form-err");
  formErr?.classList.add("hidden");
  if (!name)                { $("#f-name").classList.add("error");  ok = false; }
  if (!isEmailValid(email)) { $("#f-email").classList.add("error"); formErr.textContent = ERR.emailFormat; formErr.classList.remove("hidden"); ok = false; }
  const ph = validateSwissMobile(phone);
  if (!ph.ok)               { $("#f-phone").classList.add("error"); formErr.textContent = ph.error;       formErr.classList.remove("hidden"); ok = false; }
  if (!ok) return;
  state.customer.phone = ph.formatted;
  $("#f-phone").value = ph.formatted;
  saveCart();

  const p = priceCart();
  if (p.totalItems === 0) return;

  const btn = $("#pay-twint"); btn.disabled = true;
  openTwintApp();
  closeCart();
  await runPaymentAnimation(p);

  const user = currentUser();
  const order = serializeOrder({ user, customer: state.customer, pricing: p, qty: state.qty, referral: state.referral, tip: state.tip, notes });
  try { await saveOrder(order); } catch (e) { console.warn(e); }

  // If the customer used their own accumulated 5%-bonus, zero it out now
  if (user && user.uid && Number(user.referralBonusPercent) > 0 && state.referral && state.referral.code === user.refCode) {
    try { await adjustReferralBonus(user.uid, -Number(user.referralBonusPercent)); } catch {}
  }

  clearCartItems();
  hydrateForm();
  showConfirmation(order);
  btn.disabled = false;
});

async function runPaymentAnimation(p) {
  const ov = $("#pay-overlay"); ov.classList.remove("hidden"); ov.classList.add("flex");
  $("#pay-step-1").classList.remove("hidden");
  $("#pay-step-2").classList.add("hidden"); $("#pay-step-3").classList.add("hidden");
  $("#pay-step-3-amount").textContent = `${fmt(p.grandTotal)} an ${MERCHANT_TWINT}`;
  await sleep(1400); $("#pay-step-1").classList.add("hidden"); $("#pay-step-2").classList.remove("hidden");
  await sleep(1500); $("#pay-step-2").classList.add("hidden"); $("#pay-step-3").classList.remove("hidden");
  await sleep(1500); ov.classList.add("hidden"); ov.classList.remove("flex");
}

function showConfirmation(order) {
  show("#confirmation");
  document.body.style.overflow = "hidden";
  $("#conf-greeting").textContent = `Vielen Dank, ${(order.name || "").split(" ")[0] || "Champ"}!`;
  $("#conf-orderid").textContent  = order.id;
  $("#conf-items").innerHTML = FLAVORS.filter(f => order.qty[f.id] > 0).map(f => `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3"><div class="${f.gradient} w-8 h-9 rounded-md"></div><span>${order.qty[f.id]}× ${f.name}</span></div>
      <span class="text-espresso/70">${fmt(order.qty[f.id] * PRICE)}</span>
    </div>`).join("");
  const p = order.pricing;
  const disc = [];
  disc.push(`<div class="flex justify-between"><span class="text-espresso/60">Zwischensumme</span><span>${fmt(p.subtotal)}</span></div>`);
  if (p.tenDiscount  > 0) disc.push(`<div class="flex justify-between text-berry"><span>10er-Pack (10%)</span><span>−${p.tenDiscount.toFixed(2)} CHF</span></div>`);
  if (p.fiveDiscount > 0) disc.push(`<div class="flex justify-between text-berry"><span>5er-Pack (5%)</span><span>−${p.fiveDiscount.toFixed(2)} CHF</span></div>`);
  if (p.refDiscount  > 0 && order.referral) disc.push(`<div class="flex justify-between text-berry"><span>Empfehlung (${order.referral.percent}%)</span><span>−${p.refDiscount.toFixed(2)} CHF</span></div>`);
  if (p.tipAmount    > 0) disc.push(`<div class="flex justify-between"><span class="text-espresso/60">Trinkgeld</span><span>${fmt(p.tipAmount)}</span></div>`);
  $("#conf-discounts").innerHTML = disc.join("");
  $("#conf-total").textContent = fmt(p.grandTotal);
  $("#conf-status").innerHTML = `<span class="status-pill status-zahlung-ausstehend">Zahlung wird geprüft… ⏳</span>`;
  refreshIcons();

  // Feedback form (post-order)
  const fbWrap = $("#conf-feedback-wrap");
  if (fbWrap) {
    fbWrap.classList.remove("hidden");
    $("#conf-feedback-text").value = "";
    $("#conf-feedback-submit")?.addEventListener("click", async () => {
      const text = $("#conf-feedback-text").value;
      const ok = await submitFeedback({ orderId: order.id, email: order.email, text });
      if (ok) { fbWrap.innerHTML = `<div class="text-center text-sm text-berry py-3">💜 Merci fürs Feedback!</div>`; }
    }, { once: true });
  }
}

$("#new-order")?.addEventListener("click", () => {
  hide("#confirmation"); document.body.style.overflow = "";
  renderAll(); window.scrollTo({ top: 0, behavior: "smooth" });
});

// ════════════════════════════════════════════════════════════════
// AUTH UI (header → modal → portal)
// ════════════════════════════════════════════════════════════════
$("#open-account")?.addEventListener("click", () => {
  if (currentUser()) openPortal();
  else { show("#cust-auth"); switchAuthTab("login"); setTimeout(() => $("#login-email")?.focus(), 50); }
});
$("#cust-auth-close")?.addEventListener("click", () => { hide("#cust-auth"); });
$("#cust-auth")?.addEventListener("click", (e) => { if (e.target.id === "cust-auth") hide("#cust-auth"); });
$("#tab-login")?.addEventListener("click", () => switchAuthTab("login"));
$("#tab-register")?.addEventListener("click", () => switchAuthTab("register"));

function switchAuthTab(which) {
  const isLogin = which === "login";
  $("#tab-login")?.classList.toggle("active", isLogin);
  $("#tab-register")?.classList.toggle("active", !isLogin);
  $("#form-login")?.classList.toggle("hidden", !isLogin);
  $("#form-register")?.classList.toggle("hidden", isLogin);
  hide("#verify-prompt"); hide("#login-err"); hide("#login-not-verified"); hide("#reg-err");
}

$("#form-register")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#reg-err"); hide(err);
  try {
    const res = await registerCustomer({
      firstName:       $("#reg-firstname").value,
      email:           $("#reg-email").value,
      password:        $("#reg-pass").value,
      passwordConfirm: $("#reg-pass2").value,
    });
    hide("#form-register"); show("#verify-prompt");
    const msg = $("#verify-msg");
    if (res.verifyEmailSent) msg.textContent = `Bestätigungs-Mail an ${$("#reg-email").value} versendet. Klick den Link, dann kannst du dich anmelden.`;
    else {
      msg.innerHTML = `Lokaler Modus: keine echte E-Mail. Aktiviere mit diesem Link direkt:`;
      $("#verify-manual-link").href = res.manualLink;
      $("#verify-manual-link").textContent = res.manualLink;
      show("#verify-manual-wrap");
    }
  } catch (e2) { err.textContent = e2.message || "Registrierung fehlgeschlagen."; show(err); }
});

$("#form-login")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#login-err"); const nv = $("#login-not-verified");
  hide(err); hide(nv);
  try {
    await loginCustomer({ email: $("#login-email").value, password: $("#login-pass").value });
    hide("#cust-auth");
    openPortal();
  } catch (e2) {
    if (e2.code === "NOT_VERIFIED") show(nv);
    else { err.textContent = e2.message || "Anmeldung fehlgeschlagen."; show(err); }
  }
});

$("#cust-logout")?.addEventListener("click", async () => {
  await logoutCustomer(); hide("#cust-portal"); document.body.style.overflow = "";
});
$("#cust-close")?.addEventListener("click", () => { hide("#cust-portal"); document.body.style.overflow = ""; });

async function openPortal() {
  const u = currentUser(); if (!u) return;
  show("#cust-portal"); document.body.style.overflow = "hidden";
  await renderPortal(u);
  refreshIcons();
}

async function renderPortal(u) {
  // Pull profile (firstName, refCode, accumulated bonus)
  const prof = await getProfile(u.uid) || {};
  const firstName = prof.firstName || (state.customer.name || "").split(" ")[0] || "Champ";
  $("#cust-greeting").textContent = `Hey ${firstName}!`;
  $("#cust-email").textContent = u.email;

  const orders = await loadOrdersForUser(u.uid !== "guest" ? u.uid : u.email) || [];
  orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Pint-Spar-Zähler: total saved CHF across PAID orders
  const paid = orders.filter(o => o.paymentStatus === "bezahlt");
  const totalSaved = paid.reduce((s, o) => s + (o?.pricing?.totalDiscount || 0), 0);
  const support    = orders.reduce((s, o) => s + (o?.pricing?.grandTotal || 0), 0);
  const freePints  = savingsToPints(totalSaved);

  $("#cust-stat-count").textContent   = orders.length;
  $("#cust-stat-support").textContent = fmt(support);
  $("#cust-stat-savings").textContent = `${totalSaved.toFixed(2)} CHF`;
  $("#cust-stat-pints").textContent   = `${freePints.toFixed(2)} Gratis-Pints 🍦`;

  // Referral code + bonus
  const refCode = prof.refCode || "—";
  $("#cust-refcode").textContent = refCode;
  const bonus = Number(prof.referralBonusPercent || u.referralBonusPercent || 0);
  $("#cust-bonus").innerHTML = bonus > 0
    ? `🎉 Dein Buddy-Bonus: <strong>${bonus}%</strong> auf deine nächste Bestellung wartet!`
    : `Lade Freunde ein — sobald sie mit deinem Code bezahlen, gibt's <strong>5%</strong> für dich obendrauf!`;

  // List orders
  if (!orders.length) {
    show("#cust-empty"); hide("#cust-list"); return;
  }
  hide("#cust-empty"); show("#cust-list");
  $("#cust-list").innerHTML = orders.map(o => {
    const d = new Date(o.timestamp);
    const dStr = d.toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const items = [];
    if (o.qty?.chocolate) items.push(`${o.qty.chocolate}× Chocolate`);
    if (o.qty?.vanilla)   items.push(`${o.qty.vanilla}× Vanilla`);
    if (o.qty?.caramel)   items.push(`${o.qty.caramel}× Caramel`);
    const st = o.paymentStatus || "zahlung_ausstehend";
    const pendingPay = st === "zahlung_ausstehend" || st === "offen";
    const isFinal = st === "abgeschlossen";
    return `<div class="rounded-2xl bg-white border border-espresso/8 p-4 shadow-soft">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-[10px] uppercase tracking-widest text-espresso/55">${dStr}</div>
          <div class="font-display text-base font-semibold mt-0.5">${o.id}</div>
          <div class="text-xs text-espresso/65 mt-1">${items.join(" · ") || "—"}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-display text-lg font-semibold">${(o.pricing?.grandTotal || 0).toFixed(2)} CHF</div>
          <div class="mt-1 status-pill status-${st.replace(/_/g, "-")}">${STATUS_LABELS[st] || st}</div>
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <button class="flex-1 rounded-xl border border-espresso/15 py-2.5 px-3 text-xs font-medium flex items-center justify-center gap-2 reorder-btn" data-id="${o.id}">
          <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Nochmal bestellen
        </button>
        ${pendingPay ? `<button class="flex-1 rounded-xl btn-twint py-2.5 px-3 text-xs font-medium flex items-center justify-center gap-2 repay-btn" data-id="${o.id}"><span class="twint-mark"></span> Jetzt bezahlen</button>` : ""}
      </div>
      ${isFinal ? `
      <div class="mt-3 pt-3 border-t border-espresso/8">
        <p class="text-[11px] text-espresso/55 mb-1">Wie hat dir der Bestellprozess gefallen?</p>
        <div class="flex gap-2">
          <input class="input flex-1 fb-text" data-id="${o.id}" placeholder="Dein ehrliches Feedback..."/>
          <button class="px-3 rounded-xl btn-berry text-sm font-medium fb-submit" data-id="${o.id}">Senden</button>
        </div>
      </div>` : ""}
    </div>`;
  }).join("");

  $$(".reorder-btn").forEach(b => b.addEventListener("click", () => reorder(b.dataset.id, orders)));
  $$(".repay-btn").forEach(b => b.addEventListener("click", () => repay(b.dataset.id, orders)));
  $$(".fb-submit").forEach(b => b.addEventListener("click", async () => {
    const id = b.dataset.id;
    const txt = document.querySelector(`.fb-text[data-id="${id}"]`)?.value || "";
    if (!txt.trim()) return;
    await submitFeedback({ orderId: id, email: u.email, text: txt });
    b.outerHTML = `<span class="text-xs text-berry font-medium">Merci 💜</span>`;
  }));

  // Sharing
  $("#share-whatsapp")?.addEventListener("click", () => shareOn("whatsapp", refCode), { once: true });
  $("#share-instagram")?.addEventListener("click", () => shareOn("instagram", refCode), { once: true });
  $("#cust-copy-code")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(refCode); } catch {}
    $("#cust-copy-label").textContent = "Kopiert ✓";
    setTimeout(() => { $("#cust-copy-label").textContent = "Kopieren"; }, 1600);
  }, { once: true });
}

function shareTextFor(code) {
  const url = `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(code)}`;
  return `Hey! Gönn dir mal das High-Protein Eis von Berry's Delights. Über meinen Link kriegst du direkt 5% Extra-Rabatt auf deine erste Bestellung: ${url} 🍦💪`;
}
async function shareOn(platform, code) {
  if (!code || code === "—") return;
  const text = shareTextFor(code);
  if (platform === "whatsapp") {
    window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(text), "_blank");
  } else if (platform === "instagram") {
    try { await navigator.clipboard.writeText(text); toast("✓ Text kopiert! Jetzt in Instagram einfügen.", { color: "#25D366" }); }
    catch { toast("Konnte Text nicht kopieren — Browser blockt Clipboard.", { color: "#8B1A3B" }); }
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = "instagram://"; a.style.display = "none";
      document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 100);
    }, 300);
  }
}

async function reorder(id, orders) {
  const o = orders.find(x => x.id === id); if (!o) return;
  state.qty.chocolate += o.qty?.chocolate || 0;
  state.qty.vanilla   += o.qty?.vanilla   || 0;
  state.qty.caramel   += o.qty?.caramel   || 0;
  saveCart();
  hide("#cust-portal"); document.body.style.overflow = "";
  renderAll(); openCart();
}
async function repay(id, orders) {
  const o = orders.find(x => x.id === id); if (!o) return;
  const amount = (o.pricing?.grandTotal || 0).toFixed(2);
  const ok = confirm(`TWINT wird geöffnet.\n\nBitte ${amount} CHF an ${MERCHANT_TWINT} überweisen.\n\nFortfahren?`);
  if (!ok) return;
  openTwintApp();
}

// Account icon dot when logged in
function setAccountDot() { $("#account-dot")?.classList.toggle("hidden", !currentUser()); }

// ════════════════════════════════════════════════════════════════
// LIVE USER COUNTER (>= 3)
// ════════════════════════════════════════════════════════════════
function startLiveCounter() {
  startPresence((count) => {
    const el = $("#live-users");
    if (!el) return;
    if (typeof count === "number" && count >= 3) {
      el.classList.remove("hidden");
      $("#live-users-count").textContent = count;
    } else {
      el.classList.add("hidden");
    }
  });
}

// ════════════════════════════════════════════════════════════════
// QR CODE (admin section)
// ════════════════════════════════════════════════════════════════
function renderQR() {
  const wrap = $("#qrcode"); if (!wrap || !window.QRCode) return;
  wrap.innerHTML = "";
  const url = window.location.href;
  new window.QRCode(wrap, { text: url, width: 180, height: 180, colorDark: "#1A0E10", colorLight: "#FFFFFF" });
  $("#qr-url").textContent = url;
}

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
loadCart();

initAuth();
onAuthChange((u) => { setAccountDot(); renderAll(); });

renderFlavors();
renderAll();
hydrateForm();
bindReferralUI(renderAll);
bindAdminUI();

// URL-based actions
handleRefURLParam();           // ?ref=CODE
verifyFromURL();               // ?verify=...&token=...

// Detail/admin teardown
const qrDetails = document.querySelector("details");
qrDetails?.addEventListener("toggle", () => { if (qrDetails.open) renderQR(); });
if (window.QRCode) renderQR();

// Session tracking + live counter
startSessionTracking();
startLiveCounter();

refreshIcons();

// Surface backend mode for transparency in console
console.info(`[Berry's Delights] Modus: ${FB_READY ? "CLOUD (Firebase)" : "LOCAL (nur dieses Gerät)"}`);

// /js/auth.js
// Customer + admin authentication. Cloud (Firebase Auth + RTDB user profile)
// when configured, transparent localStorage fallback when not.

import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { FB_READY, auth, db, ref, set, get, update, ADMIN_EMAIL } from "./firebase.js";
import { reserveCode } from "./referral.js";
import { isEmailValid, ERR } from "./ui.js";

// Local fallback storage
const L_USERS   = "bd_users_local_v1";
const L_SESSION = "bd_session_local_v1";

const _listeners = new Set();

// Public: subscribe to auth changes. Callback fires with user or null.
export function onAuthChange(cb) { _listeners.add(cb); return () => _listeners.delete(cb); }
function emit(user) { _listeners.forEach(fn => { try { fn(user); } catch (e) { console.warn(e); } }); }

// Best-effort sync getter (Firebase keeps currentUser in memory)
export function currentUser() {
  if (FB_READY && auth) {
    const u = auth.currentUser;
    if (!u) return null;
    return wrapUser(u.uid, u.email, !!u.emailVerified);
  }
  return localCurrent();
}

function wrapUser(uid, email, verified) {
  if (!email) return null;
  return {
    uid, email,
    verified,
    firstName: "",
    refCode: null,
    referralBonusPercent: 0,
    isAdmin: email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
  };
}

export async function initAuth() {
  if (FB_READY && auth) {
    onAuthStateChanged(auth, async (u) => {
      if (!u) return emit(null);
      const wrapped = wrapUser(u.uid, u.email, !!u.emailVerified);
      // Enrich from RTDB profile (firstName, refCode, referralBonusPercent)
      try {
        const snap = await get(ref(db, `users/${u.uid}`));
        if (snap.exists()) Object.assign(wrapped, snap.val());
      } catch {}
      // Hard-block admin role escalation: enforce by email only
      wrapped.isAdmin = wrapped.email && wrapped.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      emit(wrapped);
    });
  } else {
    // Local mode: emit once after tick
    setTimeout(() => emit(localCurrent()), 0);
  }
}

// ──────────────────────────────────────────────────────────────────
// Registration
// ──────────────────────────────────────────────────────────────────
export async function registerCustomer({ email, password, passwordConfirm, firstName }) {
  email = String(email || "").trim().toLowerCase();
  if (!isEmailValid(email))         throw new Error(ERR.emailFormat);
  if (!password || password.length < 8) throw new Error(ERR.passwordWeak);
  if (password !== passwordConfirm) throw new Error(ERR.passwordsDiffer);
  firstName = String(firstName || "").trim();

  if (FB_READY && auth) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    const refCode = await reserveCode(firstName || email.split("@")[0], uid, email);
    await set(ref(db, `users/${uid}`), {
      email, firstName, refCode,
      referralBonusPercent: 0,        // accumulated 5%-credits owed on next order
      role: "customer",               // server rules enforce this; only admin email gets admin powers
      createdAt: Date.now(),
    });
    await sendEmailVerification(cred.user, {
      url: window.location.origin + window.location.pathname,
    });
    await signOut(auth);
    return { ok: true, verifyEmailSent: true, manualLink: null };
  }

  // Local fallback
  const users = loadLocal();
  if (users[email]) throw new Error("Diese E-Mail ist schon registriert. Logg dich ein!");
  const refCode = await reserveCode(firstName || email.split("@")[0], "local:" + email, email);
  const verifyToken = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random());
  users[email] = {
    email, firstName,
    refCode, referralBonusPercent: 0,
    passwordHash: await sha256(password),
    verified: false, verifyToken,
    createdAt: Date.now(),
  };
  saveLocal(users);
  const manualLink = `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(email)}&token=${encodeURIComponent(verifyToken)}`;
  return { ok: true, verifyEmailSent: false, manualLink };
}

// ──────────────────────────────────────────────────────────────────
// Login
// ──────────────────────────────────────────────────────────────────
export async function loginCustomer({ email, password }) {
  email = String(email || "").trim().toLowerCase();
  if (!isEmailValid(email)) throw new Error(ERR.emailFormat);

  if (FB_READY && auth) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.emailVerified) {
      const err = new Error("Konto noch nicht bestätigt. Check dein Postfach (auch Spam!).");
      err.code = "NOT_VERIFIED";
      await signOut(auth);
      throw err;
    }
    return { uid: cred.user.uid, email: cred.user.email };
  }

  const users = loadLocal();
  const u = users[email];
  if (!u) { const e = new Error("Kein Konto mit dieser E-Mail. Erst registrieren!"); e.code = "NO_USER"; throw e; }
  const hash = await sha256(password);
  if (hash !== u.passwordHash) { const e = new Error("Passwort falsch. Nochmal sauber tippen."); e.code = "BAD_PASS"; throw e; }
  if (!u.verified) { const e = new Error("Konto noch nicht bestätigt. Bestätigungslink klicken!"); e.code = "NOT_VERIFIED"; throw e; }
  localStorage.setItem(L_SESSION, email);
  emit(localCurrent());
  return { uid: "local:" + email, email };
}

export async function logoutCustomer() {
  if (FB_READY && auth) { try { await signOut(auth); } catch {} }
  localStorage.removeItem(L_SESSION);
  emit(null);
}

// Local-mode email verification via URL token
export function verifyFromURL() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get("verify"), token = params.get("token");
  if (!email || !token) return null;
  // Cloud mode: Firebase handles its own action URL flow, no-op here
  if (FB_READY) {
    // Clean URL anyway
    params.delete("verify"); params.delete("token");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
    return null;
  }
  const e = String(email).trim().toLowerCase();
  const users = loadLocal();
  const u = users[e];
  if (!u) return { ok: false };
  if (!u.verified && u.verifyToken === token) {
    u.verified = true; delete u.verifyToken;
    users[e] = u; saveLocal(users);
  }
  params.delete("verify"); params.delete("token");
  const qs = params.toString();
  window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
  return { ok: !!u.verified, email: e };
}

// ──────────────────────────────────────────────────────────────────
// Profile + referral bonus credit management
// ──────────────────────────────────────────────────────────────────
export async function getProfile(uid) {
  if (FB_READY && db && uid && !String(uid).startsWith("local:")) {
    try { const snap = await get(ref(db, `users/${uid}`)); return snap.val() || null; }
    catch { return null; }
  }
  const email = String(uid || "").replace(/^local:/, "");
  const u = loadLocal()[email];
  return u ? { email: u.email, firstName: u.firstName, refCode: u.refCode, referralBonusPercent: u.referralBonusPercent || 0 } : null;
}

/** Add or subtract a referral bonus on a user. Called from orders.js when admin
 *  marks a referred order as 'bezahlt' (add) or rolls back (clear after use). */
export async function adjustReferralBonus(uid, deltaPct) {
  if (FB_READY && db && uid && !String(uid).startsWith("local:")) {
    try {
      const snap = await get(ref(db, `users/${uid}/referralBonusPercent`));
      const cur  = Number(snap.val()) || 0;
      await update(ref(db, `users/${uid}`), { referralBonusPercent: Math.max(0, cur + deltaPct) });
    } catch (e) { console.warn("[auth] adjustReferralBonus failed", e); }
    return;
  }
  const email = String(uid || "").replace(/^local:/, "");
  const users = loadLocal();
  if (!users[email]) return;
  users[email].referralBonusPercent = Math.max(0, (Number(users[email].referralBonusPercent) || 0) + deltaPct);
  saveLocal(users);
}

// ── helpers
function loadLocal()      { try { return JSON.parse(localStorage.getItem(L_USERS)) || {}; } catch { return {}; } }
function saveLocal(map)   { try { localStorage.setItem(L_USERS, JSON.stringify(map)); } catch {} }
function localCurrent()   {
  const email = localStorage.getItem(L_SESSION);
  if (!email) return null;
  const u = loadLocal()[email];
  if (!u || !u.verified) return null;
  return {
    uid: "local:" + email,
    email, firstName: u.firstName || "",
    verified: true,
    refCode: u.refCode || null,
    referralBonusPercent: u.referralBonusPercent || 0,
    isAdmin: email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
  };
}

async function sha256(str) {
  const enc = new TextEncoder().encode(str + "bd_salt_v1_change_for_prod");
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// /js/cart.js
// Cart state, pricing engine, localStorage persistence.
// Discount tiers (per flavor, additive): 5×=5%, 10×=10%, optional referral 5%.

export const PRICE = 12.00;
export const PROTEIN_PER_PINT = 45; // grams per pint (45–52g claim — using 45 as floor)
export const REFERRAL_PCT     = 5;  // referred customer gets 5%, referrer earns 5% on next order

const CART_KEY = "bd_cart_v1";

export const FLAVORS = [
  { id: "chocolate", name: "Chocolate Fudge Brownie", tagline: "Dunkel · Brownie-Stücke",  gradient: "grad-chocolate", labelColor: "#1A0E10" },
  { id: "vanilla",   name: "Vanilla Cookie Dough",    tagline: "Cremig · Cookie-Bites",     gradient: "grad-vanilla",   labelColor: "#1A0E10" },
  { id: "caramel",   name: "Salted Caramel Toffee",   tagline: "Butterig · Fleur de Sel",   gradient: "grad-caramel",   labelColor: "#FAF6EF" },
];

// Single canonical state object — read & mutated by other modules
export const state = {
  qty:       { chocolate: 0, vanilla: 0, caramel: 0 },
  referral:  null,            // { code, percent, ownerUid? }
  tip:       { type: "percent", value: 0 },
  customer:  { name: "", email: "", phone: "", notes: "" },
};

let _hydrating = false;

export function saveCart() {
  if (_hydrating) return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify({
      qty: state.qty,
      referral: state.referral,
      tip: state.tip,
      customer: state.customer,
    }));
  } catch {}
}

export function loadCart() {
  _hydrating = true;
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.qty)      Object.assign(state.qty, d.qty);
      if ("referral" in d) state.referral = d.referral || null;
      if (d.tip)      state.tip = d.tip;
      if (d.customer) state.customer = Object.assign({ notes: "" }, d.customer);
    }
  } catch {}
  _hydrating = false;
}

export function clearCartItems() {
  state.qty = { chocolate: 0, vanilla: 0, caramel: 0 };
  state.referral = null;
  state.tip = { type: "percent", value: 0 };
  // Keep state.customer.* so repeat orders don't require re-typing
  saveCart();
}

// ──────────────────────────────────────────────────────────────────
// Pricing — per-flavor only (greedy is provably optimal here).
//   floor(qty / 10) × 10-pack at 10%
//   floor((qty - 10·tens) / 5) × 5-pack at 5%
//   remainder at full price
// Referral discount (5%) applies additively on TOTAL subtotal when active.
// ──────────────────────────────────────────────────────────────────
export function priceCart() {
  const ids = ["chocolate", "vanilla", "caramel"];
  const totalItems = ids.reduce((s, id) => s + (state.qty[id] || 0), 0);
  const subtotal   = totalItems * PRICE;

  const packs = {};
  let tens = 0, fives = 0;
  for (const id of ids) {
    const n = state.qty[id] || 0;
    const t = Math.floor(n / 10);
    const f = Math.floor((n - 10 * t) / 5);
    packs[id] = { tens: t, fives: f };
    tens  += t;
    fives += f;
  }

  const tenDiscount   = tens  * 10 * PRICE * 0.10;
  const fiveDiscount  = fives *  5 * PRICE * 0.05;
  const refPct        = state.referral ? (state.referral.percent / 100) : 0;
  const refDiscount   = subtotal * refPct;
  const totalDiscount = tenDiscount + fiveDiscount + refDiscount;
  const afterDiscount = Math.max(0, subtotal - totalDiscount);

  let tipAmount = 0;
  if (state.tip.type === "percent")    tipAmount = afterDiscount * (state.tip.value / 100);
  else if (state.tip.type === "fixed") tipAmount = Math.max(0, Number(state.tip.value) || 0);

  const grandTotal = afterDiscount + tipAmount;

  return {
    subtotal, totalDiscount, afterDiscount, tipAmount, grandTotal,
    tens, fives, packs,
    tenDiscount, fiveDiscount, refDiscount,
    totalItems,
    proteinG: totalItems * PROTEIN_PER_PINT,
  };
}

// Pint-Spar-Zähler — used in customer portal
// Sum of total discounts across all this user's PAID orders, in "free pints"
export function savingsToPints(savedCHF) {
  return savedCHF / PRICE;
}

// /js/firebase.js
// Single source of truth for Firebase initialization.
// Imports Firebase v10+ modular SDK directly from Google's CDN as ES modules.
//
// HOW TO ACTIVATE: paste your real keys into firebaseConfig below.
// While the placeholders are present, the whole app runs in LOCAL mode
// (localStorage fallback for cart, orders, accounts) — perfect for testing.
// As soon as a real apiKey is detected, cloud sync activates everywhere.

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence }
  from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getDatabase, ref, onValue, set, update, get, push, remove,
         serverTimestamp, onDisconnect, runTransaction, query, orderByChild, equalTo }
  from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

// ─────────────────────────────────────────────────────────────────────
// LIVE-Konfig — Berry's Delights Firebase Projekt.
// Hinweis Sicherheit: Der apiKey ist KEIN Geheimnis. Firebase Web-SDKs
// brauchen ihn im Client-Code, damit der Browser die Cloud erreichen kann.
// Der echte Schutz läuft über database.rules.json (Security Rules) und
// Firebase Authentication — beides ist in diesem Projekt aktiv.
// ─────────────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey:            "AIzaSyC1kN3B7PKyzbTi3rwAkdw1wtXwWQViTII",
  authDomain:        "berrys-delights.firebaseapp.com",
  databaseURL:       "https://berrys-delights-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "berrys-delights",
  storageBucket:     "berrys-delights.firebasestorage.app",
  messagingSenderId: "158428724467",
  appId:             "1:158428724467:web:f56e67d7f9e523aad90b86",
  measurementId:     "G-W261HPJEF5"
};

// Cloud mode active only when real keys are provided
export const FB_READY = !!firebaseConfig.apiKey
  && !firebaseConfig.apiKey.startsWith("HIER_")
  && !!firebaseConfig.databaseURL
  && !firebaseConfig.databaseURL.startsWith("HIER_");

export let app  = null;
export let auth = null;
export let db   = null;

if (FB_READY) {
  try {
    app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db   = getDatabase(app);
    // Make sessions survive reloads & browser restarts
    setPersistence(auth, browserLocalPersistence).catch((e) => console.warn("[fb] persistence:", e));
    console.info("[Berry's Delights] Firebase Cloud aktiv ✓");
  } catch (e) {
    console.error("[Berry's Delights] Firebase init fehlgeschlagen:", e);
  }
} else {
  console.info("[Berry's Delights] Firebase nicht konfiguriert — läuft im LOCAL-Modus.");
}

// Re-export commonly used RTDB helpers so other modules only import from here
export { ref, onValue, set, update, get, push, remove,
         serverTimestamp, onDisconnect, runTransaction, query, orderByChild, equalTo };

// Admin identification — single source of truth used by rules + UI
export const ADMIN_EMAIL = "beer.lucas@hotmail.com";

// /js/orders.js
// Order placement, status workflow, history queries, feedback, presence.
//
// Status values (single source of truth):
export const STATUSES = [
  "zahlung_ausstehend",
  "offen",
  "bezahlt",
  "in_produktion",
  "abholbereit",
  "abgeschlossen",
  "storniert",
];

export const STATUS_LABELS = {
  zahlung_ausstehend: "Zahlung ausstehend",
  offen:              "Offen",
  bezahlt:            "Bezahlt",
  in_produktion:      "In Produktion",
  abholbereit:        "Abholbereit",
  abgeschlossen:      "Abgeschlossen",
  storniert:          "Storniert",
};

import { FB_READY, db, ref, set, update, get, push, onValue,
         serverTimestamp, query, orderByChild, equalTo, onDisconnect } from "./firebase.js";
import { adjustReferralBonus } from "./auth.js";

const L_ORDERS    = "bd_orders_local_v1";
const L_FEEDBACKS = "bd_feedbacks_local_v1";
const L_SESSIONS  = "bd_sessions_local_v1";

// ──────────────────────────────────────────────────────────────────
// Order CRUD
// ──────────────────────────────────────────────────────────────────
export function serializeOrder({ user, customer, pricing, qty, referral, tip, notes }) {
  const id = "BD-" + Math.floor(100000 + Math.random() * 900000);
  const userId = user && user.uid ? user.uid : "guest";
  return {
    id, userId,
    name: customer.name, email: String(customer.email || "").toLowerCase(), phone: customer.phone,
    notes: String(notes || ""),
    qty: { ...qty },
    pricing: {
      subtotal: pricing.subtotal, tenDiscount: pricing.tenDiscount, fiveDiscount: pricing.fiveDiscount,
      refDiscount: pricing.refDiscount, totalDiscount: pricing.totalDiscount,
      tipAmount: pricing.tipAmount, grandTotal: pricing.grandTotal,
      tens: pricing.tens, fives: pricing.fives,
    },
    referral: referral ? { code: referral.code, percent: referral.percent, ownerUid: referral.ownerUid || null, bonusApplied: false } : null,
    tip: { ...tip },
    paymentStatus: "zahlung_ausstehend",
    timestamp: new Date().toISOString(),
  };
}

export async function saveOrder(order) {
  if (FB_READY && db) {
    try {
      // Master record
      await set(ref(db, `orders/${order.id}`), { ...order, _ts: serverTimestamp() });
      // User-side index (only for registered customers)
      if (order.userId && order.userId !== "guest" && !String(order.userId).startsWith("local:")) {
        await set(ref(db, `userOrders/${order.userId}/${order.id}`), true);
      }
    } catch (e) { console.warn("[orders] cloud save failed", e); }
  }
  // Always mirror locally
  const all = loadLocal();
  all.push(order);
  saveLocal(all);
}

export async function loadAllOrders() {
  if (FB_READY && db) {
    try {
      const snap = await get(ref(db, "orders"));
      const v = snap.val() || {};
      const list = Object.values(v);
      list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return list;
    } catch (e) { console.warn("[orders] cloud read failed, fallback local", e); }
  }
  const local = loadLocal();
  local.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return local;
}

export async function loadOrdersForUser(emailOrUid) {
  const all = await loadAllOrders();
  const e = String(emailOrUid || "").toLowerCase();
  return all.filter(o =>
    String(o.email || "").toLowerCase() === e
    || String(o.userId || "") === emailOrUid
  );
}

/**
 * Atomically updates an order's status. When transitioning into "bezahlt"
 * and the order has an unredeemed referral with a known ownerUid, credits
 * the referrer with +5% to use on their next purchase.
 */
export async function updateOrderStatus(orderId, newStatus) {
  if (!STATUSES.includes(newStatus)) throw new Error("Unbekannter Status: " + newStatus);

  // Find the current order to check referral bonus eligibility
  let order = null;
  if (FB_READY && db) {
    try { const snap = await get(ref(db, `orders/${orderId}`)); order = snap.val(); } catch {}
  }
  if (!order) order = loadLocal().find(o => o.id === orderId) || null;
  if (!order) throw new Error("Bestellung nicht gefunden.");

  const wasPaid = order.paymentStatus === "bezahlt";
  const willBePaid = newStatus === "bezahlt";

  // Persist new status
  if (FB_READY && db) {
    try { await update(ref(db, `orders/${orderId}`), { paymentStatus: newStatus, _ts: serverTimestamp() }); } catch (e) { console.warn(e); }
  }
  // Local mirror
  const list = loadLocal();
  const idx = list.findIndex(o => o.id === orderId);
  if (idx >= 0) { list[idx].paymentStatus = newStatus; saveLocal(list); }

  // Referrer bonus: credit once when status crosses INTO 'bezahlt'
  if (!wasPaid && willBePaid && order.referral && order.referral.ownerUid && !order.referral.bonusApplied) {
    try {
      await adjustReferralBonus(order.referral.ownerUid, +5);
      if (FB_READY && db) {
        await update(ref(db, `orders/${orderId}/referral`), { bonusApplied: true, bonusAppliedAt: serverTimestamp() });
      } else {
        const list2 = loadLocal();
        const i2 = list2.findIndex(o => o.id === orderId);
        if (i2 >= 0 && list2[i2].referral) { list2[i2].referral.bonusApplied = true; saveLocal(list2); }
      }
    } catch (e) { console.warn("[orders] bonus credit failed", e); }
  }
  // Roll-back if a paid order is later un-paid (mistake)
  if (wasPaid && !willBePaid && order.referral && order.referral.ownerUid && order.referral.bonusApplied) {
    try {
      await adjustReferralBonus(order.referral.ownerUid, -5);
      if (FB_READY && db) {
        await update(ref(db, `orders/${orderId}/referral`), { bonusApplied: false });
      } else {
        const list2 = loadLocal();
        const i2 = list2.findIndex(o => o.id === orderId);
        if (i2 >= 0 && list2[i2].referral) { list2[i2].referral.bonusApplied = false; saveLocal(list2); }
      }
    } catch (e) { console.warn("[orders] bonus rollback failed", e); }
  }
}

// ──────────────────────────────────────────────────────────────────
// Feedback (/feedbacks/$key)
// ──────────────────────────────────────────────────────────────────
export async function submitFeedback({ orderId, email, text, rating }) {
  const item = {
    orderId: orderId || null,
    email: String(email || "").toLowerCase() || null,
    text: String(text || "").trim().slice(0, 1000),
    rating: rating != null ? Number(rating) : null,
    createdAt: new Date().toISOString(),
  };
  if (!item.text && !item.rating) return false;
  if (FB_READY && db) {
    try { await push(ref(db, "feedbacks"), item); }
    catch (e) { console.warn("[feedback] cloud failed", e); }
  }
  const list = loadFeedbacksLocal();
  list.push(item);
  saveFeedbacksLocal(list);
  return true;
}

export async function loadFeedbacks() {
  if (FB_READY && db) {
    try { const snap = await get(ref(db, "feedbacks")); return Object.values(snap.val() || {}); }
    catch (e) { console.warn("[feedback] cloud read failed", e); }
  }
  return loadFeedbacksLocal();
}

// ──────────────────────────────────────────────────────────────────
// Anonymous session tracking — for visitor count & avg dwell time
// ──────────────────────────────────────────────────────────────────
const SESSION_ID_KEY = "bd_session_id";
function getSessionId() {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36)).slice(0, 20);
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export function startSessionTracking() {
  const id = getSessionId();
  const startedAt = Date.now();

  const localUpdate = (durationMs) => {
    const all = loadSessionsLocal();
    const rec = all[id] || { startedAt, durationMs: 0 };
    rec.durationMs = Math.max(rec.durationMs || 0, durationMs);
    all[id] = rec; saveSessionsLocal(all);
  };
  localUpdate(0);

  if (FB_READY && db) {
    try { set(ref(db, `sessions/${id}`), { startedAt: serverTimestamp(), durationMs: 0 }).catch(() => {}); } catch {}
  }

  // Heartbeat every 20s while alive
  const heartbeat = setInterval(() => {
    const dur = Date.now() - startedAt;
    localUpdate(dur);
    if (FB_READY && db) {
      try { update(ref(db, `sessions/${id}`), { durationMs: dur, lastSeen: serverTimestamp() }).catch(() => {}); } catch {}
    }
  }, 20_000);

  window.addEventListener("beforeunload", () => clearInterval(heartbeat));
}

export async function loadSessionsStats() {
  if (FB_READY && db) {
    try {
      const snap = await get(ref(db, "sessions"));
      const v = snap.val() || {};
      const arr = Object.values(v);
      const total = arr.length;
      const avg = arr.length ? arr.reduce((s, r) => s + (r.durationMs || 0), 0) / arr.length : 0;
      return { totalSessions: total, avgDurationMs: avg };
    } catch {}
  }
  const v = loadSessionsLocal();
  const arr = Object.values(v);
  return {
    totalSessions: arr.length,
    avgDurationMs: arr.length ? arr.reduce((s, r) => s + (r.durationMs || 0), 0) / arr.length : 0,
  };
}

// ──────────────────────────────────────────────────────────────────
// Presence — live count of currently-connected users
// Only marketing-visible when ≥ 3.
// ──────────────────────────────────────────────────────────────────
export function startPresence(onChange) {
  if (!FB_READY || !db) {
    // No realtime presence in local mode; report null so UI hides indicator
    setTimeout(() => onChange && onChange(null), 0);
    return;
  }
  try {
    const sid = getSessionId();
    const connRef  = ref(db, ".info/connected");
    const myRef    = ref(db, `presence/${sid}`);
    const allRef   = ref(db, "presence");

    onValue(connRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(myRef).remove().catch(() => {});
        set(myRef, { since: serverTimestamp() }).catch(() => {});
      }
    });

    onValue(allRef, (snap) => {
      const v = snap.val() || {};
      const count = Object.keys(v).length;
      onChange && onChange(count);
    });
  } catch (e) { console.warn("[presence] failed", e); }
}

// ── local storage helpers
function loadLocal()              { try { return JSON.parse(localStorage.getItem(L_ORDERS)) || []; } catch { return []; } }
function saveLocal(list)          { try { localStorage.setItem(L_ORDERS, JSON.stringify(list)); } catch {} }
function loadFeedbacksLocal()     { try { return JSON.parse(localStorage.getItem(L_FEEDBACKS)) || []; } catch { return []; } }
function saveFeedbacksLocal(list) { try { localStorage.setItem(L_FEEDBACKS, JSON.stringify(list)); } catch {} }
function loadSessionsLocal()      { try { return JSON.parse(localStorage.getItem(L_SESSIONS)) || {}; } catch { return {}; } }
function saveSessionsLocal(map)   { try { localStorage.setItem(L_SESSIONS, JSON.stringify(map)); } catch {} }

// /js/referral.js
// Win-Win referral system:
//   • Referred customer gets 5% off immediately when applying a valid code.
//   • Code owner gets +5% credited on their NEXT order, but only after the
//     referred order's status is set to "bezahlt" by the admin (orders.js).
// Codes are FIRSTNAME + 3 digits (LUCAS842). They are ONLY accepted if they
// exist at /referralCodes/$code in Firebase. In local-only mode (no Firebase
// config), codes from the locally-known codes table are accepted.
//
// Anti-abuse: hidden honeypot, 3-strike 10-minute lockout (persisted across
// reloads and tabs).

import { FB_READY, db, ref, get, set, serverTimestamp } from "./firebase.js";
import { state, REFERRAL_PCT, saveCart } from "./cart.js";
import { $, toast } from "./ui.js";

const LOCK_KEY        = "bd_ref_lock_v1";
const LOCAL_CODES_KEY = "bd_ref_codes_v1"; // local-mode mirror: { CODE: { ownerUid, ownerEmail } }
const MAX_ATTEMPTS    = 3;
const LOCK_MINUTES    = 10;

export const REF_PATTERN = /^[A-Z]{2,12}[0-9]{3}$/;

// ──────────────────────────────────────────────────────────────────
// Code generation
// ──────────────────────────────────────────────────────────────────
export function generateCode(firstName) {
  let p = String(firstName || "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (p.length < 2) p = "BERRY";
  if (p.length > 12) p = p.slice(0, 12);
  return p + (100 + Math.floor(Math.random() * 900));
}

/** Reserve a NEW code in /referralCodes/$code with retry on collision. */
export async function reserveCode(firstName, ownerUid, ownerEmail) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode(firstName);
    if (FB_READY) {
      try {
        const snap = await get(ref(db, `referralCodes/${code}`));
        if (snap.exists()) continue;
        await set(ref(db, `referralCodes/${code}`), {
          ownerUid, ownerEmail, createdAt: serverTimestamp(),
        });
        return code;
      } catch (e) { console.warn("[referral] reserve failed", e); }
    } else {
      const tab = loadLocalCodes();
      if (tab[code]) continue;
      tab[code] = { ownerUid, ownerEmail, createdAt: Date.now() };
      saveLocalCodes(tab);
      return code;
    }
  }
  // Last-resort: random suffix
  return generateCode(firstName + Math.floor(Math.random() * 100));
}

/** Validate a code by looking it up. Returns { valid, ownerUid?, ownerEmail? }. */
export async function validateCode(code) {
  code = String(code || "").trim().toUpperCase();
  if (!REF_PATTERN.test(code)) return { valid: false };
  if (FB_READY) {
    try {
      const snap = await get(ref(db, `referralCodes/${code}`));
      if (!snap.exists()) return { valid: false };
      const v = snap.val() || {};
      return { valid: true, code, ownerUid: v.ownerUid, ownerEmail: v.ownerEmail };
    } catch (e) { console.warn("[referral] validate failed", e); return { valid: false }; }
  }
  // Local fallback
  const tab = loadLocalCodes();
  const v = tab[code];
  if (!v) return { valid: false };
  return { valid: true, code, ownerUid: v.ownerUid, ownerEmail: v.ownerEmail };
}

function loadLocalCodes() {
  try { return JSON.parse(localStorage.getItem(LOCAL_CODES_KEY)) || {}; }
  catch { return {}; }
}
function saveLocalCodes(map) {
  try { localStorage.setItem(LOCAL_CODES_KEY, JSON.stringify(map)); } catch {}
}

// ──────────────────────────────────────────────────────────────────
// Rate-limit storage (both localStorage AND sessionStorage so it survives
// any tab combination, per spec)
// ──────────────────────────────────────────────────────────────────
function readLockState() {
  let s = { attempts: 0, lockedUntil: 0 };
  try { s = JSON.parse(localStorage.getItem(LOCK_KEY)) || s; } catch {}
  try {
    const ss = JSON.parse(sessionStorage.getItem(LOCK_KEY) || "null");
    if (ss && ss.lockedUntil > s.lockedUntil) s = ss;
  } catch {}
  return s;
}
function writeLockState(s) {
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(s)); } catch {}
  try { sessionStorage.setItem(LOCK_KEY, JSON.stringify(s)); } catch {}
}

export function isLocked() {
  const s = readLockState();
  return s.lockedUntil > Date.now() ? s.lockedUntil : 0;
}
export function recordInvalidAttempt() {
  const s = readLockState();
  s.attempts = (s.attempts || 0) + 1;
  if (s.attempts >= MAX_ATTEMPTS) {
    s.lockedUntil = Date.now() + LOCK_MINUTES * 60_000;
    s.attempts = 0;
  }
  writeLockState(s);
  return s;
}
export function resetAttempts() { writeLockState({ attempts: 0, lockedUntil: 0 }); }

// ──────────────────────────────────────────────────────────────────
// UI wiring
// ──────────────────────────────────────────────────────────────────
let _lockTimer = null;
let _renderCb  = () => {};

export function bindReferralUI(renderCb) {
  _renderCb = renderCb || (() => {});
  const applyBtn = $("#ref-apply");
  const input    = $("#ref-input");
  if (applyBtn) applyBtn.addEventListener("click", () => applyEnteredCode());
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); applyEnteredCode(); }
    });
  }
  refreshLockUI();
}

function refreshLockUI() {
  const input = $("#ref-input"), btn = $("#ref-apply"), msg = $("#ref-msg");
  if (!input || !btn || !msg) return;
  const until = isLocked();
  if (until > 0) {
    input.disabled = btn.disabled = true;
    input.classList.add("opacity-50");
    btn.classList.add("opacity-50");
    const t = new Date(until).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
    msg.innerHTML = `<span class="text-berry font-medium">⛔ Code-Eingabe gesperrt</span> · Wieder verfügbar um ${t} Uhr`;
    msg.className = "text-xs mt-2 text-berry";
    if (!_lockTimer) _lockTimer = setInterval(refreshLockUI, 1000);
  } else {
    input.disabled = btn.disabled = false;
    input.classList.remove("opacity-50");
    btn.classList.remove("opacity-50");
    if (_lockTimer) { clearInterval(_lockTimer); _lockTimer = null; }
  }
}

export async function applyEnteredCode(opts = {}) {
  const input = $("#ref-input"), msg = $("#ref-msg"), honey = $("#ref-honey");
  if (!input || !msg) return;

  // Honeypot: bots fill all inputs — silent rejection, no UX hint
  if (honey && honey.value) { console.warn("Honeypot triggered"); return; }

  if (isLocked()) { refreshLockUI(); return; }

  const code = String(input.value || "").trim().toUpperCase();
  if (!code) return;

  // Format check first (cheap), then cloud verification
  if (!REF_PATTERN.test(code)) return handleInvalid("Code-Format passt nicht. Beispiel: LUCAS842");

  const res = await validateCode(code);
  if (!res.valid) return handleInvalid("Diesen Code kennen wir nicht. Tippfehler? Sonst sag deinem Buddy Bescheid.");

  // Valid! Apply
  resetAttempts();
  input.classList.remove("error");
  state.referral = { code, percent: REFERRAL_PCT, ownerUid: res.ownerUid || null, ownerEmail: res.ownerEmail || null };
  input.value = code;
  saveCart();
  msg.innerHTML = `<span class="text-berry font-medium">✦ Code ${code} aktiv</span> · ${REFERRAL_PCT}% Buddy-Rabatt${opts.fromUrl ? " (via Link)" : ""}`;
  msg.className = "text-xs mt-2 text-espresso/70";
  if (!opts.fromUrl) input.blur();
  _renderCb();

  function handleInvalid(reason) {
    input.classList.add("error");
    const s = recordInvalidAttempt();
    if (s.lockedUntil > Date.now()) { refreshLockUI(); state.referral = null; saveCart(); _renderCb(); return; }
    const left = MAX_ATTEMPTS - (s.attempts || 0);
    msg.textContent = `${reason} Noch ${left} Versuch${left === 1 ? "" : "e"} dann gibt's 10 Min Pause.`;
    msg.className = "text-xs mt-2 text-berry";
    state.referral = null; saveCart(); _renderCb();
  }
}

// ──────────────────────────────────────────────────────────────────
// URL ?ref=XYZ123 — auto-apply on page load
// ──────────────────────────────────────────────────────────────────
export async function handleRefURLParam() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("ref");
  if (!raw) return;

  const code = String(raw).trim().toUpperCase();
  if (REF_PATTERN.test(code)) {
    const input = $("#ref-input");
    if (input) input.value = code;
    await applyEnteredCode({ fromUrl: true });
    if (state.referral && state.referral.code === code) {
      toast(`🎁 Code <strong>${code}</strong> aktiv · ${REFERRAL_PCT}% Buddy-Rabatt für dich!`, { color: "#8B1A3B", ms: 3600 });
    }
  }
  // Always clean URL so it's not re-applied on refresh
  params.delete("ref");
  const qs = params.toString();
  window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
}

// /js/ui.js
// DOM helpers, toasts, German-language validators (email + Swiss phone + anti-zahlenleiter).

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const fmt = (n) => `${(Number(n) || 0).toFixed(2)} CHF`;

export function show(el)    { if (typeof el === "string") el = $(el); el && el.classList.remove("hidden"); }
export function hide(el)    { if (typeof el === "string") el = $(el); el && el.classList.add("hidden"); }
export function toggle(el, visible) {
  if (typeof el === "string") el = $(el);
  if (el) el.classList.toggle("hidden", !visible);
}

// Small toast at top — auto-fades
export function toast(html, { color = "#1A0E10", ms = 2400 } = {}) {
  const t = document.createElement("div");
  t.className = "fixed top-0 inset-x-0 z-[300] text-cream px-4 py-3 text-sm text-center shadow-soft";
  t.style.background = color;
  t.innerHTML = html;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// Safe icon refresh (Lucide may be late / blocked)
export function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    try { window.lucide.createIcons(); } catch {}
  }
}

// ──────────────────────────────────────────────────────────────────
// VALIDATORS — alle Meldungen auf Deutsch im Gym-Buddy-Stil
// ──────────────────────────────────────────────────────────────────
export const ERR = {
  emailEmpty:   "Halt, ohne E-Mail kommen wir nicht weiter! 📩",
  emailFormat:  "Diese E-Mail sieht nicht echt aus — bitte nochmal checken. 📩",
  phoneFormat:  "Bitte gib eine gültige Mobilnummer für den TWINT-Abgleich an! 📱",
  phoneFake:    "Bitte gib eine gültige Mobilnummer für den TWINT-Abgleich an! 📱",
  nameEmpty:    "Sag uns deinen Namen — sonst können wir dich nicht ansprechen. 💪",
  passwordWeak: "Passwort min. 8 Zeichen — bisschen mehr Muskeln bitte! 🔒",
  passwordsDiffer: "Die zwei Passwörter sind nicht identisch. Nochmal sauber tippen! 🔑",
};

/** Strict email syntax check (RFC-lite). */
export function isEmailValid(s) {
  s = String(s || "").trim();
  if (!s) return false;
  // No spaces, must have local@domain.tld, single @, TLD ≥ 2 chars
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(s) && s.length <= 254;
}

/**
 * Clean a Swiss phone number to E.164 form +41XXXXXXXXX,
 * then format as "+41 7X XXX XX XX".
 * Returns { ok, formatted, digits, reason }.
 */
export function normalizeSwissMobile(raw) {
  let s = String(raw || "").replace(/[\s\-\(\)\.]/g, "");
  if (!s) return { ok: false, reason: ERR.phoneFormat };

  // Forms: +41XXXXXXXXX | 0041XXXXXXXXX | 0XXXXXXXXX
  if (s.startsWith("+41")) s = s.slice(3);
  else if (s.startsWith("0041")) s = s.slice(4);
  else if (s.startsWith("0")) s = s.slice(1);
  else if (/^41[7]/.test(s)) s = s.slice(2);

  // After normalization: 9 digits, starts with 7 (Swiss mobile prefix 7X)
  if (!/^7[0-9]{8}$/.test(s)) return { ok: false, reason: ERR.phoneFormat };

  // Anti-Zahnleiter / Fake-Filter
  if (isObviousFakePhone(s)) return { ok: false, reason: ERR.phoneFake };

  const digits = "+41" + s;
  const formatted = `+41 ${s.slice(0,2)} ${s.slice(2,5)} ${s.slice(5,7)} ${s.slice(7,9)}`;
  return { ok: true, formatted, digits };
}

/**
 * Detect ladders / repeats / sequential digit runs:
 *   - All same digit                       079 999 99 99
 *   - 5+ identical digits in a row         078 999 12 34
 *   - 5+ sequential ascending/descending   078 123 45 67  /  078 987 65 43
 *   - <4 unique digits (suspicious patterns)
 * `s` is the 9-digit local part after normalization (starts with 7).
 */
export function isObviousFakePhone(s) {
  if (typeof s !== "string" || s.length !== 9) return true;
  const arr = [...s].map(c => c.charCodeAt(0) - 48);

  // 1. All identical
  if (arr.every(x => x === arr[0])) return true;

  // 2. 5+ identical in a row
  let runId = 1, maxRunId = 1;
  for (let i = 1; i < arr.length; i++) {
    runId = arr[i] === arr[i-1] ? runId + 1 : 1;
    if (runId > maxRunId) maxRunId = runId;
  }
  if (maxRunId >= 5) return true;

  // 3. 5+ sequential ascending or descending (e.g. 12345, 98765)
  let runSeqUp = 1, runSeqDn = 1, maxSeq = 1;
  for (let i = 1; i < arr.length; i++) {
    runSeqUp = (arr[i] - arr[i-1] === 1) ? runSeqUp + 1 : 1;
    runSeqDn = (arr[i-1] - arr[i] === 1) ? runSeqDn + 1 : 1;
    maxSeq = Math.max(maxSeq, runSeqUp, runSeqDn);
  }
  if (maxSeq >= 5) return true;

  // 4. Too few unique digits (entropy floor)
  const uniq = new Set(arr).size;
  if (uniq < 4) return true;

  return false;
}

/** Convenience: full validate-and-format, returning either OK or an error string. */
export function validateSwissMobile(raw) {
  const r = normalizeSwissMobile(raw);
  if (!r.ok) return { ok: false, error: r.reason };
  return { ok: true, formatted: r.formatted, digits: r.digits };
}

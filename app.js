// GP Calculator — vanilla port of the Claude Design "x-dc" prototype logic.
// Two cards: initial profit/GP from base price + cost, and a GP-target
// simulator that back-solves the required selling price.

(function () {
  "use strict";

  // ----- configuration (was DCLogic props) -----
  const ACCENT = "#0E5A48";
  const GP_MAX = 40;     // slider upper bound (%)
  const GP_STEP = 0.1;   // slider granularity (%)
  const DISCOUNT_MAX = 20;
  const DISCOUNT_STEP = 0.1;

  // ----- state -----
  const state = { base: "275,900", cost: "220,000", gp: "20", discount: "0" };

  // ----- helpers (ported 1:1 from the prototype) -----
  const parseNumber = (v) => {
    const n = Number(String(v).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };
  // Results default to whole baht (0 decimals) but show up to 2 places when
  // the value actually has a fractional part.
  const money = (v) =>
    new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(v || 0);

  // Live formatter for the money inputs: group the integer part with thousands
  // separators while preserving an in-progress decimal the user is typing
  // (a trailing dot or trailing zeros), capped at 2 places. Whole numbers stay
  // 0-decimals; decimals are allowed but never forced or rounded away mid-type.
  const groupMoney = (raw) => {
    let s = String(raw).replace(/[^\d.]/g, "");
    const firstDot = s.indexOf(".");
    if (firstDot !== -1) s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    if (s === "") return "";
    const dot = s.indexOf(".");
    let intp = dot === -1 ? s : s.slice(0, dot);
    const decp = dot === -1 ? null : s.slice(dot + 1, dot + 3); // at most 2 decimals
    intp = intp.replace(/^0+(?=\d)/, "");
    if (intp === "") intp = "0";
    const grouped = Number(intp).toLocaleString("th-TH");
    return decp === null ? grouped : grouped + "." + decp;
  };
  const percent = (v) => (Number.isFinite(v) ? v.toFixed(2) + "%" : "-");
  const shortPercent = (v) => {
    if (!Number.isFinite(v)) return "-";
    return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(v) + "%";
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const gpFrom = (price, cost) => (price <= 0 ? NaN : ((price - cost) / price) * 100);
  const priceFromGp = (cost, gp) => cost / (1 - gp / 100);

  const shade = (hex, f) => {
    const m = hex.replace("#", "");
    const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    const c = (x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0");
    return "#" + c(r * f) + c(g * f) + c(b * f);
  };
  const mixWhite = (hex, t) => {
    const m = hex.replace("#", "");
    const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    const c = (x) => Math.round(x + (255 - x) * t).toString(16).padStart(2, "0");
    return "#" + c(r) + c(g) + c(b);
  };

  // warm clay (low) -> gold -> light green (ok ~20%) -> deep brand green (high)
  const gpColor = (gp) => {
    const f = GP_MAX / 40;
    const stops = [
      [0 * f, [192, 87, 59]],
      [8 * f, [214, 150, 70]],
      [16 * f, [124, 196, 127]],
      [28 * f, [31, 138, 91]],
      [40 * f, [14, 90, 72]],
    ];
    const x = clamp(Number.isFinite(gp) ? gp : 0, stops[0][0], stops[stops.length - 1][0]);
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (x >= stops[i][0] && x <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const tt = (x - a[0]) / span;
    const ch = (i) => Math.round(a[1][i] + (b[1][i] - a[1][i]) * tt);
    const rgb = [ch(0), ch(1), ch(2)];
    const hex = "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
    return {
      hex,
      glow: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},.34)`,
      dark: shade(hex, 0.62),
      soft: mixWhite(hex, 0.87),
    };
  };
  const gpStatus = (gp) => {
    const f = GP_MAX / 40;
    if (!Number.isFinite(gp) || gp < 0) return "ขาดทุน";
    if (gp < 8 * f) return "ต่ำ";
    if (gp < 16 * f) return "พอใช้";
    if (gp < 26 * f) return "ดี";
    return "ดีมาก";
  };

  // ----- DOM -----
  const $ = (id) => document.getElementById(id);
  const el = {
    root: $("appRoot"),
    base: $("base"),
    cost: $("cost"),
    initProfitCard: $("initProfitCard"),
    initialProfit: $("initialProfit"),
    initGpCard: $("initGpCard"),
    initGpLabel: $("initGpLabel"),
    initStatus: $("initStatus"),
    initialGp: $("initialGp"),
    gpText: $("gpText"),
    gpSlider: $("gpSlider"),
    exploreGpVal: $("exploreGpVal"),
    explorePrice: $("explorePrice"),
    exploreProfit: $("exploreProfit"),
    gpTooltip: $("gpTooltip"),
    gpUnfill: $("gpUnfill"),
    gpThumb: $("gpThumb"),
    capCost: $("capCost"),
    capStep: $("capStep"),
    discountHeaderValue: $("discountHeaderValue"),
    discountTooltip: $("discountTooltip"),
    discountFill: $("discountFill"),
    discountThumb: $("discountThumb"),
    discountSlider: $("discountSlider"),
    discountPrice: $("discountPrice"),
    discountProfit: $("discountProfit"),
    discountGp: $("discountGp"),
  };

  // write a field's value only when the user isn't actively editing it,
  // so reformatting/sync never steals the caret mid-keystroke.
  const setVal = (node, v) => { if (document.activeElement !== node) node.value = v; };

  // ----- render -----
  function render() {
    const accent2 = shade(ACCENT, 0.74);
    const accentSoft = mixWhite(ACCENT, 0.86);
    el.root.style.setProperty("--accent", ACCENT);
    el.root.style.setProperty("--accent2", accent2);
    el.root.style.setProperty("--accentSoft", accentSoft);

    const base = parseNumber(state.base);
    const cost = parseNumber(state.cost);

    // initial card
    const initProfit = base - cost;
    const initGp = gpFrom(base, cost);
    const initCol = gpColor(initGp);

    el.initProfitCard.style.background = `linear-gradient(140deg, ${initCol.hex}, ${initCol.dark})`;
    el.initialProfit.textContent = money(initProfit);

    el.initGpCard.style.background = initCol.soft;
    el.initGpCard.style.border = `1px solid ${initCol.hex}`;
    el.initGpLabel.style.color = initCol.dark;
    el.initStatus.style.background = initCol.hex;
    el.initStatus.textContent = gpStatus(initGp);
    el.initialGp.textContent = percent(initGp);
    el.initialGp.style.color = initCol.dark;

    // simulator card
    const gpNum = clamp(parseNumber(state.gp), 0, GP_MAX);
    const exPrice = priceFromGp(cost, gpNum);
    const exProfit = exPrice - cost;
    const col = gpColor(gpNum);
    const fill = GP_MAX > 0 ? clamp((gpNum / GP_MAX) * 100, 0, 100) : 0;

    el.exploreGpVal.textContent = shortPercent(gpNum);
    el.exploreGpVal.style.color = col.hex;
    el.explorePrice.textContent = money(exPrice);
    el.exploreProfit.textContent = money(exProfit);

    el.gpTooltip.textContent = shortPercent(gpNum);
    el.gpTooltip.style.left = fill + "%";
    el.gpTooltip.style.background = col.hex;

    el.gpUnfill.style.width = (100 - fill) + "%";

    el.gpThumb.style.left = fill + "%";
    el.gpThumb.style.background = col.hex;
    el.gpThumb.style.boxShadow = `0 0 0 4px ${col.glow}, 0 4px 10px rgba(20,32,28,.22)`;

    el.capCost.textContent = state.cost;

    // discount simulator
    const discount = clamp(parseNumber(state.discount), 0, DISCOUNT_MAX);
    const discountFill = DISCOUNT_MAX > 0 ? clamp((discount / DISCOUNT_MAX) * 100, 0, 100) : 0;
    const discountPrice = base * (1 - discount / 100);
    const discountProfit = discountPrice - cost;
    const discountGp = gpFrom(discountPrice, cost);
    const discountCol = gpColor(discountGp);
    const discountLabel = shortPercent(discount);

    el.discountHeaderValue.textContent = discountLabel;
    el.discountTooltip.textContent = discountLabel;
    el.discountTooltip.style.left = discountFill + "%";
    el.discountTooltip.style.background = discountCol.hex;
    el.discountFill.style.width = discountFill + "%";
    el.discountThumb.style.left = discountFill + "%";
    el.discountThumb.style.background = discountCol.hex;
    el.discountThumb.style.boxShadow = `0 0 0 4px ${discountCol.glow}, 0 4px 10px rgba(20,32,28,.18)`;
    el.discountPrice.textContent = money(discountPrice);
    el.discountProfit.textContent = money(discountProfit);
    el.discountProfit.parentElement.style.color = discountProfit >= 0 ? "#0E7C5A" : "#B4432D";
    el.discountGp.textContent = percent(discountGp);
    el.discountGp.style.color = Number.isFinite(discountGp) ? discountCol.dark : "#8A968F";

    // sync controls (without disturbing an active field)
    setVal(el.base, state.base);
    setVal(el.cost, state.cost);
    setVal(el.gpText, state.gp);
    setVal(el.gpSlider, String(gpNum));
    setVal(el.discountSlider, String(discount));
  }

  // ----- handlers -----
  el.base.addEventListener("input", (e) => {
    state.base = groupMoney(e.target.value); // groups thousands, keeps decimals
    e.target.value = state.base;
    render();
  });
  el.cost.addEventListener("input", (e) => {
    state.cost = groupMoney(e.target.value);
    e.target.value = state.cost;
    render();
  });
  el.gpText.addEventListener("input", (e) => { state.gp = e.target.value; render(); });
  el.gpSlider.addEventListener("input", (e) => { state.gp = e.target.value; render(); });
  el.discountSlider.addEventListener("input", (e) => { state.discount = e.target.value; render(); });

  // static config-driven labels
  el.gpSlider.min = "0";
  el.gpSlider.max = String(GP_MAX);
  el.gpSlider.step = String(GP_STEP);
  el.discountSlider.min = "0";
  el.discountSlider.max = String(DISCOUNT_MAX);
  el.discountSlider.step = String(DISCOUNT_STEP);
  el.capStep.textContent = String(GP_STEP);

  render();
})();

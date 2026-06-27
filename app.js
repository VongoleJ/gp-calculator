const GP_MIN = 0;
const GP_MAX = 40;
const PRICE_STEP = 100;

const basePriceEl = document.getElementById("basePrice");
const costEl = document.getElementById("cost");
const priceSliderEl = document.getElementById("priceSlider");
const targetGpInputEl = document.getElementById("targetGpInput");
const targetGpSliderEl = document.getElementById("targetGpSlider");

const refs = {
  initialProfit: document.getElementById("initialProfit"),
  initialGp: document.getElementById("initialGp"),
  priceGpBadge: document.getElementById("priceGpBadge"),
  priceSliderText: document.getElementById("priceSliderText"),
  priceMinText: document.getElementById("priceMinText"),
  priceMaxText: document.getElementById("priceMaxText"),
  priceModeProfit: document.getElementById("priceModeProfit"),
  priceModeGp: document.getElementById("priceModeGp"),
  targetGpText: document.getElementById("targetGpText"),
  targetGpValue: document.getElementById("targetGpValue"),
  targetPrice: document.getElementById("targetPrice"),
  targetProfit: document.getElementById("targetProfit")
};

const moneyFormatter = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 0
});

function parseNumber(value) {
  const normalized = String(value).replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function money(value) {
  return moneyFormatter.format(Math.round(value || 0));
}

function percent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function shortPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function gpFrom(price, cost) {
  if (price <= 0) return NaN;
  return ((price - cost) / price) * 100;
}

function priceFromGp(cost, gp) {
  return cost / (1 - gp / 100);
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

function formatMoneyInput(input) {
  const value = parseNumber(input.value);
  input.value = value ? money(value) : "";
}

function setTone(element, value) {
  element.classList.toggle("negative", value < 0);
  element.classList.toggle("warning", value >= 0 && value < 15);
  element.classList.toggle("positive", value >= 15);
}

function syncPriceSliderBounds(cost) {
  const minPrice = roundToStep(priceFromGp(cost, GP_MIN), PRICE_STEP);
  const maxPrice = roundToStep(priceFromGp(cost, GP_MAX), PRICE_STEP);
  priceSliderEl.min = String(minPrice);
  priceSliderEl.max = String(maxPrice);
  refs.priceMinText.textContent = `0% GP: ${money(minPrice)}`;
  refs.priceMaxText.textContent = `40% GP: ${money(maxPrice)}`;
  return { minPrice, maxPrice };
}

function updateInitial(basePrice, cost) {
  const profit = basePrice - cost;
  const gp = gpFrom(basePrice, cost);
  refs.initialProfit.textContent = money(profit);
  refs.initialGp.textContent = percent(gp);
  setTone(refs.initialProfit, profit);
  setTone(refs.initialGp, gp);
}

function updatePriceMode(basePrice, cost) {
  const sliderPrice = parseNumber(priceSliderEl.value);
  const profit = sliderPrice - cost;
  const gp = gpFrom(sliderPrice, cost);
  refs.priceSliderText.textContent = `${money(sliderPrice)} บาท`;
  refs.priceGpBadge.textContent = percent(gp);
  refs.priceModeProfit.textContent = money(profit);
  refs.priceModeGp.textContent = percent(gp);
  setTone(refs.priceGpBadge, gp);
  setTone(refs.priceModeProfit, profit);
  setTone(refs.priceModeGp, gp);
}

function updateTargetMode(cost) {
  const targetGp = clamp(parseNumber(targetGpInputEl.value), GP_MIN, GP_MAX);
  const targetPrice = priceFromGp(cost, targetGp);
  const targetProfit = targetPrice - cost;

  targetGpInputEl.value = shortPercent(targetGp).replace("%", "");
  targetGpSliderEl.value = String(targetGp);
  refs.targetGpText.textContent = shortPercent(targetGp);
  refs.targetGpValue.textContent = shortPercent(targetGp);
  refs.targetPrice.textContent = money(targetPrice);
  refs.targetProfit.textContent = money(targetProfit);
  setTone(refs.targetProfit, targetProfit);
}

function updateAll(options = {}) {
  const basePrice = parseNumber(basePriceEl.value);
  const cost = parseNumber(costEl.value);
  const bounds = syncPriceSliderBounds(cost);

  if (options.syncPriceSlider) {
    priceSliderEl.value = String(clamp(roundToStep(basePrice, PRICE_STEP), bounds.minPrice, bounds.maxPrice));
  } else {
    priceSliderEl.value = String(clamp(parseNumber(priceSliderEl.value), bounds.minPrice, bounds.maxPrice));
  }

  updateInitial(basePrice, cost);
  updatePriceMode(basePrice, cost);
  updateTargetMode(cost);
}

function handleMoneyInput(input, options) {
  formatMoneyInput(input);
  updateAll(options);
}

basePriceEl.addEventListener("input", () => handleMoneyInput(basePriceEl, { syncPriceSlider: true }));
costEl.addEventListener("input", () => handleMoneyInput(costEl, { syncPriceSlider: false }));
priceSliderEl.addEventListener("input", () => updateAll());

targetGpInputEl.addEventListener("input", () => updateAll());
targetGpInputEl.addEventListener("blur", () => updateAll());

targetGpSliderEl.addEventListener("input", () => {
  targetGpInputEl.value = targetGpSliderEl.value;
  updateAll();
});

formatMoneyInput(basePriceEl);
formatMoneyInput(costEl);
updateAll({ syncPriceSlider: true });

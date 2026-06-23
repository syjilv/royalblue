const STORAGE_KEY = "royalblue-demand-2026";
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const SURCHARGE_SIZES = new Set(["2XL", "3XL"]);
const PRICE_TIERS = [
  { min: 200, price: 24300 },
  { min: 100, price: 25060 },
  { min: 50, price: 25820 },
  { min: 30, price: 26080 },
  { min: 20, price: 26980 },
  { min: 5, price: 27840 },
  { min: 1, price: 28900 },
];
const PLUS_SIZE_SURCHARGE = 2000;
const SHIPPING_FEE = 4500;

const form = document.querySelector("#demandForm");
const statusMessage = document.querySelector("#formStatus");
const savedTotal = document.querySelector("#savedTotal");
const draftTotal = document.querySelector("#draftTotal");
const deliverySummary = document.querySelector("#deliverySummary");
const shippingFee = document.querySelector("#shippingFee");
const baseUnitPrice = document.querySelector("#baseUnitPrice");
const draftEstimate = document.querySelector("#draftEstimate");
const entryList = document.querySelector("#entryList");
const clearEntries = document.querySelector("#clearEntries");
const counters = [...document.querySelectorAll(".size-counter")];
const deliveryRadios = [...document.querySelectorAll('input[name="delivery"]')];
const quantities = Object.fromEntries(SIZES.map((size) => [size, 0]));

const formatWon = (value) => `${value.toLocaleString("ko-KR")}원`;
const formatCount = (value) => `${value.toLocaleString("ko-KR")}장`;

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function totalForCounts(counts) {
  return SIZES.reduce((sum, size) => sum + (Number(counts[size]) || 0), 0);
}

function savedCounts(entries = loadEntries()) {
  return entries.reduce((acc, entry) => {
    SIZES.forEach((size) => {
      acc[size] += Number(entry.counts?.[size]) || 0;
    });
    return acc;
  }, Object.fromEntries(SIZES.map((size) => [size, 0])));
}

function priceForTotal(total) {
  return PRICE_TIERS.find((tier) => total >= tier.min)?.price ?? PRICE_TIERS.at(-1).price;
}

function estimateForCounts(counts, unitPrice) {
  return SIZES.reduce((sum, size) => {
    const count = Number(counts[size]) || 0;
    const surcharge = SURCHARGE_SIZES.has(size) ? PLUS_SIZE_SURCHARGE : 0;
    return sum + count * (unitPrice + surcharge);
  }, 0);
}

function selectedDelivery() {
  return deliveryRadios.find((radio) => radio.checked)?.value ?? "현장수령";
}

function deliveryFee() {
  return selectedDelivery() === "택배" ? SHIPPING_FEE : 0;
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `form-status${type ? ` is-${type}` : ""}`;
}

function updateCounters() {
  counters.forEach((counter) => {
    const size = counter.dataset.size;
    counter.querySelector("output").textContent = quantities[size];
  });
}

function renderEntries(entries = loadEntries()) {
  if (!entries.length) {
    entryList.innerHTML = "<p>아직 저장된 수요가 없습니다.</p>";
    return;
  }

  entryList.innerHTML = entries
    .map((entry) => {
      const details = SIZES
        .filter((size) => entry.counts[size])
        .map((size) => `${size} ${entry.counts[size]}`)
        .join(" · ");

      return `
        <article class="entry-card">
          <div>
            <strong>${entry.name}</strong>
            <span>${details} · 총 ${formatCount(totalForCounts(entry.counts))} · ${entry.delivery ?? "현장수령"}</span>
          </div>
          <span>${new Date(entry.createdAt).toLocaleDateString("ko-KR")}</span>
        </article>
      `;
    })
    .join("");
}

function calculate() {
  const entries = loadEntries();
  const existingCounts = savedCounts(entries);
  const savedQuantity = totalForCounts(existingCounts);
  const draftQuantity = totalForCounts(quantities);
  const expectedTotalQuantity = savedQuantity + draftQuantity;
  const unitPrice = priceForTotal(expectedTotalQuantity);

  savedTotal.textContent = formatCount(savedQuantity);
  draftTotal.textContent = formatCount(draftQuantity);
  deliverySummary.textContent = selectedDelivery();
  shippingFee.textContent = formatWon(deliveryFee());
  baseUnitPrice.textContent = formatWon(unitPrice);
  draftEstimate.textContent = formatWon(estimateForCounts(quantities, unitPrice) + deliveryFee());
  updateCounters();
  renderEntries(entries);
}

counters.forEach((counter) => {
  counter.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const size = counter.dataset.size;
    const direction = button.dataset.action === "plus" ? 1 : -1;
    quantities[size] = Math.max(0, quantities[size] + direction);
    setStatus("");
    calculate();
  });
});

deliveryRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    setStatus("");
    calculate();
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = new FormData(form).get("name")?.trim();
  const total = totalForCounts(quantities);

  if (!name) {
    setStatus("이름을 입력해주세요.", "error");
    return;
  }

  if (total === 0) {
    setStatus("예상 수량을 1장 이상 선택해주세요.", "error");
    return;
  }

  const entries = loadEntries();
  entries.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name,
    counts: { ...quantities },
    delivery: selectedDelivery(),
  });
  saveEntries(entries);

  SIZES.forEach((size) => {
    quantities[size] = 0;
  });
  form.reset();
  setStatus("수요가 현재 브라우저에 저장되었습니다.", "success");
  calculate();
});

clearEntries.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  setStatus("저장 내역을 지웠습니다.");
  calculate();
});

calculate();

const COLORS = ["화이트", "블랙"];
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const BASE_PRICE = 28000;
const PLUS_PRICE = 30000;
const SHIPPING_FEE = 4500;

const form = document.querySelector("#demandForm");
const statusMessage = document.querySelector("#formStatus");
const entryList = document.querySelector("#entryList");
const submitButton = document.querySelector("#submitButton");
const endpointInput = document.querySelector("#sheetEndpoint");
const sheetLink = document.querySelector("#sheetLink");
const addressField = document.querySelector("#addressField");
const addressInput = form.elements.address;
const deliveryRadios = [...document.querySelectorAll('input[name="delivery"]')];
const quantities = Object.fromEntries(
  COLORS.map((color) => [color, Object.fromEntries(SIZES.map((size) => [size, 0]))]),
);
let sheetState = { entries: [], spreadsheetUrl: "" };

const formatWon = (value) => `${value.toLocaleString("ko-KR")}원`;
const formatCount = (value) => `${value.toLocaleString("ko-KR")}장`;
const selectedDelivery = () => deliveryRadios.find((radio) => radio.checked)?.value || "현장수령";
const deliveryFee = () => (selectedDelivery() === "택배" ? SHIPPING_FEE : 0);
const endpoint = () => endpointInput.value.trim();

function createCounters() {
  document.querySelectorAll(".color-order").forEach((section) => {
    const color = section.dataset.color;
    section.querySelector(".size-counter-list").innerHTML = SIZES.map(
      (size) => `<div class="size-counter" data-color="${color}" data-size="${size}">
        <span>${size}<small>${size === "2XL" || size === "3XL" ? "30,000원" : "28,000원"}</small></span>
        <button type="button" class="counter-button" data-action="minus" aria-label="${color} ${size} 수량 줄이기">−</button>
        <output>0</output>
        <button type="button" class="counter-button" data-action="plus" aria-label="${color} ${size} 수량 늘리기">+</button>
      </div>`,
    ).join("");
  });
}

function colorTotal(color) {
  return SIZES.reduce((sum, size) => sum + quantities[color][size], 0);
}

function totalQuantity() {
  return COLORS.reduce((sum, color) => sum + colorTotal(color), 0);
}

function productAmount() {
  return COLORS.reduce(
    (sum, color) => sum + SIZES.reduce(
      (subtotal, size) => subtotal + quantities[color][size] * (size === "2XL" || size === "3XL" ? PLUS_PRICE : BASE_PRICE),
      0,
    ),
    0,
  );
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `form-status${type ? ` is-${type}` : ""}`;
}

function calculate() {
  document.querySelector("#whiteTotal").textContent = formatCount(colorTotal("화이트"));
  document.querySelector("#blackTotal").textContent = formatCount(colorTotal("블랙"));
  document.querySelector("#draftTotal").textContent = formatCount(totalQuantity());
  document.querySelector("#productTotal").textContent = formatWon(productAmount());
  document.querySelector("#shippingFee").textContent = formatWon(deliveryFee());
  document.querySelector("#draftEstimate").textContent = formatWon(productAmount() + deliveryFee());
  document.querySelectorAll(".size-counter").forEach((counter) => {
    counter.querySelector("output").textContent = quantities[counter.dataset.color][counter.dataset.size];
  });
}

function updateAddressField() {
  const needsAddress = selectedDelivery() === "택배";
  addressField.classList.toggle("is-hidden", !needsAddress);
  addressInput.required = needsAddress;
  if (!needsAddress) addressInput.value = "";
  calculate();
}

function renderEntries(entries = sheetState.entries) {
  if (!entries.length) {
    entryList.innerHTML = "<p>아직 접수된 구매 신청이 없습니다.</p>";
    return;
  }
  entryList.innerHTML = entries.map((entry) => {
    const colorCounts = entry.colorCounts || {};
    const details = COLORS.map((color) => {
      const count = SIZES.reduce((sum, size) => sum + (Number(colorCounts[color]?.[size]) || 0), 0);
      return count ? `${color} ${count}` : "";
    }).filter(Boolean).join(" · ");
    return `<article class="entry-card"><div><strong>${entry.name}</strong><span>${details || `총 ${entry.totalQuantity || 0}장`} · ${entry.delivery || "현장수령"}</span></div><span>${entry.submittedAt ? new Date(entry.submittedAt).toLocaleDateString("ko-KR") : "-"}</span></article>`;
  }).join("");
}

function loadSheetState() {
  const callbackName = `royalblueOrder_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const script = document.createElement("script");
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("구글 시트 접수 내역을 불러오지 못했습니다.")), 8000);
    window[callbackName] = (data) => {
      clearTimeout(timeout);
      sheetState = { entries: Array.isArray(data.entries) ? data.entries : [], spreadsheetUrl: data.spreadsheetUrl || "" };
      if (sheetState.spreadsheetUrl) {
        sheetLink.href = sheetState.spreadsheetUrl;
        sheetLink.classList.remove("is-hidden");
      }
      delete window[callbackName];
      script.remove();
      renderEntries();
      resolve();
    };
    script.onerror = () => { clearTimeout(timeout); reject(new Error("구글 시트에 연결하지 못했습니다.")); };
    const url = new URL(endpoint());
    url.searchParams.set("callback", callbackName);
    script.src = url.toString();
    document.body.appendChild(script);
  });
}

async function submitToSheet(payload) {
  await fetch(endpoint(), { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
}

function payloadFromForm() {
  return {
    submittedAt: new Date().toISOString(),
    name: new FormData(form).get("name")?.trim() || "",
    colorCounts: structuredClone(quantities),
    totalQuantity: totalQuantity(),
    delivery: selectedDelivery(),
    address: addressInput.value.trim(),
    productAmount: productAmount(),
    shippingFee: deliveryFee(),
    totalAmount: productAmount() + deliveryFee(),
  };
}

createCounters();
document.querySelectorAll(".size-counter").forEach((counter) => {
  counter.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const { color, size } = counter.dataset;
    quantities[color][size] = Math.max(0, quantities[color][size] + (button.dataset.action === "plus" ? 1 : -1));
    setStatus("");
    calculate();
  });
});

deliveryRadios.forEach((radio) => radio.addEventListener("change", updateAddressField));
document.querySelector("#refreshEntries").addEventListener("click", async () => {
  setStatus("최근 신청 내역을 불러오는 중입니다.");
  try { await loadSheetState(); setStatus("최신 신청 내역을 불러왔습니다.", "success"); }
  catch (error) { setStatus(error.message, "error"); }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!new FormData(form).get("name")?.trim()) return setStatus("이름을 입력해 주세요.", "error");
  if (!totalQuantity()) return setStatus("구매 수량을 1장 이상 선택해 주세요.", "error");
  if (selectedDelivery() === "택배" && !addressInput.value.trim()) return setStatus("배송 주소를 입력해 주세요.", "error");
  submitButton.disabled = true;
  submitButton.textContent = "접수 중";
  try {
    await submitToSheet(payloadFromForm());
    COLORS.forEach((color) => SIZES.forEach((size) => { quantities[color][size] = 0; }));
    form.reset();
    updateAddressField();
    await loadSheetState();
    setStatus("구매 신청이 접수되었습니다. 안내 계좌로 입금해 주세요.", "success");
  } catch (error) { setStatus(error.message || "접수 중 문제가 발생했습니다.", "error"); }
  finally { submitButton.disabled = false; submitButton.textContent = "구매 신청하기"; calculate(); }
});

calculate();
loadSheetState().catch((error) => setStatus(error.message, "error"));

const lightbox = document.querySelector("#imageLightbox");
const lightboxImage = document.querySelector("#lightboxImage");
document.querySelectorAll(".fit-gallery img, .product-lineup img").forEach((image) => image.addEventListener("click", () => {
  lightboxImage.src = image.currentSrc || image.src;
  lightboxImage.alt = image.alt;
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}));
function closeLightbox() { lightbox.classList.remove("is-open"); lightbox.setAttribute("aria-hidden", "true"); lightboxImage.src = ""; document.body.style.overflow = ""; }
document.querySelector(".image-lightbox__close").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeLightbox(); });

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const SURCHARGE_SIZES = new Set(["2XL", "3XL"]);
const PRICE_TIERS = [
  { min: 200, price: 24300 },
  { min: 100, price: 25100 },
  { min: 50, price: 25900 },
  { min: 30, price: 26100 },
  { min: 20, price: 27000 },
  { min: 5, price: 28000 },
  { min: 1, price: 29000 },
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
const refreshEntries = document.querySelector("#refreshEntries");
const submitButton = document.querySelector("#submitButton");
const endpointInput = document.querySelector("#sheetEndpoint");
const sheetLink = document.querySelector("#sheetLink");
const counters = [...document.querySelectorAll(".size-counter")];
const deliveryRadios = [...document.querySelectorAll('input[name="delivery"]')];
const quantities = Object.fromEntries(SIZES.map((size) => [size, 0]));

let sheetState = {
  totalQuantity: 0,
  entries: [],
  spreadsheetUrl: "",
};

const formatWon = (value) => `${value.toLocaleString("ko-KR")}원`;
const formatCount = (value) => `${value.toLocaleString("ko-KR")}장`;

function totalForCounts(counts) {
  return SIZES.reduce((sum, size) => sum + (Number(counts[size]) || 0), 0);
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

function endpoint() {
  return endpointInput.value.trim();
}

function isEndpointReady() {
  return endpoint() && !endpoint().includes("PASTE_GOOGLE_APPS_SCRIPT");
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

function renderEntries(entries = sheetState.entries) {
  if (!entries.length) {
    entryList.innerHTML = "<p>아직 접수된 수요가 없습니다.</p>";
    return;
  }

  entryList.innerHTML = entries
    .map((entry) => {
      const details = SIZES
        .filter((size) => entry.counts?.[size])
        .map((size) => `${size} ${entry.counts[size]}`)
        .join(" · ");

      return `
        <article class="entry-card">
          <div>
            <strong>${entry.name}</strong>
            <span>${details} · 총 ${formatCount(totalForCounts(entry.counts || {}))} · ${entry.delivery || "현장수령"}</span>
          </div>
          <span>${entry.submittedAt ? new Date(entry.submittedAt).toLocaleDateString("ko-KR") : "-"}</span>
        </article>
      `;
    })
    .join("");
}

function calculate() {
  const savedQuantity = Number(sheetState.totalQuantity) || 0;
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
  renderEntries();
}

function loadSheetState() {
  if (!isEndpointReady()) {
    setStatus("구글 시트 연동 주소를 연결하면 전체 접수 수량을 불러옵니다.", "error");
    renderEntries([]);
    calculate();
    return Promise.resolve();
  }

  const callbackName = `royalblueDemand_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const script = document.createElement("script");

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      delete window[callbackName];
      script.remove();
      reject(new Error("구글 시트에 접근하지 못했습니다. Apps Script 웹앱 액세스 권한을 확인해주세요."));
    }, 8000);

    window[callbackName] = (data) => {
      window.clearTimeout(timeout);
      sheetState = {
        totalQuantity: Number(data.totalQuantity) || 0,
        entries: Array.isArray(data.entries) ? data.entries : [],
        spreadsheetUrl: data.spreadsheetUrl || "",
      };
      if (sheetState.spreadsheetUrl) {
        sheetLink.href = sheetState.spreadsheetUrl;
        sheetLink.classList.remove("is-hidden");
      }
      delete window[callbackName];
      script.remove();
      calculate();
      resolve();
    };

    script.onerror = () => {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      reject(new Error("구글 시트 집계를 불러오지 못했습니다."));
    };

    const url = new URL(endpoint());
    url.searchParams.set("callback", callbackName);
    script.src = url.toString();
    document.body.appendChild(script);
  });
}

async function submitToSheet(payload) {
  if (!isEndpointReady()) {
    throw new Error("구글 시트 연동 주소가 아직 연결되지 않았습니다.");
  }

  await fetch(endpoint(), {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
}

function payloadFromForm() {
  const unitPrice = priceForTotal((Number(sheetState.totalQuantity) || 0) + totalForCounts(quantities));
  return {
    submittedAt: new Date().toISOString(),
    name: new FormData(form).get("name")?.trim() ?? "",
    counts: { ...quantities },
    delivery: selectedDelivery(),
    unitPrice,
    shippingFee: deliveryFee(),
    plusSizeSurcharge:
      (Number(quantities["2XL"]) + Number(quantities["3XL"])) * PLUS_SIZE_SURCHARGE,
    estimatedTotal: estimateForCounts(quantities, unitPrice) + deliveryFee(),
  };
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

refreshEntries.addEventListener("click", async () => {
  setStatus("구글 시트 집계를 불러오는 중입니다.");
  try {
    await loadSheetState();
    setStatus("최신 접수 수량을 불러왔습니다.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

form.addEventListener("submit", async (event) => {
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

  submitButton.disabled = true;
  submitButton.textContent = "저장 중";
  setStatus("구글 시트에 저장하는 중입니다.");

  try {
    await submitToSheet(payloadFromForm());
    SIZES.forEach((size) => {
      quantities[size] = 0;
    });
    form.reset();
    await loadSheetState();
    setStatus("수요가 구글 시트에 저장되었습니다.", "success");
  } catch (error) {
    setStatus(error.message || "저장 중 문제가 발생했습니다.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "수요 저장";
    calculate();
  }
});

calculate();
loadSheetState().catch((error) => setStatus(error.message, "error"));

const lightbox = document.querySelector("#imageLightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxClose = document.querySelector(".image-lightbox__close");
const galleryImages = [...document.querySelectorAll(".fit-gallery img")];

function closeLightbox() {
  if (!lightbox || !lightboxImage) return;

  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImage.src = "";
  lightboxImage.alt = "";
  document.body.style.overflow = "";
}

galleryImages.forEach((image) => {
  image.addEventListener("click", () => {
    if (!lightbox || !lightboxImage) return;

    lightboxImage.src = image.currentSrc || image.src;
    lightboxImage.alt = image.alt;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  });
});

lightboxClose?.addEventListener("click", closeLightbox);

lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLightbox();
});

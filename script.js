const PRICE = 30000;
const SHIPPING = 4500;

const form = document.querySelector("#orderForm");
const quantity = document.querySelector("#quantity");
const deliveryRadios = [...document.querySelectorAll('input[name="delivery"]')];
const addressField = document.querySelector("#addressField");
const addressInput = document.querySelector('textarea[name="address"]');
const shirtTotal = document.querySelector("#shirtTotal");
const shippingTotal = document.querySelector("#shippingTotal");
const grandTotal = document.querySelector("#grandTotal");
const statusMessage = document.querySelector("#formStatus");
const submitButton = document.querySelector("#submitButton");
const endpointInput = document.querySelector("#sheetEndpoint");

const formatWon = (value) => `${value.toLocaleString("ko-KR")}원`;

function selectedDelivery() {
  return deliveryRadios.find((radio) => radio.checked)?.value ?? "직접수령";
}

function totals() {
  const count = Math.max(1, Number(quantity.value || 1));
  const shipping = selectedDelivery() === "배송" ? SHIPPING : 0;
  const shirt = PRICE * count;

  return {
    count,
    shirt,
    shipping,
    total: shirt + shipping,
  };
}

function calculate() {
  const amount = totals();
  const hasShipping = selectedDelivery() === "배송";

  shirtTotal.textContent = formatWon(amount.shirt);
  shippingTotal.textContent = formatWon(amount.shipping);
  grandTotal.textContent = formatWon(amount.total);
  addressField.classList.toggle("is-hidden", !hasShipping);
  addressInput.required = hasShipping;
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `form-status${type ? ` is-${type}` : ""}`;
}

function payloadFromForm() {
  const data = new FormData(form);
  const amount = totals();

  return {
    submittedAt: new Date().toISOString(),
    name: data.get("name")?.trim() ?? "",
    phone: data.get("phone")?.trim() ?? "",
    quantity: amount.count,
    size: data.get("size") ?? "",
    delivery: data.get("delivery") ?? "직접수령",
    address: data.get("address")?.trim() ?? "",
    message: data.get("message")?.trim() ?? "",
    itemPrice: PRICE,
    shippingFee: amount.shipping,
    totalPrice: amount.total,
  };
}

async function submitToSheet(payload) {
  const endpoint = endpointInput.value.trim();

  if (!endpoint || endpoint.includes("PASTE_GOOGLE_APPS_SCRIPT")) {
    throw new Error("구글 시트 연동 주소가 아직 연결되지 않았습니다.");
  }

  await fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
}

quantity.addEventListener("input", calculate);
deliveryRadios.forEach((radio) => radio.addEventListener("change", calculate));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  calculate();

  if (!form.reportValidity()) return;

  submitButton.disabled = true;
  submitButton.textContent = "신청 중";
  setStatus("신청 내용을 구글 시트로 보내는 중입니다.");

  try {
    await submitToSheet(payloadFromForm());
    form.reset();
    calculate();
    setStatus("신청이 접수되었습니다. 입금까지 완료하면 신청이 확정됩니다.", "success");
  } catch (error) {
    setStatus(error.message || "전송 중 문제가 발생했습니다. 운영진에게 문의해주세요.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "신청하기";
  }
});

calculate();

// Toggle FHB extra fields
document.getElementById("mcFHB").addEventListener("change", function () {
  document.getElementById("mcFHBExtra").hidden = !this.checked;
});

async function calcMortgage() {
  const pv       = parseFloat(document.getElementById("mcPropertyValue").value);
  const dep      = parseFloat(document.getElementById("mcDeposit").value);
  const rate     = parseFloat(document.getElementById("mcRate").value);
  const state    = document.getElementById("mcState").value;
  const term     = parseInt(document.getElementById("mcTerm").value);
  const loanType = document.getElementById("mcLoanType").value;
  const freq     = document.getElementById("mcFreq").value;
  const offset   = parseFloat(document.getElementById("mcOffset").value) || 0;
  const annualFee   = parseFloat(document.getElementById("mcAnnualFee").value) || 0;
  const upfrontFee  = parseFloat(document.getElementById("mcUpfrontFee").value) || 0;
  const fhb      = document.getElementById("mcFHB").checked;
  const newHome  = document.getElementById("mcNewHome").checked;
  const invest   = document.getElementById("mcInvestment").checked;
  const income   = parseFloat(document.getElementById("mcIncome").value) || 0;
  const couple   = document.getElementById("mcCouple").checked;

  const errEl    = document.getElementById("mcError");
  const resultsEl = document.getElementById("mcResults");

  errEl.hidden = true;
  resultsEl.hidden = true;

  if (!pv || !dep || !rate) {
    errEl.textContent = "Please fill in Property Value, Deposit, and Interest Rate.";
    errEl.hidden = false;
    return;
  }

  const btn = document.querySelector(".mc-submit-btn");
  btn.textContent = "Calculating…";
  btn.disabled = true;

  try {
    const res = await fetch("/api/mortgage-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_value: pv,
        deposit: dep,
        annual_rate_pct: rate,
        state,
        loan_term_years: term,
        loan_type: loanType,
        frequency: freq,
        offset_balance: offset,
        annual_fee: annualFee,
        upfront_fee: upfrontFee,
        is_first_home_buyer: fhb,
        is_new_home: newHome,
        is_investment: invest,
        annual_income: income,
        is_couple: couple,
      }),
    });

    const data = await res.json();

    if (data.error) {
      errEl.textContent = data.error;
      errEl.hidden = false;
      return;
    }

    renderResults(data, freq);
    resultsEl.hidden = false;
    resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
  } finally {
    btn.textContent = "Calculate";
    btn.disabled = false;
  }
}

function renderResults(data, freq) {
  const r = data.repayments;
  const u = data.upfront_costs;
  const l = data.loan_details;
  const fhb = data.first_home_buyer;

  const perLabel = { monthly: "/ month", fortnightly: "/ fortnight", weekly: "/ week" }[freq] || "";

  document.getElementById("resRepayment").textContent    = fmt(r.repayment);
  document.getElementById("resRepaymentSub").textContent = perLabel;
  document.getElementById("resLVR").textContent          = `${l.lvr_pct.toFixed(1)}%`;
  document.getElementById("resCompRate").textContent     = `${r.comparison_rate_pct.toFixed(2)}%`;
  document.getElementById("resTotalInterest").textContent = fmt(r.total_interest);

  // Loan summary table
  rows("resLoanTable", [
    ["Property Value",  fmt(l.property_value)],
    ["Loan Amount",     fmt(l.loan_amount)],
    ["Deposit",         fmt(l.deposit)],
    ["LVR",             `${l.lvr_pct.toFixed(2)}%`],
    ["Loan Type",       l.loan_type],
    ["Loan Term",       `${l.loan_term_years} years`],
    ["Repayment",       `${fmt(r.repayment)} ${perLabel}`],
    ["Total Interest",  fmt(r.total_interest)],
    ["Total Cost",      fmt(r.total_cost)],
  ]);

  // Upfront costs table
  rows("resUpfrontTable", [
    ["Stamp Duty",            fmt(u.stamp_duty)],
    ["Stamp Duty Concession", u.stamp_duty_concession || "None"],
    ["LMI Premium",           fmt(u.lmi_premium)],
    ["LMI Stamp Duty",        fmt(u.lmi_stamp_duty)],
    ["LMI Total",             fmt(u.lmi_total)],
    ["Upfront Fee",           fmt(u.upfront_fee)],
    ["Total Upfront",         fmt(u.total_upfront)],
    ["Cash to Settle",        fmt(u.cash_to_settle)],
  ]);

  // FHB section
  const fhbSection = document.getElementById("resFHBSection");
  if (fhb) {
    rows("resFHBTable", [
      ["FHOG Amount",                   fmt(fhb.fhog_amount)],
      ["FHOG Eligible",                 fhb.fhog_eligible ? "Yes" : "No"],
      ["First Home Guarantee",          fhb.first_home_guarantee_eligible ? "Eligible" : "Not eligible"],
      ["Regional Home Guarantee",       fhb.regional_home_guarantee_eligible ? "Eligible" : "Not eligible"],
      ["Help to Buy",                   fhb.help_to_buy_eligible ? "Eligible" : "Not eligible"],
      ["State Shared Equity",           fhb.state_shared_equity || "N/A"],
      ["Total Cash Assistance",         fmt(fhb.total_cash_assistance)],
      ...(fhb.notes || []).map((n, i) => [`Note ${i + 1}`, n]),
    ]);
    fhbSection.hidden = false;
  } else {
    fhbSection.hidden = true;
  }

  // Rate sensitivity table
  const tbody = document.getElementById("resSensitivityTable");
  tbody.innerHTML = (data.rate_sensitivity || []).map(s => {
    const cls = s.rate_change_bps === 0 ? " class=\"mc-row-current\"" : "";
    const sign = s.rate_change_bps > 0 ? "+" : "";
    return `<tr${cls}><td>${sign}${s.rate_change_bps} bps</td><td>${s.annual_rate_pct.toFixed(2)}%</td><td>${fmt(s.repayment)}</td><td>${fmt(s.total_interest)}</td></tr>`;
  }).join("");
}

function rows(tbodyId, pairs) {
  document.getElementById(tbodyId).innerHTML = pairs.map(([label, val]) =>
    `<tr><td class="mc-td-label">${label}</td><td class="mc-td-val">${val}</td></tr>`
  ).join("");
}

function fmt(n) {
  return Number(n).toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

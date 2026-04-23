/**
 * 대장옥션 부동산 수익률 분석표 — 자동계산 엔진
 * ▶ 엑셀 수식 완전 이식
 * ▶ 양도세 사전 예측 (양도차익 → 장기보유공제 → 기본공제 → 누진세율)
 * ▶ 입력 즉시 실시간 반영
 */

/* ===================================================
   전역 상태
   =================================================== */
let selectedPropertyType = '아파트';
let selectedHoldingMonths = 12;

/* ===================================================
   유틸리티
   =================================================== */
function v(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const val = parseFloat(el.value);
  return isNaN(val) ? 0 : val;
}

function fmt(num) {
  if (num === 0 || isNaN(num)) return '0원';
  const abs = Math.abs(num);
  let str = '';
  if (abs >= 100000000) {
    const eok = Math.floor(abs / 100000000);
    const man = Math.floor((abs % 100000000) / 10000);
    str = eok + '억' + (man > 0 ? ' ' + man.toLocaleString() + '만' : '');
  } else if (abs >= 10000) {
    str = Math.floor(abs / 10000).toLocaleString() + '만';
  } else {
    str = abs.toLocaleString();
  }
  return (num < 0 ? '-' : '') + str + '원';
}

function fmtFull(num) {
  if (isNaN(num)) return '0원';
  return (num < 0 ? '-' : '') + Math.abs(Math.round(num)).toLocaleString() + '원';
}

function fmtPct(num) {
  if (isNaN(num) || !isFinite(num)) return '-';
  return (num * 100).toFixed(1) + '%';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ===================================================
   UI 컨트롤
   =================================================== */
function selectType(btn) {
  document.querySelectorAll('#propertyTypeGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedPropertyType = btn.dataset.value;
  calcAll();
}

function selectHolding(btn) {
  document.querySelectorAll('#holdingPeriodGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedHoldingMonths = parseInt(btn.dataset.value);
  calcAll();
}

function updateLoanRatio() {
  const v = document.getElementById('loanRatio').value;
  document.getElementById('loanRatioDisplay').textContent = v + '%';
  calcAll();
}

function updateInterestRate() {
  const v = parseFloat(document.getElementById('interestRate').value).toFixed(1);
  document.getElementById('interestRateDisplay').textContent = v + '%';
  calcAll();
}

function sqmToPyeong() {
  const sqm = parseFloat(document.getElementById('buildingAreaSqm').value);
  if (!isNaN(sqm)) {
    document.getElementById('buildingAreaPyeong').value = (sqm / 3.3058).toFixed(2);
  }
  autoFillCosts();
  calcAll();
}

function pyeongToSqm() {
  const pyeong = parseFloat(document.getElementById('buildingAreaPyeong').value);
  if (!isNaN(pyeong)) {
    document.getElementById('buildingAreaSqm').value = (pyeong * 3.3058).toFixed(2);
  }
  autoFillCosts();
  calcAll();
}

function autoFillCosts() {
  const pyeong = parseFloat(document.getElementById('buildingAreaPyeong').value);
  if (!isNaN(pyeong) && pyeong > 0) {
    const eviction = document.getElementById('evictionCost');
    const repair = document.getElementById('repairCost');
    // 사용자가 직접 수정하지 않은 경우에만 자동 적용
    if (!eviction.dataset.userEdited) {
      eviction.value = Math.floor(pyeong * 100000 / 10000) * 10000;
    }
    if (!repair.dataset.userEdited) {
      repair.value = Math.floor(pyeong * 200000 / 10000) * 10000;
    }
  }
}

// 사용자 직접 수정 플래그
document.addEventListener('DOMContentLoaded', () => {
  ['evictionCost', 'repairCost'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        el.dataset.userEdited = 'true';
      });
    }
  });
});

/* ===================================================
   양도소득세 누진세율 계산 (국세청 기준 2026)
   - 과세표준 = 양도차익 - 장기보유특별공제 - 기본공제(250만)
   =================================================== */
function calcProgressiveTax(taxableBase) {
  if (taxableBase <= 0) return 0;
  // 세율 구간: [상한, 세율, 누진공제]
  const brackets = [
    [14000000,    0.06,  0],
    [50000000,    0.15,  1260000],
    [88000000,    0.24,  5760000],
    [150000000,   0.35,  15440000],
    [300000000,   0.38,  19940000],
    [500000000,   0.40,  25940000],
    [1000000000,  0.42,  35940000],
    [Infinity,    0.45,  65940000],
  ];
  for (const [limit, rate, deduction] of brackets) {
    if (taxableBase <= limit) {
      return taxableBase * rate - deduction;
    }
  }
  return 0;
}

/* ===================================================
   장기보유특별공제율 (일반 — 3년 이상)
   =================================================== */
function getLTHCRate(holdingMonths) {
  const years = holdingMonths / 12;
  if (years < 3)  return 0;
  if (years < 4)  return 0.06;
  if (years < 5)  return 0.08;
  if (years < 6)  return 0.10;
  if (years < 7)  return 0.12;
  if (years < 8)  return 0.14;
  if (years < 9)  return 0.16;
  if (years < 10) return 0.18;
  if (years < 15) return 0.20;
  return 0.30; // 15년 이상
}

/* ===================================================
   양도세 자동 계산 (전체 플로우)
   =================================================== */
function calcTransferTax(params) {
  const { bidPrice, salePrice, totalAdditionalCost, holdingMonths, taxTypeVal } = params;
  // 양도차익 = 매도가 - 낙찰가 (취득가액으로 간주)
  const gain = salePrice - bidPrice;

  let taxAmount = 0;
  let appliedRate = 0;
  let lthcAmt = 0;
  let basicDeduction = 2500000;
  let taxableBase = 0;
  let rateLabel = '-';
  let isProgressive = false;

  if (taxTypeVal === 'auto') {
    // 보유기간에 따라 자동 결정
    if (holdingMonths < 12) {
      appliedRate = 0.70;
      taxAmount = gain > 0 ? gain * 0.70 : 0;
      rateLabel = '70% (1년 미만 단기)';
    } else if (holdingMonths < 24) {
      appliedRate = 0.60;
      taxAmount = gain > 0 ? gain * 0.60 : 0;
      rateLabel = '60% (1~2년 미만)';
    } else {
      // 2년 이상: 누진세율
      isProgressive = true;
      const lthcRate = getLTHCRate(holdingMonths);
      lthcAmt = gain > 0 ? gain * lthcRate : 0;
      taxableBase = Math.max(0, gain - lthcAmt - basicDeduction);
      taxAmount = calcProgressiveTax(taxableBase);
      appliedRate = taxableBase > 0 ? taxAmount / taxableBase : 0;
      rateLabel = '누진세율 6~45% (2년 이상)';
    }
  } else if (taxTypeVal === 'progressive') {
    isProgressive = true;
    const lthcRate = getLTHCRate(holdingMonths);
    lthcAmt = gain > 0 ? gain * lthcRate : 0;
    taxableBase = Math.max(0, gain - lthcAmt - basicDeduction);
    taxAmount = calcProgressiveTax(taxableBase);
    appliedRate = taxableBase > 0 ? taxAmount / taxableBase : 0;
    rateLabel = '누진세율 6~45%';
  } else {
    const rate = parseFloat(taxTypeVal);
    if (!isNaN(rate) && gain > 0) {
      taxAmount = gain * rate;
      appliedRate = rate;
      rateLabel = (rate * 100).toFixed(0) + '%';
    }
  }

  if (taxAmount < 0) taxAmount = 0;

  return {
    gain,
    lthcAmt,
    basicDeduction: isProgressive ? basicDeduction : 0,
    taxableBase: isProgressive ? taxableBase : (gain > 0 ? gain : 0),
    taxAmount,
    appliedRate,
    rateLabel,
    isProgressive,
  };
}

/* ===================================================
   메인 계산 함수
   =================================================== */
function calcAll() {
  /* ── 입력값 수집 ── */
  const appraisedValue  = v('appraisedValue');
  const minBidPrice     = v('minBidPrice');
  const bidPrice        = v('bidPrice');
  const loanRatioPct    = parseInt(document.getElementById('loanRatio').value || 80);
  const loanRatio       = loanRatioPct / 100;
  const acqTaxRate      = parseFloat(document.getElementById('acquisitionTaxType').value);
  const evictionCost    = v('evictionCost');
  const repairCost      = v('repairCost');
  const legalCost       = v('legalCost') || 1000000;
  const unpaidMgmt      = v('unpaidMgmt');
  const seniorDeposit   = v('seniorDeposit');
  const rentalDeposit   = v('rentalDeposit');
  const monthlyRent     = v('monthlyRent');
  const salePrice       = v('salePrice');
  const interestRate    = parseFloat(document.getElementById('interestRate').value || 4) / 100;
  const holdingMonths   = selectedHoldingMonths;
  const taxTypeVal      = document.getElementById('transferTaxType').value;

  /* ── 자동 계산: 명도비·수리비 (면적 있으면) ── */
  const pyeong = parseFloat(document.getElementById('buildingAreaPyeong').value);
  if (!isNaN(pyeong) && pyeong > 0) {
    const evEl = document.getElementById('evictionCost');
    const repEl = document.getElementById('repairCost');
    if (!evEl.dataset.userEdited && evEl.value === '') {
      evEl.value = Math.floor(pyeong * 100000 / 10000) * 10000;
    }
    if (!repEl.dataset.userEdited && repEl.value === '') {
      repEl.value = Math.floor(pyeong * 200000 / 10000) * 10000;
    }
  }

  /* ── 기본값이 없으면 계산 중단 ── */
  if (bidPrice === 0 && appraisedValue === 0) {
    updateTaxPreview(null);
    return;
  }

  /* ─────────────────────────────────
     1. 초기 투자비용 계산
     ───────────────────────────────── */
  const loanAmt         = bidPrice * loanRatio;                    // 은행 대출금
  const bidDeposit      = minBidPrice > 0 ? Math.ceil(minBidPrice / 10 / 10000) * 10000 : 0; // 입찰보증금 = 최저가/10
  const finalPayment    = Math.max(0, bidPrice - loanAmt - bidDeposit); // 납부 잔금

  // 취득세
  const acquisitionTax  = Math.round(bidPrice * acqTaxRate);

  // 추가 비용 합계 (a)
  const totalAdditionalCost = acquisitionTax + evictionCost + repairCost + legalCost + unpaidMgmt + seniorDeposit;

  /* ─────────────────────────────────
     2. 보유 중 지출 계산
     ───────────────────────────────── */
  const monthlyInterest  = Math.round((loanAmt * interestRate) / 12);       // 월 이자
  const totalInterest    = monthlyInterest * holdingMonths;                  // 보유기간 이자
  const brokerage        = Math.round(salePrice * 0.004);                    // 중개수수료 0.4%

  // 지출 합계 (b)
  const totalExpense = totalInterest + brokerage;

  /* ─────────────────────────────────
     3. 수입 계산
     ───────────────────────────────── */
  const totalRentalIncome = monthlyRent * holdingMonths;

  /* ─────────────────────────────────
     4. 자기자본 & 수익 계산
     ───────────────────────────────── */
  // 자기자본 투입액 = 잔금 + 추가비용
  const ownCapital       = finalPayment + totalAdditionalCost;
  // 총 투자금액 = 낙찰가 + 추가비용
  const totalInvestment  = bidPrice + totalAdditionalCost;
  // 세전 순수익 = 매도가 - 낙찰가 - 추가비용(a) - 지출(b) + 임대수입
  const netProfit        = (salePrice - bidPrice) - totalAdditionalCost - totalExpense + totalRentalIncome;
  // 세전 수익률 = 순수익 / 자기자본
  const roi              = ownCapital > 0 ? netProfit / ownCapital : 0;

  /* ─────────────────────────────────
     5. 양도세 자동 계산
     ───────────────────────────────── */
  const taxResult = calcTransferTax({
    bidPrice,
    salePrice,
    totalAdditionalCost,
    holdingMonths,
    taxTypeVal,
  });

  const transferTaxAmt   = taxResult.taxAmount;
  // 세후 순수익 = 세전 순수익 - 양도세
  const afterTaxProfit   = netProfit - transferTaxAmt;
  // 세후 수익률
  const afterTaxROI      = ownCapital > 0 ? afterTaxProfit / ownCapital : 0;

  /* ─────────────────────────────────
     6. 입찰 자동 계산 행 업데이트
     ───────────────────────────────── */
  if (bidPrice > 0) {
    const bidRow = document.getElementById('bidCalcRow');
    bidRow.style.display = 'flex';
    setText('displayDeposit', fmt(bidDeposit));
    setText('displayBidRatio', appraisedValue > 0 ? fmtPct(bidPrice / appraisedValue) : '-');
  }

  if (bidPrice > 0) {
    const loanRow = document.getElementById('loanCalcRow');
    loanRow.style.display = 'flex';
    setText('displayLoanAmt', fmt(loanAmt));
    setText('displayRemaining', fmt(finalPayment));
  }

  /* ─────────────────────────────────
     7. 양도세 미리보기 박스 업데이트
     ───────────────────────────────── */
  updateTaxPreview(taxResult, salePrice, bidPrice);

  /* ─────────────────────────────────
     8. 결과 패널 업데이트
     ───────────────────────────────── */
  if (bidPrice > 0 && salePrice > 0) {
    showResults({
      loanAmt, bidDeposit, finalPayment,
      ownCapital, totalAdditionalCost, totalExpense,
      acquisitionTax, evictionCost: v('evictionCost'), repairCost: v('repairCost'),
      legalCost, unpaidMgmt, seniorDeposit,
      rentalDeposit, totalRentalIncome,
      monthlyInterest, totalInterest, brokerage,
      bidPrice, salePrice, totalInvestment,
      netProfit, transferTaxAmt, afterTaxProfit,
      roi, afterTaxROI, taxResult,
    });
  }
}

/* ===================================================
   양도세 미리보기 박스 업데이트
   =================================================== */
function updateTaxPreview(taxResult, salePrice, bidPrice) {
  if (!taxResult || salePrice === 0 || bidPrice === 0) {
    setText('tpGain', '-');
    setText('tpLthc', '-');
    setText('tpBasic', '-');
    setText('tpBase', '-');
    setText('tpRate', '-');
    setText('tpTaxAmt', '-');
    return;
  }
  const { gain, lthcAmt, basicDeduction, taxableBase, taxAmount, rateLabel, isProgressive } = taxResult;
  setText('tpGain', gain > 0 ? fmt(gain) : '0원 (차익 없음)');
  setText('tpLthc', isProgressive && lthcAmt > 0 ? '−' + fmt(lthcAmt) : '해당없음');
  setText('tpBasic', isProgressive && basicDeduction > 0 ? '−' + fmt(basicDeduction) : '해당없음');
  setText('tpBase', gain > 0 ? fmt(taxableBase) : '0원');
  setText('tpRate', rateLabel);
  setText('tpTaxAmt', taxAmount > 0 ? fmt(taxAmount) : '0원 (비과세 또는 차익 없음)');
}

/* ===================================================
   결과 패널 표시
   =================================================== */
function showResults(d) {
  document.getElementById('resultPlaceholder').style.display = 'none';
  document.getElementById('resultContent').style.display = 'flex';

  /* 요약 카드 */
  setText('rOwnCapital',       fmt(d.ownCapital));
  setText('rNetProfit',        fmt(d.netProfit));
  setText('rAfterTaxProfit',   fmt(d.afterTaxProfit));

  /* 수익률 게이지 */
  const roiPct = d.roi * 100;
  const clampedPct = Math.min(Math.max(roiPct, -10), 50);
  const normalizedOffset = 283 * (1 - (clampedPct + 10) / 60);
  const gaugeFill = document.getElementById('gaugeFill');
  if (gaugeFill) gaugeFill.style.strokeDashoffset = Math.max(0, normalizedOffset).toFixed(1);
  setText('gaugeText', fmtPct(d.roi));
  setText('gaugeTaxLabel', '세전 수익률');

  setText('rROI',         fmtPct(d.roi));
  setText('rAfterTaxROI', fmtPct(d.afterTaxROI));

  /* 등급 배지 */
  const gradeBadge = document.getElementById('gradeBadge');
  let grade = '';
  if (d.afterTaxROI >= 0.30) {
    grade = '⭐ 최우수 (세후 30%↑)';
    gradeBadge.className = 'grade-badge grade-best';
  } else if (d.afterTaxROI >= 0.20) {
    grade = '✅ 우수 (세후 20%↑)';
    gradeBadge.className = 'grade-badge grade-good';
  } else if (d.afterTaxROI >= 0.10) {
    grade = '🔵 양호 (세후 10%↑)';
    gradeBadge.className = 'grade-badge grade-ok';
  } else if (d.afterTaxROI >= 0) {
    grade = '⚠️ 낮음 (세후 10% 미만)';
    gradeBadge.className = 'grade-badge grade-low';
  } else {
    grade = '🔴 주의 (손실 구간)';
    gradeBadge.className = 'grade-badge grade-loss';
  }
  setText('gradeBadge', grade);

  /* 비교 바 차트 */
  const maxVal = Math.max(Math.abs(d.netProfit), Math.abs(d.transferTaxAmt), Math.abs(d.afterTaxProfit), 1);
  setBar('barBeforeTax', 'cBarBeforeAmt', d.netProfit, maxVal, false);
  setBar('barTax',       'cBarTaxAmt',    d.transferTaxAmt, maxVal, true);
  setBar('barAfterTax',  'cBarAfterAmt',  d.afterTaxProfit, maxVal, false);

  /* 절세 팁 */
  const tipBox = document.getElementById('taxSavingTip');
  const tipText = document.getElementById('taxSavingTipText');
  const holdingYears = selectedHoldingMonths / 12;
  if (holdingYears < 2 && d.transferTaxAmt > 0) {
    tipBox.style.display = 'flex';
    const savedTax = d.transferTaxAmt - calcTransferTaxSimple(d.taxResult.gain, 24);
    tipText.innerHTML = `💡 <strong>절세 팁:</strong> 현재 ${selectedHoldingMonths}개월 보유 예정이라 세율이 높습니다. 
      <strong>2년 이상</strong> 보유하면 누진세율(6~45%)이 적용되어 세금을 크게 줄일 수 있습니다.
      예상 절세 효과: <strong>${fmt(Math.abs(savedTax))} 절감</strong>`;
  } else if (holdingYears >= 2 && holdingYears < 3 && d.taxResult.gain > 0) {
    tipBox.style.display = 'flex';
    tipText.innerHTML = `💡 <strong>절세 팁:</strong> 1년만 더 보유하면 (3년 이상) 장기보유특별공제 <strong>6%</strong>가 추가 적용됩니다.
      양도차익 ${fmt(d.taxResult.gain)} 기준 약 <strong>${fmt(d.taxResult.gain * 0.06 * 0.35)} 절세</strong> 가능합니다.`;
  } else {
    tipBox.style.display = 'none';
  }

  /* 상세 표 */
  setText('tBidPrice',      fmt(d.bidPrice));
  setText('tLoanAmt',       '−' + fmt(d.loanAmt));
  setText('tBidDeposit',    fmt(d.bidDeposit));
  setText('tFinalPayment',  fmt(d.finalPayment));
  setText('tAcqTax',        fmt(d.acquisitionTax));
  setText('tEviction',      fmt(d.evictionCost));
  setText('tRepair',        fmt(d.repairCost));
  setText('tLegal',         fmt(d.legalCost));
  setText('tUnpaid',        fmt(d.unpaidMgmt));
  setText('tSeniorDep',     fmt(d.seniorDeposit));
  setText('tTotalCost',     fmt(d.totalAdditionalCost));
  setText('tMonthlyInterest', fmt(d.monthlyInterest) + '/월');
  setText('tTotalInterest', fmt(d.totalInterest));
  setText('tBrokerage',     fmt(d.brokerage));
  setText('tTotalExpense',  fmt(d.totalExpense));
  setText('tRentalDeposit', fmt(d.rentalDeposit));
  setText('tRentalIncome',  fmt(d.totalRentalIncome));
  setText('tSalePrice',     fmt(d.salePrice));
  setText('tOwnCapital',    fmt(d.ownCapital));
  setText('tTotalInvest',   fmt(d.totalInvestment));
  setText('tNetProfit',     fmt(d.netProfit));
  setText('tTransferTax',   fmt(d.transferTaxAmt));
  setText('tAfterTaxProfit',fmt(d.afterTaxProfit));
  setText('tROI',           fmtPct(d.roi));
  setText('tAfterTaxROI',   fmtPct(d.afterTaxROI));

  /* 스크롤 이동 (모바일) */
  if (window.innerWidth <= 960) {
    document.getElementById('resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ===================================================
   바 차트 설정
   =================================================== */
function setBar(barId, amtId, value, maxVal, isNegative) {
  const barEl = document.getElementById(barId);
  const amtEl = document.getElementById(amtId);
  const pct = Math.min(100, (Math.abs(value) / maxVal) * 100);
  if (barEl) barEl.style.width = pct + '%';
  if (amtEl) amtEl.textContent = fmt(value);
}

/* ===================================================
   절세 계산 간편 버전 (팁용)
   =================================================== */
function calcTransferTaxSimple(gain, holdingMonths) {
  if (gain <= 0) return 0;
  if (holdingMonths < 12) return gain * 0.70;
  if (holdingMonths < 24) return gain * 0.60;
  const lthcRate = getLTHCRate(holdingMonths);
  const taxable = Math.max(0, gain - gain * lthcRate - 2500000);
  return calcProgressiveTax(taxable);
}

/* ===================================================
   초기화
   =================================================== */
function resetAll() {
  // 입력 필드 초기화
  const inputs = document.querySelectorAll('input[type="text"], input[type="number"]');
  inputs.forEach(el => {
    if (el.id === 'legalCost') { el.value = '1000000'; }
    else { el.value = ''; }
    delete el.dataset.userEdited;
  });
  // 슬라이더 초기화
  document.getElementById('loanRatio').value = 80;
  document.getElementById('loanRatioDisplay').textContent = '80%';
  document.getElementById('interestRate').value = 4;
  document.getElementById('interestRateDisplay').textContent = '4.0%';
  // 버튼 토글 초기화
  document.querySelectorAll('#propertyTypeGroup .btn-toggle').forEach((b, i) => {
    b.classList.toggle('active', i === 0);
  });
  document.querySelectorAll('#holdingPeriodGroup .btn-toggle').forEach((b) => {
    b.classList.toggle('active', b.dataset.value === '12');
  });
  selectedPropertyType = '아파트';
  selectedHoldingMonths = 12;
  // 셀렉트 초기화
  document.getElementById('acquisitionTaxType').selectedIndex = 0;
  document.getElementById('transferTaxType').selectedIndex = 0;
  // 자동 계산 행 숨기기
  document.getElementById('bidCalcRow').style.display = 'none';
  document.getElementById('loanCalcRow').style.display = 'none';
  // 결과 패널 초기화
  document.getElementById('resultPlaceholder').style.display = 'block';
  document.getElementById('resultContent').style.display = 'none';
  // 양도세 미리보기 초기화
  updateTaxPreview(null);
}

/* ===================================================
   모달 제어
   =================================================== */
function openTaxModal() {
  document.getElementById('taxModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeTaxModal(event) {
  if (event === null || event.target === document.getElementById('taxModal')) {
    document.getElementById('taxModal').classList.remove('open');
    document.body.style.overflow = '';
  }
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTaxModal(null);
});

/* ===================================================
   초기 실행
   =================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // 슬라이더 이벤트 연결
  document.getElementById('loanRatio').addEventListener('input', updateLoanRatio);
  document.getElementById('interestRate').addEventListener('input', updateInterestRate);
  // 모든 입력 필드에 실시간 계산 연결
  document.querySelectorAll('input[type="number"], select').forEach(el => {
    el.addEventListener('input', calcAll);
    el.addEventListener('change', calcAll);
  });
  // 초기 상태 표시
  updateTaxPreview(null);
});

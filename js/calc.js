/**
 * 대장옥션 종합 계산기 — 통합 계산 엔진
 * 수익률분석 / 취득세 / 중개수수료 / 임대수익률 / 전월세전환 /
 * 대출이자 / DSR·LTV / 증여세 / 상속세 / 종부세 / 재산세 / 양도세
 */

'use strict';

/* =====================================================
   ① 한글 금액 표기 (숫자 → "1억 2,500만원")
   ===================================================== */
function fmtKrw(n) {
  if (!n || isNaN(n) || n === 0) return '';
  const abs = Math.abs(n);
  const eok = Math.floor(abs / 100000000);
  const man = Math.floor((abs % 100000000) / 10000);
  const won = abs % 10000;
  let s = '';
  if (eok > 0) s += eok.toLocaleString() + '억 ';
  if (man > 0) s += man.toLocaleString() + '만 ';
  if (won > 0 && eok === 0 && man === 0) s += won.toLocaleString();
  return (n < 0 ? '-' : '') + s.trim() + '원';
}

function showKrw(input, dispId) {
  const v = parseFloat(input.value);
  const el = document.getElementById(dispId);
  if (!el) return;
  if (!v || isNaN(v) || v === 0) { el.textContent = ''; el.style.display = 'none'; return; }
  el.textContent = fmtKrw(v);
  el.style.display = 'inline-block';
}

/* =====================================================
   ② 물건 종류 선택 (취득세 구분 자동 안내용)
   ===================================================== */
let _roiHouseCount = 0;
let _roiArea       = '비조정';

// 삭제된 UI 잔여 핸들러 — 혹시 남아있는 이벤트 무시용
function selHouseCount(btn) { roiCalc(); }
function selArea(btn) { roiCalc(); }

/* =====================================================
   ③ 양도세 구분 변경 시 데이터 유지
   ===================================================== */
function roiTaxTypeChange() {
  roiCalc();
}


/* =====================================================
   공통 유틸
   ===================================================== */
const $ = id => document.getElementById(id);
const vn = id => { const v = parseFloat($$(id)?.value); return isNaN(v) ? 0 : v; };
const $$ = id => document.getElementById(id);

function num(id) {
  const el = $$(id); if (!el) return 0;
  const v = parseFloat(el.value); return isNaN(v) ? 0 : v;
}

function fmt(n) {
  if (n === 0 || isNaN(n)) return '0원';
  const abs = Math.abs(n);
  let s = '';
  if (abs >= 100000000) {
    const e = Math.floor(abs / 100000000);
    const m = Math.floor((abs % 100000000) / 10000);
    s = e + '억' + (m > 0 ? ' ' + m.toLocaleString() + '만' : '');
  } else if (abs >= 10000) {
    s = Math.floor(abs / 10000).toLocaleString() + '만';
  } else { s = abs.toLocaleString(); }
  return (n < 0 ? '-' : '') + s + '원';
}

function pct(n, d = 1) {
  if (isNaN(n) || !isFinite(n)) return '-';
  return (n * 100).toFixed(d) + '%';
}

function set(id, v) { const el = $$(id); if (el) el.textContent = v; }
function show(id) { const el = $$(id); if (el) el.style.display = ''; }
function hide(id) { const el = $$(id); if (el) el.style.display = 'none'; }
function showFlex(id) { const el = $$(id); if (el) el.style.display = 'flex'; }

/* 누진세 계산 (양도세·증여세·상속세 공용) */
function progressive(base, brackets) {
  if (base <= 0) return 0;
  for (const [limit, rate, ded] of brackets) {
    if (base <= limit) return base * rate - ded;
  }
  return 0;
}

/* 양도세 누진세율 구간 */
const TRANSFER_TAX = [
  [14000000, .06, 0],
  [50000000, .15, 1260000],
  [88000000, .24, 5760000],
  [150000000, .35, 15440000],
  [300000000, .38, 19940000],
  [500000000, .40, 25940000],
  [1000000000, .42, 35940000],
  [Infinity, .45, 65940000],
];

/* 장기보유특별공제 */
function lthcRate(months) {
  const y = months / 12;
  if (y < 3)  return 0;
  if (y < 4)  return .06;
  if (y < 5)  return .08;
  if (y < 6)  return .10;
  if (y < 7)  return .12;
  if (y < 8)  return .14;
  if (y < 9)  return .16;
  if (y < 10) return .18;
  if (y < 15) return .20;
  return .30;
}

/* =====================================================
   탭 전환
   ===================================================== */
function switchTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const pane = $$('tab-' + name);
  if (pane) pane.classList.add('active');
}

/* =====================================================
   모달
   ===================================================== */
function openModal(id) { const el = $$(id); if (el) el.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id, e) {
  if (e === null || (e && e.target === $$(id))) {
    const el = $$(id); if (el) el.classList.remove('open');
    document.body.style.overflow = '';
  }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.querySelectorAll('.modal-overlay.open').forEach(m => { m.classList.remove('open'); document.body.style.overflow = ''; }); } });

/* =====================================================
   참고표 토글
   ===================================================== */
function toggleRef(id) {
  const el = $$(id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

/* =====================================================
   TAB 1: 수익률 분석표
   ===================================================== */
let _propType = '아파트';
let _holdMonths = 3;

function selectPropType(btn) {
  document.querySelectorAll('#propertyTypeGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _propType = btn.dataset.value;
  roiCalc();
}
function selHold(btn) {
  document.querySelectorAll('#holdGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _holdMonths = parseInt(btn.dataset.val);
  roiCalc();
}
function roiLoanUpdate() {
  const v = $$('r_loanPct').value;
  set('r_loanPctDisp', v + '%');
  roiCalc();
}
function roiRateUpdate() {
  const v = parseFloat($$('r_rate').value).toFixed(1);
  set('r_rateDisp', v + '%');
  roiCalc();
}
function sqmToPy() {
  const sqm = parseFloat($$('r_sqm').value);
  if (!isNaN(sqm)) $$('r_py').value = (sqm / 3.3058).toFixed(2);
  _autoFillCosts(); roiCalc();
}
function pyToSqm() {
  const py = parseFloat($$('r_py').value);
  if (!isNaN(py)) $$('r_sqm').value = (py * 3.3058).toFixed(2);
  _autoFillCosts(); roiCalc();
}
function _autoFillCosts() {
  const py = parseFloat($$('r_py').value);
  if (!isNaN(py) && py > 0) {
    const ev = $$('r_evict'); const rp = $$('r_repair');
    if (!ev.dataset.edited || ev.value === '') ev.value = Math.floor(py * 100000 / 10000) * 10000;
    if (!rp.dataset.edited || rp.value === '') rp.value = Math.floor(py * 200000 / 10000) * 10000;
  }
}

function roiCalc() {
  const appraise  = num('r_appraise');
  const minBid    = num('r_minBid');
  const bid       = num('r_bid');
  const loanPct   = parseInt($$('r_loanPct').value) / 100;
  const acqRate   = parseFloat($$('r_acqTaxRate').value);
  const evict     = num('r_evict');
  const repair    = num('r_repair');
  const legal     = num('r_legal') || 1000000;
  const mgmt      = num('r_mgmt');
  const senior    = num('r_seniorDep') || 0;
  const rentDep   = num('r_rentDep');
  const monthly   = num('r_monthly');
  const sale      = num('r_sale');
  const rate      = parseFloat($$('r_rate').value) / 100;

  // 역산 매도가 자동 동기화
  if (sale > 0 && $$('rv_sale') && !$$('rv_sale').value) {
    $$('rv_sale').value = sale;
    showKrw($$('rv_sale'), 'rv_sale_krw');
  }
  rvCalc();
  const taxTypeVal = $$('r_taxType').value;
  const hold      = _holdMonths;

  // 자동 비용 채우기
  const py = parseFloat($$('r_py').value);
  if (!isNaN(py) && py > 0) {
    const ev = $$('r_evict'); const rp = $$('r_repair');
    if (!ev.dataset.edited && !ev.value) ev.value = Math.floor(py * 100000 / 10000) * 10000;
    if (!rp.dataset.edited && !rp.value) rp.value = Math.floor(py * 200000 / 10000) * 10000;
  }

  if (bid === 0) return;

  // 1. 초기 비용
  const loanAmt   = bid * loanPct;
  const bidDep    = minBid > 0 ? Math.ceil(minBid / 10 / 10000) * 10000 : 0;
  const remain    = Math.max(0, bid - loanAmt - bidDep);
  const acqTax    = Math.round(bid * acqRate);
  const evictFinal = num('r_evict');
  const repairFinal = num('r_repair');
  const totalAdd  = acqTax + evictFinal + repairFinal + legal + mgmt + (num('r_seniorDep') || 0);

  // 2. 보유 지출
  const mInt      = Math.round((loanAmt * rate) / 12);
  const totalInt  = mInt * hold;
  const brok      = Math.round(sale * 0.004);
  const totalExp  = totalInt + brok;

  // 3. 수입
  const totalRent = monthly * hold;

  // 4. 수익
  const ownCap    = remain + totalAdd;
  const totalInv  = bid + totalAdd;
  const netProfit = (sale - bid) - totalAdd - totalExp + totalRent;
  const roi       = ownCap > 0 ? netProfit / ownCap : 0;

  // 5. 양도세
  const txResult  = _calcTransferTax(bid, sale, hold, taxTypeVal);
  const txAmt     = txResult.tax;
  const afterNet  = netProfit - txAmt;
  const afterROI  = ownCap > 0 ? afterNet / ownCap : 0;

  // 자동 계산 행
  if (bid > 0) {
    $$('r_bidAutoRow').style.display = 'flex';
    set('r_d_dep', fmt(bidDep));
    set('r_d_ratio', appraise > 0 ? pct(bid / appraise) : '-');
    $$('r_loanAutoRow').style.display = 'flex';
    set('r_d_loan', fmt(loanAmt));
    set('r_d_remain', fmt(remain));
  }

  // 양도세 미리보기
  _updateTaxPreview(txResult, bid, sale);

  // 결과 표시
  if (bid > 0 && sale > 0) {
    $$('roiPlaceholder').style.display = 'none';
    $$('roiResult').style.display = 'flex';

    set('r_r_own',   fmt(ownCap));
    set('r_r_net',   fmt(netProfit));
    set('r_r_after', fmt(afterNet));

    // 게이지
    const clamp = Math.min(Math.max(roi * 100, -10), 50);
    const offset = 283 * (1 - (clamp + 10) / 60);
    const gf = $$('gaugeFill'); if (gf) gf.style.strokeDashoffset = Math.max(0, offset).toFixed(1);
    set('gaugeText', pct(roi));
    set('r_r_roi',  pct(roi));
    set('r_r_aroi', pct(afterROI));

    // 등급
    const gb = $$('r_grade');
    if (afterROI >= .30) { gb.className = 'grade-badge grade-best'; gb.textContent = '⭐ 최우수 30%↑'; }
    else if (afterROI >= .20) { gb.className = 'grade-badge grade-good'; gb.textContent = '✅ 우수 20%↑'; }
    else if (afterROI >= .10) { gb.className = 'grade-badge grade-ok';  gb.textContent = '🔵 양호 10%↑'; }
    else if (afterROI >= 0)  { gb.className = 'grade-badge grade-low'; gb.textContent = '⚠️ 낮음'; }
    else { gb.className = 'grade-badge grade-loss'; gb.textContent = '🔴 손실 주의'; }

    // 비교 바
    const mx = Math.max(Math.abs(netProfit), Math.abs(txAmt), Math.abs(afterNet), 1);
    _setBar('cb_before', 'cb_before_amt', netProfit, mx, false);
    _setBar('cb_tax',    'cb_tax_amt',    txAmt,      mx, true);
    _setBar('cb_after',  'cb_after_amt',  afterNet,   mx, false);

    // 절세 팁
    const tipBox = $$('r_tip');
    if (_holdMonths < 24 && txAmt > 0) {
      const saved = txAmt - _calcTransferTaxSimple(sale - bid, 24);
      $$('r_tipText').innerHTML = `<b>절세 팁:</b> 2년 이상 보유 시 누진세율(6~45%) 적용으로 약 <b>${fmt(Math.abs(saved))} 절세</b> 가능`;
      tipBox.style.display = 'flex';
    } else { tipBox.style.display = 'none'; }

    // 상세표
    set('dt_bid',      fmt(bid));
    set('dt_loan',     '−' + fmt(loanAmt));
    set('dt_dep',      fmt(bidDep));
    set('dt_remain',   fmt(remain));
    set('dt_acq',      fmt(acqTax));
    set('dt_evict',    fmt(evictFinal));
    set('dt_repair',   fmt(repairFinal));
    set('dt_legal',    fmt(legal));
    set('dt_mgmt',     fmt(mgmt));
    set('dt_senior',   fmt(num('r_seniorDep') || 0));
    set('dt_totalCost',fmt(totalAdd));
    set('dt_mInterest',fmt(mInt) + '/월');
    set('dt_tInterest',fmt(totalInt));
    set('dt_brok',     fmt(brok));
    set('dt_totalExp', fmt(totalExp));
    set('dt_sale',     fmt(sale));
    set('dt_own',      fmt(ownCap));
    set('dt_net',      fmt(netProfit));
    set('dt_tax',      fmt(txAmt));
    set('dt_after',    fmt(afterNet));
    set('dt_roi',      pct(roi));
    set('dt_aroi',     pct(afterROI));
  }
}

function _calcTransferTax(bid, sale, holdMonths, taxTypeVal) {
  const gain = sale - bid;
  let tax = 0, lthc = 0, basic = 0, base = 0, rateLabel = '-';
  let isProgressive = false;

  if (taxTypeVal === 'auto') {
    if (holdMonths < 12) { tax = gain > 0 ? gain * .70 : 0; rateLabel = '70% (1년 미만)'; }
    else if (holdMonths < 24) { tax = gain > 0 ? gain * .60 : 0; rateLabel = '60% (1~2년)'; }
    else {
      isProgressive = true;
      lthc = gain > 0 ? gain * lthcRate(holdMonths) : 0;
      basic = 2500000;
      base = Math.max(0, gain - lthc - basic);
      tax = progressive(base, TRANSFER_TAX);
      rateLabel = '누진 6~45% (2년+)';
    }
  } else if (taxTypeVal === 'progressive') {
    isProgressive = true;
    lthc = gain > 0 ? gain * lthcRate(holdMonths) : 0;
    basic = 2500000;
    base = Math.max(0, gain - lthc - basic);
    tax = progressive(base, TRANSFER_TAX);
    rateLabel = '누진 6~45%';
  } else {
    const r = parseFloat(taxTypeVal);
    if (!isNaN(r) && gain > 0) { tax = gain * r; rateLabel = (r * 100).toFixed(0) + '%'; }
  }
  if (tax < 0) tax = 0;
  return { gain, lthc, basic: isProgressive ? basic : 0, base: isProgressive ? base : Math.max(0, gain), tax, rateLabel, isProgressive };
}

function _calcTransferTaxSimple(gain, holdMonths) {
  if (gain <= 0) return 0;
  if (holdMonths < 12) return gain * .70;
  if (holdMonths < 24) return gain * .60;
  const b = Math.max(0, gain - gain * lthcRate(holdMonths) - 2500000);
  return progressive(b, TRANSFER_TAX);
}

function _updateTaxPreview(r, bid, sale) {
  if (!r || sale === 0 || bid === 0) {
    ['r_tp_gain','r_tp_lthc','r_tp_basic','r_tp_base','r_tp_rate','r_tp_tax'].forEach(id => set(id, '-'));
    return;
  }
  set('r_tp_gain',  r.gain > 0 ? fmt(r.gain) : '0원 (차익없음)');
  set('r_tp_lthc',  r.isProgressive && r.lthc > 0 ? '−' + fmt(r.lthc) : '해당없음');
  set('r_tp_basic', r.isProgressive && r.basic > 0 ? '−' + fmt(r.basic) : '해당없음');
  set('r_tp_base',  r.gain > 0 ? fmt(r.base) : '0원');
  set('r_tp_rate',  r.rateLabel);
  set('r_tp_tax',   r.tax > 0 ? fmt(r.tax) : '0원');
}

function _setBar(barId, amtId, val, mx, isNeg) {
  const pct_ = Math.min(100, (Math.abs(val) / mx) * 100);
  const bar = $$(barId); if (bar) bar.style.width = pct_ + '%';
  set(amtId, fmt(val));
}

function roiReset() {
  document.querySelectorAll('#tab-roi input[type=number], #tab-roi input[type=text]').forEach(el => {
    el.value = el.id === 'r_legal' ? '1000000' : '';
    delete el.dataset.edited;
  });
  // 한글 금액 표기 초기화
  document.querySelectorAll('#tab-roi .krw-display').forEach(el => {
    el.textContent = ''; el.style.display = 'none';
  });
  set('r_legal_krw', '100만원'); $$('r_legal_krw') && ($$('r_legal_krw').style.display = 'inline-block');
  $$('r_loanPct').value = 70; set('r_loanPctDisp', '70%');
  $$('r_rate').value = 4; set('r_rateDisp', '4.0%');
  document.querySelectorAll('#propertyTypeGroup .btn-toggle').forEach((b,i) => b.classList.toggle('active', i===0));
  document.querySelectorAll('#holdGroup .btn-toggle').forEach(b => b.classList.toggle('active', b.dataset.val==='3'));
  _holdMonths = 3; _propType = '아파트';
  $$('r_acqTaxRate').selectedIndex = 0;
  $$('r_taxType').selectedIndex = 0;
  $$('r_bidAutoRow').style.display = 'none';
  $$('r_loanAutoRow').style.display = 'none';
  $$('roiPlaceholder').style.display = '';
  $$('roiResult').style.display = 'none';
  _updateTaxPreview(null, 0, 0);
  showToast('🔄 초기화 완료');
}

/* =====================================================
   TAB 2: 취득세
   ===================================================== */
function acCalc() {
  const price = num('ac_price');
  if (price === 0) { hide('acResult'); return; }
  const [main, agri, edu] = $$('ac_type').value.split(',').map(Number);
  const mainTax = Math.round(price * main);
  const agriTax = Math.round(price * agri);
  const eduTax  = Math.round(price * edu);
  const total   = mainTax + agriTax + eduTax;
  const eff     = total / price;
  show('acResult');
  set('ac_main',  fmt(mainTax));
  set('ac_agri',  fmt(agriTax));
  set('ac_edu',   fmt(eduTax));
  set('ac_total', fmt(total));
  set('ac_eff',   pct(eff, 2));
}

/* =====================================================
   TAB 3: 중개수수료
   ===================================================== */
let _cmType = '매매'; let _cmProp = '주택';

function selCmType(btn) {
  document.querySelectorAll('#cmTypeGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); _cmType = btn.dataset.val;
  $$('cm_monthlyWrap').style.display = _cmType === '월세' ? '' : 'none';
  cmCalc();
}
function selCmProp(btn) {
  document.querySelectorAll('#cmPropGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); _cmProp = btn.dataset.val;
  cmCalc();
}

function _cmRate(price, type, prop) {
  // 상가·토지 → 0.9% 이내
  if (prop === '상가') return [0.009, null];
  // 오피스텔 → 0.5%(매매) 0.4%(임대) 이내
  if (prop === '오피스텔') return type === '매매' ? [0.005, null] : [0.004, null];
  // 주택 매매
  if (type === '매매') {
    if (price < 50000000)   return [0.006, 250000];
    if (price < 200000000)  return [0.005, 800000];
    if (price < 900000000)  return [0.004, null];
    if (price < 1200000000) return [0.005, null];
    if (price < 1500000000) return [0.006, null];
    return [0.007, null];
  }
  // 주택 전세
  if (type === '전세') {
    if (price < 50000000)  return [0.005, 200000];
    if (price < 100000000) return [0.004, 300000];
    if (price < 300000000) return [0.003, null];
    if (price < 600000000) return [0.004, null];
    return [0.008, null];
  }
  // 월세(가격=환산보증금)
  if (price < 50000000)  return [0.005, 200000];
  if (price < 100000000) return [0.004, 300000];
  return [0.003, null];
}

function cmCalc() {
  let price = num('cm_price');
  if (_cmType === '월세') {
    const monthly = num('cm_monthly');
    if (price === 0 && monthly === 0) { hide('cmResult'); return; }
    price = price + monthly * 100; // 환산보증금
  }
  if (price === 0) { hide('cmResult'); return; }
  const [rate, cap] = _cmRate(price, _cmType, _cmProp);
  let legalAmt = Math.round(price * rate);
  if (cap !== null && legalAmt > cap) legalAmt = cap;
  const vat = Math.round(legalAmt * 0.1);
  show('cmResult');
  set('cm_rate',   pct(rate, 1));
  set('cm_legal',  fmt(legalAmt));
  set('cm_actual', fmt(legalAmt) + ' (협의 가능)');
  set('cm_vat',    fmt(vat));
  set('cm_total',  fmt(legalAmt + vat));
}

/* =====================================================
   TAB 4: 임대수익률
   ===================================================== */
function rntRateUpdate() {
  set('rnt_rateDisp', parseFloat($$('rnt_rate').value).toFixed(1) + '%');
  rntCalc();
}
function rntCalc() {
  const price    = num('rnt_price');
  const dep      = num('rnt_dep');
  const monthly  = num('rnt_monthly');
  const maint    = num('rnt_maint');
  const loan     = num('rnt_loan');
  const rate     = parseFloat($$('rnt_rate').value) / 100;
  if (price === 0 || monthly === 0) { hide('rntResult'); return; }
  const yr       = monthly * 12;
  const ownCap   = Math.max(0, price - dep - loan);
  const annInt   = Math.round(loan * rate);
  const netYr    = yr - annInt - maint;
  const gross    = price > 0 ? yr / price : 0;
  const net      = ownCap > 0 ? netYr / ownCap : 0;
  show('rntResult');
  set('rnt_yr',       fmt(yr));
  set('rnt_own',      fmt(ownCap));
  set('rnt_interest', fmt(annInt));
  set('rnt_netYr',    fmt(netYr));
  set('rnt_gross',    pct(gross, 2));
  set('rnt_net',      pct(net, 2));
  const jdge = $$('rnt_judge');
  if (net >= .08) { jdge.style.cssText = 'background:#d1fae5;color:#065f46'; jdge.textContent = '✅ 우수 수익물건 (순수익률 8%↑)'; }
  else if (net >= .05) { jdge.style.cssText = 'background:#dbeafe;color:#1e40af'; jdge.textContent = '🔵 양호 (5~8%)'; }
  else if (net >= .03) { jdge.style.cssText = 'background:#fef3c7;color:#92400e'; jdge.textContent = '⚠️ 낮음 (3~5%)'; }
  else { jdge.style.cssText = 'background:#fee2e2;color:#991b1b'; jdge.textContent = '🔴 수익률 부족 (3% 미만)'; }
}

/* =====================================================
   TAB 5: 전월세 전환율
   ===================================================== */
let _jsType = 'j2m';

function selJsType(btn) {
  document.querySelectorAll('#jsTypeGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); _jsType = btn.dataset.val;
  $$('js_j2mWrap').style.display       = _jsType === 'j2m' ? '' : 'none';
  $$('js_m2jWrap').style.display       = _jsType === 'm2j' ? '' : 'none';
  $$('js_rateCalcWrap').style.display  = _jsType === 'rate' ? '' : 'none';
  jsCalc();
}
function jsRateUpdate() { set('js_rateDisp', parseFloat($$('js_rate').value).toFixed(1) + '%'); jsCalc(); }
function jsM2jRateUpdate() { set('js_m2jRateDisp', parseFloat($$('js_m2jRate').value).toFixed(1) + '%'); jsCalc(); }

function jsCalc() {
  const grid = $$('jsResultGrid'); if (!grid) return;
  grid.innerHTML = '';
  let html = '';

  if (_jsType === 'j2m') {
    const jDep    = num('js_jDep');
    const mDep    = num('js_mDep');
    const rate    = parseFloat($$('js_rate').value) / 100;
    if (jDep === 0) { hide('jsResult'); return; }
    const diff    = jDep - mDep;
    const monthly = Math.round((diff * rate) / 12);
    html = _rbItem('전세 보증금', fmt(jDep)) + _rbItem('월세 보증금', fmt(mDep)) + _rbItem('전환 차액', fmt(diff)) + _rbItemTotal('적정 월세', fmt(monthly)) + _rbItemTotal('연 임대수입', fmt(monthly * 12));
  } else if (_jsType === 'm2j') {
    const mDep    = num('js_m2jDep');
    const monthly = num('js_m2jMonthly');
    const rate    = parseFloat($$('js_m2jRate').value) / 100;
    if (monthly === 0) { hide('jsResult'); return; }
    const jDep = Math.round((monthly * 12 / rate) + mDep);
    html = _rbItem('현 보증금', fmt(mDep)) + _rbItem('현 월세', fmt(monthly) + '/월') + _rbItemTotal('전환 전세금', fmt(jDep)) + _rbItem('전세전환 수익비교', (rate * 100).toFixed(1) + '%/년');
  } else {
    const jDep    = num('js_rc_jDep');
    const mDep    = num('js_rc_mDep');
    const monthly = num('js_rc_monthly');
    if (jDep === 0 || monthly === 0) { hide('jsResult'); return; }
    const diff  = jDep - mDep;
    const rate  = diff > 0 ? (monthly * 12) / diff : 0;
    html = _rbItem('전세금', fmt(jDep)) + _rbItem('월세보증금', fmt(mDep)) + _rbItem('월세', fmt(monthly)) + _rbItemTotal('전월세 전환율', pct(rate, 2));
    const legal = 0.05; // 법정 5% 기준
    html += _rbItem('법정 상한(5%) 기준 월세', fmt(Math.round(diff * legal / 12)));
  }

  show('jsResult');
  grid.innerHTML = html;
}

function _rbItem(label, val) {
  return `<div class="rb-item"><span class="rl">${label}</span><span class="rv">${val}</span></div>`;
}
function _rbItemTotal(label, val) {
  return `<div class="rb-item total"><span class="rl"><b>${label}</b></span><span class="rv">${val}</span></div>`;
}

/* =====================================================
   TAB 6: 대출이자
   ===================================================== */
let _lnGrace = 0;

function lnRateUpdate() { set('ln_rateDisp', parseFloat($$('ln_rate').value).toFixed(1) + '%'); lnCalc(); }
function lnTermUpdate() { set('ln_termDisp', $$('ln_term').value + '년'); lnCalc(); }
function selLnGrace(btn) {
  document.querySelectorAll('#lnGraceGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); _lnGrace = parseInt(btn.dataset.val);
  lnCalc();
}

function lnCalc() {
  const amt  = num('ln_amt');
  const rate = parseFloat($$('ln_rate').value) / 100;
  const term = parseInt($$('ln_term').value);
  if (amt === 0) { hide('lnResult'); return; }

  const mr = rate / 12;
  const n  = term * 12;

  // 원리금 균등
  const equalM = mr > 0 ? amt * mr * Math.pow(1+mr,n) / (Math.pow(1+mr,n)-1) : amt / n;
  const equalInt = equalM * n - amt;

  // 원금 균등 첫달
  const principalFirst = amt / n + amt * mr;
  // 원금균등 총이자 = 매달 이자 합 = 원금/n * mr * n*(n+1)/2
  const principalInt = (amt / n) * mr * (n * (n + 1)) / 2;

  // 거치 월이자
  const graceM = Math.round(amt * mr);
  const graceTotal = graceM * _lnGrace;

  show('lnResult');
  set('ln_equal',        fmt(Math.round(equalM)));
  set('ln_equal_int',    fmt(Math.round(equalInt)));
  set('ln_principal',    fmt(Math.round(principalFirst)));
  set('ln_principal_int',fmt(Math.round(principalInt)));
  set('ln_grace_m',      _lnGrace > 0 ? fmt(graceM) + '/월' : '거치없음');
  set('ln_grace_total',  _lnGrace > 0 ? fmt(graceTotal) : '-');
}

/* =====================================================
   TAB 7: DSR / LTV
   ===================================================== */
function dsrLtvUpdate()   { set('dsr_ltvDisp',   $$('dsr_ltv').value + '%');    dsrCalc(); }
function dsrRatioUpdate() { set('dsr_ratioDisp', $$('dsr_ratio').value + '%');   dsrCalc(); }
function dsrRateUpdate()  { set('dsr_rateDisp',  parseFloat($$('dsr_rate').value).toFixed(1) + '%'); dsrCalc(); }

function dsrCalc() {
  const price    = num('dsr_price');
  const income   = num('dsr_income');
  const ltv      = parseInt($$('dsr_ltv').value) / 100;
  const dsrRatio = parseInt($$('dsr_ratio').value) / 100;
  const rate     = parseFloat($$('dsr_rate').value) / 100;
  const existing = num('dsr_existing');

  const ltvLimit = Math.round(price * ltv);

  // DSR 기준 최대 대출 (30년 원리금균등 역산)
  const mr = rate / 12;
  const n  = 30 * 12;
  const maxAnnual = income * dsrRatio - existing;
  let dsrLimit = 0;
  if (mr > 0 && maxAnnual > 0) {
    const maxMonthly = maxAnnual / 12;
    dsrLimit = Math.round(maxMonthly * (Math.pow(1+mr,n)-1) / (mr * Math.pow(1+mr,n)));
  }

  const realLimit = Math.min(ltvLimit, dsrLimit > 0 ? dsrLimit : ltvLimit);
  show('dsrResult');
  set('dsr_r_ltv',    fmt(ltvLimit));
  set('dsr_r_dsr',    dsrLimit > 0 ? fmt(dsrLimit) : '소득 정보 필요');
  set('dsr_r_annual', fmt(Math.round(Math.max(0, income * dsrRatio - existing))));
  set('dsr_r_real',   fmt(realLimit));
  const note = $$('dsr_r_note');
  if (note) {
    if (dsrLimit > 0 && ltvLimit > dsrLimit) note.innerHTML = '<i class="fas fa-exclamation-circle" style="color:#f59e0b"></i> DSR 기준이 더 낮습니다. 소득 기준이 제한 요인입니다.';
    else if (dsrLimit > 0 && dsrLimit > ltvLimit) note.innerHTML = '<i class="fas fa-info-circle"></i> LTV 기준이 더 낮습니다. 담보 가치가 제한 요인입니다.';
    else note.textContent = '';
  }
}

/* =====================================================
   TAB 8: 증여세
   ===================================================== */
const GIFT_TAX = [
  [100000000, .10, 0],
  [500000000, .20, 10000000],
  [1000000000, .30, 60000000],
  [3000000000, .40, 160000000],
  [Infinity, .50, 460000000],
];

function dnCalc() {
  const amt    = num('dn_amt');
  const prior  = num('dn_prior');
  const deduct = parseInt($$('dn_rel').value);
  if (amt === 0) { hide('dnResult'); return; }
  const total   = amt + prior;
  const dAmt    = Math.min(deduct, total);
  const base    = Math.max(0, total - dAmt);
  const tax     = progressive(base, GIFT_TAX);
  const priorTax = progressive(Math.max(0, prior - dAmt), GIFT_TAX);
  const finalTax = Math.max(0, tax - priorTax);
  const afterDiscount = Math.round(finalTax * 0.97); // 신고세액공제 3%
  show('dnResult');
  set('dn_r_amt',    fmt(amt));
  set('dn_r_deduct', fmt(dAmt));
  set('dn_r_base',   fmt(base));
  let rateLabel = '-';
  for (const [lim, r] of GIFT_TAX) { if (base <= lim) { rateLabel = (r * 100).toFixed(0) + '%'; break; } }
  set('dn_r_rate',  rateLabel);
  set('dn_r_tax',   fmt(finalTax));
  set('dn_r_final', fmt(afterDiscount));
}

/* =====================================================
   TAB 9: 상속세
   ===================================================== */
const INHERIT_TAX = [
  [100000000, .10, 0],
  [500000000, .20, 10000000],
  [1000000000, .30, 60000000],
  [3000000000, .40, 160000000],
  [Infinity, .50, 460000000],
];

function inhCalc() {
  const amt    = num('inh_amt');
  const debt   = num('inh_debt');
  const spouse = num('inh_spouse');
  const base1  = parseInt($$('inh_type').value);
  if (amt === 0) { hide('inhResult'); return; }
  const spDeduct = Math.min(Math.max(spouse, 500000000), 3000000000);
  const taxBase  = Math.max(0, amt - debt - base1 - (spouse > 0 ? spDeduct : 0));
  const tax      = progressive(taxBase, INHERIT_TAX);
  show('inhResult');
  set('inh_r_amt',     fmt(amt));
  set('inh_r_debt',    fmt(debt));
  set('inh_r_base',    fmt(base1));
  set('inh_r_spouse',  spouse > 0 ? fmt(spDeduct) : '0원 (배우자 없음)');
  set('inh_r_taxbase', fmt(taxBase));
  set('inh_r_tax',     fmt(Math.round(tax)));
}

/* =====================================================
   TAB 10: 종합부동산세
   ===================================================== */
function cpRatioUpdate() { set('cp_ratioDisp', $$('cp_ratio').value + '%'); cpCalc(); }

const COMPRE_TAX_1H = [  // 1주택자
  [300000000,  .005, 0],
  [600000000,  .007, 600000],
  [1200000000, .010, 2400000],
  [2500000000, .013, 6000000],
  [9400000000, .020, 23500000],
  [Infinity,   .027, 89300000],
];
const COMPRE_TAX_2H = [  // 2주택+
  [300000000,  .006, 0],
  [600000000,  .010, 1200000],
  [1200000000, .015, 4200000],
  [2500000000, .020, 10200000],
  [9400000000, .030, 35200000],
  [Infinity,   .050, 223200000],
];

function cpCalc() {
  const price = num('cp_price');
  const type  = $$('cp_type').value;
  const ratio = parseInt($$('cp_ratio').value) / 100;
  if (price === 0) { hide('cpResult'); return; }
  const deduct = type === '1h' ? 900000000 : (type === 'corp' ? 0 : 600000000);
  const net    = Math.max(0, price - deduct);
  const base   = Math.round(net * ratio);
  const brackets = type === '1h' ? COMPRE_TAX_1H : COMPRE_TAX_2H;
  const tax    = Math.round(progressive(base, brackets));
  const agri   = Math.round(tax * 0.20);
  let rLabel   = '-';
  for (const [lim, r] of brackets) { if (base <= lim) { rLabel = (r * 100).toFixed(1) + '%'; break; } }
  show('cpResult');
  set('cp_r_price',  fmt(price));
  set('cp_r_deduct', fmt(deduct));
  set('cp_r_base',   fmt(base));
  set('cp_r_rate',   rLabel);
  set('cp_r_tax',    fmt(tax));
  set('cp_r_agri',   fmt(agri));
  set('cp_r_total',  fmt(tax + agri));
}

/* =====================================================
   TAB 11: 재산세
   ===================================================== */
const PT_HOUSE = [  // 주택 재산세
  [60000000,  .001, 0],
  [150000000, .0015, 30000],
  [300000000, .0025, 180000],
  [Infinity,  .004,  630000],
];
const PT_LAND_SEP = [  // 별도합산토지
  [200000000,  .002, 0],
  [1000000000, .003, 200000],
  [Infinity,   .004, 1200000],
];
const PT_LAND_GEN = [  // 일반합산토지
  [50000000,  .002, 0],
  [1000000000,.003, 50000],
  [Infinity,  .005, 2050000],
];

function ptCalc() {
  const price = num('pt_price');
  const type  = $$('pt_type').value;
  if (price === 0) { hide('ptResult'); return; }

  let base, tax;
  if (type === 'house') {
    base = Math.round(price * 0.60); // 공정시장가액비율 60%
    tax  = Math.round(progressive(base, PT_HOUSE));
  } else if (type === 'land_sep') {
    base = Math.round(price * 0.70);
    tax  = Math.round(progressive(base, PT_LAND_SEP));
  } else if (type === 'land_gen') {
    base = Math.round(price * 0.70);
    tax  = Math.round(progressive(base, PT_LAND_GEN));
  } else { // 건물
    base = Math.round(price * 0.70);
    tax  = Math.round(base * 0.0025);
  }

  const city = Math.round(tax * 0.14);
  const edu  = Math.round(tax * 0.20);
  const total = tax + city + edu;

  show('ptResult');
  set('pt_r_base',  fmt(base));
  set('pt_r_tax',   fmt(tax));
  set('pt_r_city',  fmt(city));
  set('pt_r_edu',   fmt(edu));
  set('pt_r_total', fmt(total));
  set('pt_r_jul',   fmt(Math.round(total / 2)));
  set('pt_r_sep',   fmt(Math.round(total / 2)));
}

/* =====================================================
   TAB 12: 양도소득세 (일반 — 1세대1주택 포함)
   ===================================================== */
let _tfProp      = '주택';
let _tfOneHouse  = 'yes';
let _tfResidence = 36;   // 실거주 개월
let _tfHouseCount = 1;
let _tfAdj       = 'no'; // 조정대상지역

function selTfProp(btn) {
  document.querySelectorAll('#tf_propGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _tfProp = btn.dataset.val;
  // 주택이 아니면 1세대1주택 선택 비활성
  const isHouse = _tfProp === '주택';
  if (!isHouse) {
    _tfOneHouse = 'no';
    document.querySelectorAll('#tf_oneHouseGroup .btn-toggle').forEach(b => {
      b.classList.toggle('active', b.dataset.val === 'no');
    });
    $$('tf_residenceWrap').style.display = 'none';
    $$('tf_multiHouseWrap').style.display = '';
  }
  tfCalc();
}

function selTfOneHouse(btn) {
  document.querySelectorAll('#tf_oneHouseGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _tfOneHouse = btn.dataset.val;
  $$('tf_residenceWrap').style.display  = _tfOneHouse === 'yes' ? '' : 'none';
  $$('tf_multiHouseWrap').style.display = _tfOneHouse === 'no'  ? '' : 'none';
  tfCalc();
}

function selTfResidence(btn) {
  document.querySelectorAll('#tf_residenceGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _tfResidence = parseInt(btn.dataset.val);
  tfCalc();
}

function selTfHouseCount(btn) {
  document.querySelectorAll('#tf_houseCountGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _tfHouseCount = parseInt(btn.dataset.val);
  tfCalc();
}

function selTfAdj(btn) {
  document.querySelectorAll('#tf_adjGroup .btn-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _tfAdj = btn.dataset.val;
  tfCalc();
}

/* 날짜 차이 → 개월 수 */
function _monthsBetween(d1, d2) {
  const a = new Date(d1), b = new Date(d2);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/* 보유기간 → 일반 장기보유공제율 (주택 외) */
function _lthcGeneral(months) {
  const y = months / 12;
  if (y < 3)  return 0;
  if (y < 4)  return 0.06;
  if (y < 5)  return 0.08;
  if (y < 6)  return 0.10;
  if (y < 7)  return 0.12;
  if (y < 8)  return 0.14;
  if (y < 9)  return 0.16;
  if (y < 10) return 0.18;
  if (y < 15) return 0.20;
  return 0.30;
}

/* 1세대1주택 장기보유공제율 (보유+거주 각각) */
function _lthc1House(holdMonths, residenceMonths) {
  const hy = holdMonths / 12;
  const ry = residenceMonths / 12;
  if (hy < 3) return 0;
  // 보유 연수당 4%, 거주 연수당 4% → 최대 80%
  const holdYrs = Math.floor(hy);
  const resYrs  = Math.floor(ry);
  const holdPct = Math.min(holdYrs, 10) * 0.04;
  const resPct  = Math.min(resYrs, 10)  * 0.04;
  return Math.min(holdPct + resPct, 0.80);
}

/* 누진세율 계산 (양도세용) */
const TF_BRACKETS = [
  [14000000,    0.06,  0],
  [50000000,    0.15,  1260000],
  [88000000,    0.24,  5760000],
  [150000000,   0.35,  15440000],
  [300000000,   0.38,  19940000],
  [500000000,   0.40,  25940000],
  [1000000000,  0.42,  35940000],
  [Infinity,    0.45,  65940000],
];

function _tfProgressiveTax(base) {
  if (base <= 0) return { tax: 0, rate: 0, label: '0%' };
  for (const [lim, r, ded] of TF_BRACKETS) {
    if (base <= lim) return { tax: base * r - ded, rate: r, label: (r * 100).toFixed(0) + '%' };
  }
  return { tax: 0, rate: 0, label: '-' };
}

/* 보유기간별 단기세율 */
function _shortTermRate(months, isHouse) {
  if (isHouse) {
    if (months < 12) return 0.70;
    if (months < 24) return 0.60;
    return null; // 누진세율
  } else {
    if (months < 12) return 0.50;
    if (months < 24) return 0.40;
    return null;
  }
}

function tfCalc() {
  const acqDate  = $$('tf_acqDate').value;
  const salDate  = $$('tf_saleDate').value;
  const acqPrice = num('tf_acqPrice');
  const salPrice = num('tf_salePrice');
  const expenses = num('tf_expenses');

  // 보유기간 계산 & 표시
  if (acqDate && salDate && salDate > acqDate) {
    const months = _monthsBetween(acqDate, salDate);
    const years  = Math.floor(months / 12);
    const rem    = months % 12;
    const holdDisp = years > 0 ? `${years}년 ${rem > 0 ? rem + '개월' : ''}`.trim() : `${months}개월`;
    $$('tf_holdDisplay').style.display = '';
    set('tf_holdText', `보유기간: ${holdDisp}`);

    // 배지
    const badge = $$('tf_holdBadge');
    if (months < 12) {
      badge.textContent = '⚠️ 1년 미만 — 70% (주택)';
      badge.className = 'hd-badge badge-danger';
    } else if (months < 24) {
      badge.textContent = '⚠️ 2년 미만 — 60% (주택)';
      badge.className = 'hd-badge badge-warn';
    } else if (months < 36) {
      badge.textContent = '✅ 2년 이상 — 누진세율';
      badge.className = 'hd-badge badge-ok';
    } else {
      badge.textContent = `✅ ${years}년 이상 — 장기보유공제 적용`;
      badge.className = 'hd-badge badge-good';
    }
  } else {
    $$('tf_holdDisplay').style.display = 'none';
  }

  // 양도차익 미리보기
  if (acqPrice > 0 && salPrice > 0) {
    const gain = salPrice - acqPrice - expenses;
    $$('tf_gainPreview').style.display = '';
    set('tf_gp_sale', fmt(salPrice));
    set('tf_gp_acq',  fmt(acqPrice));
    set('tf_gp_exp',  fmt(expenses));
    set('tf_gp_gain', gain > 0 ? `<span style="color:#16a34a;font-weight:800">${fmt(gain)}</span>` : `<span style="color:#dc2626;font-weight:800">${fmt(gain)}</span>`);
    $$('tf_gp_gain').innerHTML = gain >= 0
      ? `<span style="color:#16a34a;font-weight:800">${fmt(gain)}</span>`
      : `<span style="color:#dc2626;font-weight:800">${fmt(gain)}</span>`;

    // 고가주택 안내
    const highPriceWrap = $$('tf_highPriceWrap');
    if (highPriceWrap) highPriceWrap.style.display = (_tfOneHouse === 'yes' && salPrice > 1200000000) ? '' : 'none';
  } else {
    $$('tf_gainPreview').style.display = 'none';
  }

  if (!acqDate || !salDate || acqPrice === 0 || salPrice === 0 || salDate <= acqDate) return;

  const holdMonths = _monthsBetween(acqDate, salDate);
  const isHouse    = _tfProp === '주택';
  const gain       = salPrice - acqPrice - expenses;

  // ─── 손실이면 세금 0 ───
  if (gain <= 0) {
    _showTfResult({ gain, lthcAmt: 0, basicDed: 0, taxBase: 0, taxOnly: 0, localTax: 0, totalTax: 0, netProfit: gain, effRate: 0, rateLabel: '0%', surcharge: 0, isExempt: false, exemptDesc: '', holdMonths });
    _buildSimTable(acqPrice, salPrice, expenses, isHouse, _tfOneHouse === 'yes', _tfResidence, _tfHouseCount, _tfAdj);
    return;
  }

  // ─── 1세대 1주택 비과세 판단 ───
  let isExempt = false;
  let exemptDesc = '';
  let taxableGain = gain; // 과세 대상 양도차익

  if (_tfOneHouse === 'yes' && isHouse) {
    const hold2yr   = holdMonths >= 24;
    const adjArea   = _tfAdj === 'yes';
    const resi2yr   = _tfResidence >= 24;
    // 비과세 요건: 2년 이상 보유 + (비규제지역 OR 조정지역이면 2년 거주)
    const nonTaxCond = hold2yr && (!adjArea || resi2yr);

    if (nonTaxCond) {
      // 9억(2021.12.7 이전) → 2021.12.8부터 12억 기준
      const exemptLimit = 1200000000;
      if (salPrice <= exemptLimit) {
        // 전액 비과세
        isExempt = true;
        exemptDesc = `양도가액 ${fmt(salPrice)} ≤ 12억 → 전액 비과세`;
        taxableGain = 0;
      } else {
        // 12억 초과분만 과세 (고가주택 안분)
        taxableGain = gain * (salPrice - exemptLimit) / salPrice;
        exemptDesc = `양도가액 12억 초과 — 초과분(${fmt(salPrice - exemptLimit)}) 비율만 과세`;
      }
    }
  }

  // ─── 장기보유특별공제 ───
  let lthcRate_ = 0;
  const shortRate = _shortTermRate(holdMonths, isHouse);

  if (shortRate !== null) {
    // 단기세율: 장기보유공제 없음
    lthcRate_ = 0;
  } else if (_tfOneHouse === 'yes' && isHouse) {
    lthcRate_ = _lthc1House(holdMonths, _tfResidence);
  } else {
    lthcRate_ = _lthcGeneral(holdMonths);
  }

  const lthcAmt = Math.round(taxableGain * lthcRate_);
  const basicDed = isExempt && taxableGain === 0 ? 0 : 2500000;
  const taxBase  = Math.max(0, taxableGain - lthcAmt - basicDed);

  // ─── 세율 & 세액 계산 ───
  let taxOnly = 0, rateLabel = '-', surcharge = 0;

  if (isExempt && taxableGain === 0) {
    taxOnly = 0; rateLabel = '비과세';
  } else if (shortRate !== null) {
    taxOnly    = Math.round(taxableGain * shortRate);
    rateLabel  = (shortRate * 100).toFixed(0) + '%';
  } else {
    const r = _tfProgressiveTax(taxBase);
    taxOnly = Math.round(r.tax);
    rateLabel = r.label;
  }

  // 다주택 중과
  if (_tfOneHouse === 'no' && isHouse && shortRate === null) {
    const surchargeRate = _tfHouseCount === 2 ? 0.10 : (_tfHouseCount >= 3 ? 0.20 : 0);
    surcharge = Math.round(taxBase * surchargeRate);
    if (surchargeRate > 0) rateLabel += ` (+${(surchargeRate * 100).toFixed(0)}%p 중과)`;
  }

  taxOnly += surcharge;
  const localTax  = Math.round(taxOnly * 0.10);
  const totalTax  = taxOnly + localTax;
  const netProfit = gain - totalTax;
  const effRate   = gain > 0 ? totalTax / gain : 0;

  _showTfResult({ gain, lthcAmt, basicDed, taxBase, taxOnly: taxOnly - surcharge, localTax, totalTax, netProfit, effRate, rateLabel, surcharge, isExempt, exemptDesc, taxableGain, holdMonths, shortRate, lthcRate_ });
  _buildSimTable(acqPrice, salPrice, expenses, isHouse, _tfOneHouse === 'yes', _tfResidence, _tfHouseCount, _tfAdj);
  _buildGuide({ isExempt, holdMonths, taxableGain, gain, salPrice, lthcRate_, _tfOneHouse, _tfAdj, _tfResidence });
}

function _showTfResult(d) {
  $$('tf_placeholder').style.display = 'none';
  $$('tf_result').style.display      = 'flex';

  // 비과세 배너
  const exemptBanner = $$('tf_exemptBanner');
  exemptBanner.style.display = d.isExempt ? '' : 'none';
  if (d.isExempt) set('tf_exemptDesc', d.exemptDesc);

  // 요약 카드
  set('tf_r_gain', fmt(d.gain));
  set('tf_r_tax',  d.isExempt && d.taxableGain === 0 ? '0원 (비과세)' : fmt(d.totalTax));
  set('tf_r_net',  fmt(d.netProfit));

  // 상세 테이블
  set('tf_t_sale',  fmt(num('tf_salePrice')));
  set('tf_t_acq',   fmt(num('tf_acqPrice')));
  set('tf_t_exp',   fmt(num('tf_expenses')));
  set('tf_t_gain',  fmt(d.gain));

  // 고가주택 행
  const highRow = $$('tf_t_highPriceRow');
  if (highRow) highRow.style.display = (d.taxableGain !== undefined && d.taxableGain !== d.gain && d.taxableGain > 0) ? '' : 'none';
  if (d.taxableGain !== undefined && d.taxableGain !== d.gain) {
    set('tf_t_highGain', fmt(d.taxableGain));
  }

  // 비과세 공제행
  const exemptRow = $$('tf_t_exemptRow');
  if (exemptRow) {
    if (d.isExempt && d.taxableGain === 0) {
      exemptRow.style.display = '';
      set('tf_t_exempt', '전액 비과세');
    } else if (d.isExempt && d.taxableGain > 0) {
      exemptRow.style.display = '';
      set('tf_t_exempt', '고가주택 안분 비과세');
    } else {
      exemptRow.style.display = 'none';
    }
  }

  // 장기보유공제
  const lthcRow = $$('tf_t_lthcRow');
  if (lthcRow) lthcRow.style.display = d.lthcAmt > 0 ? '' : 'none';
  set('tf_t_lthc',  d.lthcAmt > 0 ? `−${fmt(d.lthcAmt)} (${d.lthcRate_ !== undefined ? (d.lthcRate_ * 100).toFixed(0) : 0}%)` : '해당없음');
  set('tf_t_basic', d.basicDed > 0 ? `−${fmt(d.basicDed)}` : '-');
  set('tf_t_base',  fmt(d.taxBase));
  set('tf_t_rate',  d.rateLabel);

  // 중과 행
  const surRow = $$('tf_t_surchargeRow');
  if (surRow) surRow.style.display = d.surcharge > 0 ? '' : 'none';
  if (d.surcharge > 0) set('tf_t_surcharge', `+${fmt(d.surcharge)}`);

  set('tf_t_taxOnly', fmt(d.taxOnly));
  set('tf_t_local',   fmt(d.localTax));
  set('tf_t_total',   d.isExempt && d.taxableGain === 0 ? '0원 (비과세)' : fmt(d.totalTax));
  set('tf_t_net',     fmt(d.netProfit));
  set('tf_t_effRate', d.gain > 0 ? pct(d.effRate, 1) : '-');
}

/* 보유기간별 시뮬레이션 테이블 */
function _buildSimTable(acqPrice, salPrice, expenses, isHouse, is1House, resMonths, houseCount, adjArea) {
  const gain     = salPrice - acqPrice - expenses;
  if (gain <= 0) return;
  const tbody    = $$('tf_simBody'); if (!tbody) return;
  const scenarios = [
    { label: '6개월', months: 6 },
    { label: '1년', months: 12 },
    { label: '2년', months: 24 },
    { label: '3년', months: 36 },
    { label: '5년', months: 60 },
    { label: '10년', months: 120 },
  ];
  let html = '';
  const exemptLimit = 1200000000;

  for (const sc of scenarios) {
    let tg = gain;
    let isEx = false;

    if (is1House && isHouse && sc.months >= 24) {
      const adjCond = adjArea === 'yes' ? resMonths >= 24 : true;
      if (adjCond) {
        if (salPrice <= exemptLimit) { tg = 0; isEx = true; }
        else tg = gain * (salPrice - exemptLimit) / salPrice;
      }
    }

    const sr = _shortTermRate(sc.months, isHouse);
    let lr = 0;
    if (sr === null) {
      lr = is1House && isHouse ? _lthc1House(sc.months, resMonths) : _lthcGeneral(sc.months);
    }
    const lthcAmt = Math.round(tg * lr);
    const base    = Math.max(0, tg - lthcAmt - (tg > 0 ? 2500000 : 0));
    let tax = 0, rl = '-';

    if (isEx && tg === 0) { tax = 0; rl = '비과세'; }
    else if (sr !== null) { tax = Math.round(tg * sr); rl = (sr * 100).toFixed(0) + '%'; }
    else { const r = _tfProgressiveTax(base); tax = Math.round(r.tax); rl = r.label; }

    // 다주택 중과
    if (!is1House && isHouse && sr === null) {
      const sp = houseCount === 2 ? 0.10 : (houseCount >= 3 ? 0.20 : 0);
      if (sp > 0) { tax += Math.round(base * sp); rl += `+${(sp*100).toFixed(0)}%p`; }
    }

    const total = tax + Math.round(tax * 0.10);
    const net   = gain - total;

    const isCurrentHold = ($$('tf_acqDate').value && $$('tf_saleDate').value)
      ? _monthsBetween($$('tf_acqDate').value, $$('tf_saleDate').value) === sc.months
      : false;

    html += `<tr class="${isEx ? 'sim-exempt' : ''} ${isCurrentHold ? 'sim-current' : ''}">
      <td>${sc.label}</td>
      <td>${rl}</td>
      <td>${lr > 0 ? (lr * 100).toFixed(0) + '%' : '-'}</td>
      <td>${isEx && tg === 0 ? '<span class="green">비과세</span>' : fmt(total)}</td>
      <td>${fmt(net)}</td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

/* 절세 가이드 */
function _buildGuide(d) {
  const list = $$('tf_guideList'); if (!list) return;
  const items = [];

  if (d._tfOneHouse === 'yes' && d.holdMonths < 24) {
    const remain = 24 - d.holdMonths;
    items.push({ icon: '📅', type: 'warn', text: `<b>${Math.ceil(remain)}개월 후</b> 매도하면 1세대1주택 비과세 요건 충족 (2년 보유 필요)` });
  }
  if (d._tfOneHouse === 'yes' && d._tfAdj === 'yes' && d._tfResidence < 24) {
    items.push({ icon: '🏠', type: 'warn', text: `조정대상지역은 <b>2년 거주</b> 필수입니다. 현재 ${Math.floor(d._tfResidence/12)}년 ${d._tfResidence%12}개월 거주 — ${24-d._tfResidence}개월 더 거주 필요` });
  }
  if (d.salPrice > 1200000000 && d._tfOneHouse === 'yes') {
    items.push({ icon: '💰', type: 'info', text: `양도가액이 12억을 초과합니다. <b>초과분에 대해서만 과세</b>됩니다. (12억 이하는 비과세)` });
  }
  if (d.holdMonths >= 24 && d.holdMonths < 36 && !d.isExempt) {
    items.push({ icon: '📈', type: 'tip', text: `<b>3년 이상 보유</b> 시 장기보유특별공제 6% 적용 — ${36-d.holdMonths}개월 후 매도 추천` });
  }
  if (d.lthcRate_ > 0 && d.lthcRate_ < 0.80 && d._tfOneHouse === 'yes') {
    items.push({ icon: '⬆️', type: 'tip', text: `현재 장기보유공제 <b>${(d.lthcRate_*100).toFixed(0)}%</b> — 보유·거주기간이 늘수록 최대 <b>80%</b>까지 증가합니다` });
  }
  if (d.holdMonths < 12) {
    items.push({ icon: '🚨', type: 'danger', text: `1년 미만 보유 → 주택 <b>70% 단기세율</b> 적용 중. 최소 1년 보유 후 매도 시 60%로 낮아집니다.` });
  }
  if (items.length === 0) {
    items.push({ icon: '✅', type: 'ok', text: '현재 최적 절세 조건으로 매도하는 상황입니다.' });
  }

  list.innerHTML = items.map(i =>
    `<div class="guide-item-row guide-${i.type}"><span class="gi-icon">${i.icon}</span><span>${i.text}</span></div>`
  ).join('');
}

function tfReset() {
  $$('tf_acqDate').value  = '';
  $$('tf_saleDate').value = '';
  $$('tf_acqPrice').value = '';
  $$('tf_salePrice').value = '';
  $$('tf_expenses').value = '';
  _tfProp = '주택'; _tfOneHouse = 'yes'; _tfResidence = 36; _tfHouseCount = 1; _tfAdj = 'no';
  document.querySelectorAll('#tf_propGroup .btn-toggle').forEach((b,i) => b.classList.toggle('active', i===0));
  document.querySelectorAll('#tf_oneHouseGroup .btn-toggle').forEach(b => b.classList.toggle('active', b.dataset.val==='yes'));
  document.querySelectorAll('#tf_residenceGroup .btn-toggle').forEach(b => b.classList.toggle('active', b.dataset.val==='36'));
  document.querySelectorAll('#tf_houseCountGroup .btn-toggle').forEach((b,i) => b.classList.toggle('active', i===0));
  document.querySelectorAll('#tf_adjGroup .btn-toggle').forEach((b,i) => b.classList.toggle('active', i===0));
  $$('tf_residenceWrap').style.display  = '';
  $$('tf_multiHouseWrap').style.display = 'none';
  $$('tf_holdDisplay').style.display    = 'none';
  $$('tf_gainPreview').style.display    = 'none';
  $$('tf_placeholder').style.display    = '';
  $$('tf_result').style.display         = 'none';
}

/* =====================================================
   초기화
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // 수정 플래그
  ['r_evict','r_repair'].forEach(id => {
    const el = $$(id);
    if (el) el.addEventListener('input', () => { el.dataset.edited = 'true'; });
  });

  // 전월세 초기 표시
  $$('js_j2mWrap').style.display = '';
  $$('js_m2jWrap').style.display = 'none';
  $$('js_rateCalcWrap').style.display = 'none';

  // 슬라이더 리스너
  const sliders = [
    ['r_loanPct', 'r_loanPctDisp', v => v + '%', roiCalc],
    ['r_rate', 'r_rateDisp', v => parseFloat(v).toFixed(1) + '%', roiCalc],
    ['rnt_rate', 'rnt_rateDisp', v => parseFloat(v).toFixed(1) + '%', rntCalc],
    ['js_rate', 'js_rateDisp', v => parseFloat(v).toFixed(1) + '%', jsCalc],
    ['js_m2jRate', 'js_m2jRateDisp', v => parseFloat(v).toFixed(1) + '%', jsCalc],
    ['ln_rate', 'ln_rateDisp', v => parseFloat(v).toFixed(1) + '%', lnCalc],
    ['ln_term', 'ln_termDisp', v => v + '년', lnCalc],
    ['dsr_ltv', 'dsr_ltvDisp', v => v + '%', dsrCalc],
    ['dsr_ratio', 'dsr_ratioDisp', v => v + '%', dsrCalc],
    ['dsr_rate', 'dsr_rateDisp', v => parseFloat(v).toFixed(1) + '%', dsrCalc],
    ['cp_ratio', 'cp_ratioDisp', v => v + '%', cpCalc],
  ];
  sliders.forEach(([slider, disp, fmt_, fn]) => {
    const el = $$(slider);
    if (el) el.addEventListener('input', () => { set(disp, fmt_(el.value)); fn(); });
  });

  // 입력 필드 실시간 계산
  const calcMap = {
    'ac_price': acCalc, 'ac_type': acCalc,
    'cm_price': cmCalc, 'cm_monthly': cmCalc,
    'rnt_price': rntCalc, 'rnt_dep': rntCalc, 'rnt_monthly': rntCalc, 'rnt_maint': rntCalc, 'rnt_loan': rntCalc,
    'js_jDep': jsCalc, 'js_mDep': jsCalc,
    'js_m2jDep': jsCalc, 'js_m2jMonthly': jsCalc,
    'js_rc_jDep': jsCalc, 'js_rc_mDep': jsCalc, 'js_rc_monthly': jsCalc,
    'ln_amt': lnCalc,
    'dsr_price': dsrCalc, 'dsr_income': dsrCalc, 'dsr_existing': dsrCalc,
    'dn_amt': dnCalc, 'dn_rel': dnCalc, 'dn_prior': dnCalc,
    'inh_amt': inhCalc, 'inh_type': inhCalc, 'inh_spouse': inhCalc, 'inh_debt': inhCalc,
    'cp_price': cpCalc, 'cp_type': cpCalc,
    'pt_price': ptCalc, 'pt_type': ptCalc,
    'tf_acqPrice': tfCalc, 'tf_salePrice': tfCalc, 'tf_expenses': tfCalc,
    'tf_acqDate': tfCalc, 'tf_saleDate': tfCalc,
    'r_appraise': roiCalc, 'r_minBid': roiCalc, 'r_bid': roiCalc,
    'r_acqTaxRate': roiCalc, 'r_evict': roiCalc, 'r_repair': roiCalc,
    'r_legal': roiCalc, 'r_mgmt': roiCalc,
    'r_rentDep': roiCalc, 'r_monthly': roiCalc, 'r_sale': roiCalc,
    'r_taxType': roiCalc,
  };
  Object.entries(calcMap).forEach(([id, fn]) => {
    const el = $$(id);
    if (el) { el.addEventListener('input', fn); el.addEventListener('change', fn); }
  });

  // 초기 한글 금액 표기 (r_legal 기본값)
  const legalEl = $$('r_legal');
  if (legalEl && legalEl.value) showKrw(legalEl, 'r_legal_krw');

  // 카카오 SDK 초기화
  if (window.Kakao && !Kakao.isInitialized()) {
    Kakao.init('YOUR_KAKAO_JS_KEY'); // 실제 JS 키로 교체 필요
  }
});

/* =====================================================
   역산 기능 — 목표 수익률로 최대 입찰가 계산
   ===================================================== */
function rvUpdate() {
  const v = $$('rv_roi')?.value || 15;
  set('rv_roiDisp', v + '%');
  rvCalc();
}

function rvCalc() {
  const targetROI  = (parseInt($$('rv_roi')?.value) || 15) / 100;
  const sale       = num('rv_sale');
  const appraise   = num('r_appraise');
  const loanPct    = parseInt($$('r_loanPct')?.value || 70) / 100;
  const acqRate    = parseFloat($$('r_acqTaxRate')?.value || 0.011);
  const rate       = parseFloat($$('r_rate')?.value || 4) / 100;
  const hold       = _holdMonths;
  const evict      = num('r_evict');
  const repair     = num('r_repair');
  const legal      = num('r_legal') || 1000000;
  const mgmt       = num('r_mgmt');
  const senior     = num('r_seniorDep');
  const rentDep    = num('r_rentDep');
  const monthly    = num('r_monthly');
  const taxTypeVal = $$('r_taxType')?.value || 'auto';

  const empty = $$('rvEmpty');
  const res   = $$('rvResult');

  if (sale === 0) {
    if (empty) empty.style.display = 'flex';
    if (res)   res.style.display   = 'none';
    return;
  }

  // 이진 탐색으로 최적 입찰가 역산
  // 목표: afterNet / ownCap >= targetROI
  let lo = 1000000, hi = sale * 1.5, best = 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const { afterROI } = _calcRoiAt(mid, sale, loanPct, acqRate, rate, hold,
      evict, repair, legal, mgmt, senior, monthly, rentDep, taxTypeVal);
    if (afterROI >= targetROI) { best = mid; lo = mid; }
    else hi = mid;
    if (hi - lo < 1000) break;
  }

  if (best < 1000) {
    if (empty) empty.style.display = 'flex';
    if (res)   res.style.display   = 'none';
    return;
  }

  best = Math.floor(best / 10000) * 10000; // 만원 단위 절사
  const { ownCap, afterNet } = _calcRoiAt(best, sale, loanPct, acqRate, rate, hold,
    evict, repair, legal, mgmt, senior, monthly, rentDep, taxTypeVal);

  if (empty) empty.style.display = 'none';
  if (res)   res.style.display   = 'block';

  set('rv_maxBid',    fmt(best));
  set('rv_maxBidKrw', fmtKrw(best));
  set('rv_ratio',     appraise > 0 ? pct(best / appraise) + ' (감정가 대비)' : '-');
  set('rv_own',       fmt(ownCap));
  set('rv_net',       fmt(afterNet));

  const rvNote = $$('rv_note');
  if (rvNote) {
    if (appraise > 0 && best > appraise * 0.95) {
      rvNote.textContent = '⚠️ 역산 금액이 감정가에 근접 — 실제 낙찰 경쟁률 감안하여 조정 필요';
    } else if (appraise > 0) {
      rvNote.textContent = `✅ 최저가 대비 ${pct(best / appraise)} 수준에서 목표 수익률 달성 가능`;
    } else {
      rvNote.textContent = '감정가를 입력하면 감정가 대비 비율도 표시됩니다';
    }
  }
}

function _calcRoiAt(bid, sale, loanPct, acqRate, rate, hold,
    evict, repair, legal, mgmt, senior, monthly, rentDep, taxTypeVal) {
  const loanAmt   = bid * loanPct;
  const minBid    = num('r_minBid');
  const bidDep    = minBid > 0 ? Math.ceil(minBid / 10 / 10000) * 10000 : bid * 0.1;
  const remain    = Math.max(0, bid - loanAmt - bidDep);
  const acqTax    = Math.round(bid * acqRate);
  const totalAdd  = acqTax + evict + repair + legal + mgmt + senior;
  const mInt      = Math.round((loanAmt * rate) / 12);
  const totalInt  = mInt * hold;
  const brok      = Math.round(sale * 0.004);
  const totalExp  = totalInt + brok;
  const totalRent = monthly * hold;
  const ownCap    = remain + totalAdd;
  const netProfit = (sale - bid) - totalAdd - totalExp + totalRent;
  const txResult  = _calcTransferTax(bid, sale, hold, taxTypeVal);
  const afterNet  = netProfit - txResult.tax;
  const afterROI  = ownCap > 0 ? afterNet / ownCap : 0;
  return { ownCap, afterNet, afterROI };
}

function toggleRevCalc() {
  const body = $$('revCalcBody');
  const icon = $$('revToggleIcon');
  const hint = $$('revHint');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (icon) icon.innerHTML = isOpen ? '<i class="fas fa-chevron-down"></i>' : '<i class="fas fa-chevron-up"></i>';
  if (hint) hint.style.display = isOpen ? '' : 'none';
}

function rvApplyBid() {
  const maxBidEl = $$('rv_maxBid');
  if (!maxBidEl || maxBidEl.textContent === '-') return;
  // fmt 역변환: 억·만원 숫자 추출
  const bidInp = $$('r_bid');
  if (!bidInp) return;
  // 이진탐색에서 구한 best 값을 다시 역산
  const targetROI  = (parseInt($$('rv_roi')?.value) || 15) / 100;
  const sale       = num('rv_sale');
  const loanPct    = parseInt($$('r_loanPct')?.value || 70) / 100;
  const acqRate    = parseFloat($$('r_acqTaxRate')?.value || 0.011);
  const rate       = parseFloat($$('r_rate')?.value || 4) / 100;
  const hold       = _holdMonths;
  let lo = 1000000, hi = sale * 1.5, best = 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const { afterROI } = _calcRoiAt(mid, sale, loanPct, acqRate, rate, hold,
      num('r_evict'), num('r_repair'), num('r_legal')||1000000,
      num('r_mgmt'), num('r_seniorDep'), num('r_monthly'), num('r_rentDep'),
      $$('r_taxType')?.value || 'auto');
    if (afterROI >= targetROI) { best = mid; lo = mid; }
    else hi = mid;
    if (hi - lo < 1000) break;
  }
  best = Math.floor(best / 10000) * 10000;
  bidInp.value = best;
  showKrw(bidInp, 'r_bid_krw');
  // 매도가도 동기화
  if (sale > 0) { $$('r_sale').value = sale; showKrw($$('r_sale'), 'r_sale_krw'); }
  roiCalc();
  showToast('✅ 입찰가 ' + fmt(best) + ' 적용됨');
}

/* =====================================================
   엑셀(CSV) 내보내기
   ===================================================== */
function exportToExcel() {
  const addr   = $$('r_addr')?.value  || '';
  const caseNo = $$('r_caseNo')?.value|| '';
  const g = id => $$('dt_' + id)?.textContent || '-';

  const rows = [
    ['항목', '금액'],
    ['사건번호', caseNo],
    ['소재지',   addr],
    ['낙찰가',   g('bid')],
    ['취득세',   g('acq')],
    ['명도비',   g('evict')],
    ['인테리어', g('repair')],
    ['법무사·기타', g('legal')],
    ['미납관리비', g('mgmt')],
    ['인수보증금', g('senior')],
    ['총 추가비용', g('totalCost')],
    ['보유기간 이자', g('tInterest')],
    ['중개수수료', g('brok')],
    ['지출합계', g('totalExp')],
    ['매도금액', g('sale')],
    ['자기자본', g('own')],
    ['세전 순수익', g('net')],
    ['예상 양도세', g('tax')],
    ['세후 순수익', g('after')],
    ['세전 수익률', g('roi')],
    ['세후 수익률', g('aroi')],
  ];

  const bom  = '\uFEFF'; // 엑셀 한글 깨짐 방지
  const csv  = bom + rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const name = (caseNo || '수익률분석') + '_대장TV.csv';
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
  showToast('📊 엑셀(CSV) 다운로드 완료');
}

/* =====================================================
   카카오톡 공유
   ===================================================== */
function shareKakao() {
  const addr   = $$('r_addr')?.value   || '물건 주소 없음';
  const after  = $$('dt_after')?.textContent || '-';
  const aroi   = $$('dt_aroi')?.textContent  || '-';
  const tax    = $$('dt_tax')?.textContent   || '-';

  // Kakao SDK가 로드·초기화된 경우
  if (window.Kakao && Kakao.isInitialized()) {
    Kakao.Share.sendDefault({
      objectType: 'text',
      text: `📊 [대장TV 수익률 분석]\n\n물건: ${addr}\n세후 순수익: ${after}\n세후 수익률: ${aroi}\n예상 양도세: ${tax}\n\n대장TV 경매 전용 계산기로 분석한 결과입니다.`,
      link: {
        mobileWebUrl: 'https://bosstvauction.co.kr/',
        webUrl: 'https://bosstvauction.co.kr/',
      },
    });
    return;
  }

  // SDK 미로드 시 — 텍스트 복사 후 안내
  const txt = `📊 [대장TV 수익률 분석]\n물건: ${addr}\n세후 순수익: ${after}\n세후 수익률: ${aroi}\n예상 양도세: ${tax}\n\nhttps://bosstvauction.co.kr/`;
  navigator.clipboard.writeText(txt).then(() => {
    showToast('📋 카카오톡에 붙여넣기하세요 (텍스트 복사됨)');
  }).catch(() => {
    showToast('카카오 공유: 브라우저에서 직접 카카오톡 앱을 열어 붙여넣기하세요');
  });
}

/* =====================================================
   편의기능 ② — 결과 클립보드 복사
   ===================================================== */
function copyRoiResult(btn) {
  const bid    = $$('dt_bid')?.textContent    || '-';
  const acq    = $$('dt_acq')?.textContent    || '-';
  const own    = $$('dt_own')?.textContent    || '-';
  const net    = $$('dt_net')?.textContent    || '-';
  const tax    = $$('dt_tax')?.textContent    || '-';
  const after  = $$('dt_after')?.textContent || '-';
  const roi    = $$('dt_roi')?.textContent    || '-';
  const aroi   = $$('dt_aroi')?.textContent  || '-';
  const addr   = $$('r_addr')?.value          || '';
  const caseNo = $$('r_caseNo')?.value        || '';

  const txt = [
    '[ 대장옥션 수익률 분석 결과 ]',
    caseNo ? '사건번호: ' + caseNo : '',
    addr   ? '소재지: '   + addr   : '',
    '─────────────────',
    '낙찰가:      ' + bid,
    '취득세:      ' + acq,
    '자기자본:    ' + own,
    '세전 순수익: ' + net,
    '예상 양도세: ' + tax,
    '세후 순수익: ' + after,
    '세전 수익률: ' + roi,
    '세후 수익률: ' + aroi,
    '─────────────────',
    '※ 사전 예측 참고용 / bosstvauction.co.kr',
  ].filter(Boolean).join('\n');

  navigator.clipboard.writeText(txt).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = '<i class="fas fa-check"></i> 복사됨';
    showToast('📋 결과가 클립보드에 복사됐습니다');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = '<i class="fas fa-copy"></i> 복사';
    }, 2500);
  }).catch(() => showToast('⚠️ 복사 실패 — 브라우저 권한 확인'));
}

/* =====================================================
   편의기능 ③ — 토스트 메시지
   ===================================================== */
function showToast(msg, duration = 2400) {
  const t = $$('toastMsg');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

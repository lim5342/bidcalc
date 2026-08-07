/* ============================================================
   대장TV 상담 신청 위젯 (consult-form.js)
   - 계산기 어느 페이지에나 붙일 수 있는 상담 폼
   - ★핵심: DB 저장 성공을 "확인한 뒤에만" 완료 표시 (리드 유실 방지)
   - 사용법:
       1) <head>에 supabase SDK + config.js 로드
       2) <body> 원하는 위치에 <div id="consult-widget"></div>
       3) 이 파일 로드
       4) (선택) openConsult({propertyType:'아파트', ...}) 로 계산결과 함께 전송
   ============================================================ */
(function(){
  "use strict";
  const CFG = window.DAEJANG_SUPABASE || {};
  let sb = null;

  function ready(){
    return CFG.url && CFG.anonKey && !CFG.url.includes('여기에') && window.supabase;
  }
  function client(){
    if(!sb && ready()) sb = window.supabase.createClient(CFG.url, CFG.anonKey);
    return sb;
  }

  // 위젯 HTML 주입
  function mount(){
    const host = document.getElementById('consult-widget');
    if(!host) return;
    host.innerHTML = `
      <div id="cf-card" style="max-width:460px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:14px;padding:22px;box-shadow:0 4px 20px rgba(0,0,0,.06)">
        <div style="font-size:17px;font-weight:800;color:#1a1a1a;margin-bottom:4px">
          <span style="color:#f5a623">★</span> 대장TV 전문가 무료 상담
        </div>
        <div style="font-size:13px;color:#888;margin-bottom:16px">
          수강생 3,000명+ · 물건 선정부터 낙찰 후까지 1:1 안내
        </div>
        <div style="margin-bottom:10px">
          <input id="cf-name" placeholder="이름" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:14px"/>
        </div>
        <div style="margin-bottom:10px">
          <input id="cf-phone" inputmode="numeric" placeholder="연락처 ( - 없이 숫자만 )" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:14px"/>
        </div>
        <div style="margin-bottom:12px">
          <textarea id="cf-memo" rows="2" placeholder="문의 내용 (선택)" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:14px;resize:vertical"></textarea>
        </div>
        <label style="display:flex;align-items:flex-start;gap:7px;font-size:12px;color:#666;margin-bottom:14px;cursor:pointer">
          <input type="checkbox" id="cf-agree" style="width:auto;margin-top:2px"/>
          <span>개인정보(이름·연락처) 수집 및 상담 목적 이용에 동의합니다. 보유기간: 상담 완료 후 3년.</span>
        </label>
        <button id="cf-submit" style="width:100%;padding:13px;background:#f5a623;color:#1a1200;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer">
          무료 상담 신청
        </button>
        <div id="cf-msg" style="font-size:13px;margin-top:12px;text-align:center;display:none"></div>
      </div>`;

    // 연락처 자동 하이픈
    const ph = host.querySelector('#cf-phone');
    ph.addEventListener('input', ()=>{
      let v = ph.value.replace(/\D/g,'').slice(0,11);
      if(v.length<4) ph.value=v;
      else if(v.length<8) ph.value=v.slice(0,3)+'-'+v.slice(3);
      else ph.value=v.slice(0,3)+'-'+v.slice(3,7)+'-'+v.slice(7);
    });
    host.querySelector('#cf-submit').onclick = submit;
  }

  // 외부에서 계산결과를 실어 보낼 수 있게 임시 저장
  let extraPayload = {};
  window.setConsultPayload = (obj)=>{ extraPayload = obj||{}; };

  async function submit(){
    const host = document.getElementById('consult-widget');
    const name = host.querySelector('#cf-name').value.trim();
    const phone = host.querySelector('#cf-phone').value.trim();
    const memo = host.querySelector('#cf-memo').value.trim();
    const agree = host.querySelector('#cf-agree').checked;
    const btn = host.querySelector('#cf-submit');

    if(!name)  return msg('이름을 입력해 주세요.', false);
    if(phone.replace(/\D/g,'').length < 10) return msg('연락처를 정확히 입력해 주세요.', false);
    if(!agree) return msg('개인정보 수집에 동의해 주세요.', false);

    const c = client();
    // ★ 리드 유실 방지 1: DB 연결 자체가 안 되면 "완료"라고 속이지 않는다
    if(!c){
      return msg('일시적으로 신청이 어렵습니다. 잠시 후 다시 시도하거나 02-853-5875로 연락 주세요.', false);
    }

    btn.disabled = true; btn.textContent = '신청 중...';

    const record = {
      source: CFG.source || 'unknown',
      name, phone,
      memo: memo || null,
      payload: extraPayload
    };

    try{
      // ★ 리드 유실 방지 2: 저장 결과를 반드시 확인
      const { error } = await c.from('leads').insert([record]);
      if(error) throw error;

      // 여기 도달 = 진짜 저장 성공한 경우에만
      host.querySelector('#cf-card').innerHTML = `
        <div style="text-align:center;padding:20px 0">
          <div style="font-size:44px">✅</div>
          <div style="font-size:18px;font-weight:800;margin:10px 0 6px">상담 신청 완료</div>
          <div style="font-size:14px;color:#666;line-height:1.6">
            담당 전문가가 영업일 기준 24시간 내 연락드립니다.<br>
            대표번호 <b>02-853-5875</b>
          </div>
        </div>`;
    }catch(err){
      // ★ 리드 유실 방지 3: 실패 시 절대 완료 표시 안 함
      console.error('[consult] 저장 실패:', err);
      btn.disabled = false; btn.textContent = '무료 상담 신청';
      msg('신청 저장에 실패했습니다. 다시 시도하시거나 02-853-5875로 연락 주세요.', false);
    }
  }

  function msg(text, ok){
    const el = document.getElementById('consult-widget').querySelector('#cf-msg');
    el.textContent = text;
    el.style.display = 'block';
    el.style.color = ok ? '#2e9e5b' : '#d84550';
  }

  // 모달 방식으로 열고 싶을 때 (버튼에서 호출)
  window.openConsult = (payload)=>{
    if(payload) window.setConsultPayload(payload);
    let modal = document.getElementById('consult-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'consult-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
      modal.innerHTML = `<div style="position:relative;width:100%;max-width:460px">
        <span onclick="document.getElementById('consult-modal').remove()" style="position:absolute;top:-30px;right:0;color:#fff;font-size:26px;cursor:pointer">×</span>
        <div id="consult-widget"></div>
      </div>`;
      document.body.appendChild(modal);
      mount();
    }
  };

  // 페이지에 인라인 위젯이 이미 있으면 즉시 렌더
  if(document.getElementById('consult-widget')) mount();
})();

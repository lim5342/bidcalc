(function () {
  'use strict';
  const host=document.getElementById('interior-calculator');
  if(!host) return;
  const engine=window.InteriorCalc;
  const states=engine.clone(engine.defaults);
  const names=['종합','도배','장판','마루','욕실','주방','필름','타일','도어'];
  const icons=['house','paint-roller','layer-group','border-all','bath','sink','clone','th-large','door-open'];
  const titles=['종합 리모델링',...names.slice(1)].map(n=>n+' 견적 계산');
  const settings={vat:true,overhead:0,reserve:10,prices:{}};
  const storageKey='bidcalc.interior.prices.v1';
  try {
    const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');
    if(saved && typeof saved==='object') Object.entries(saved).forEach(([k,v])=>{
      if(Object.hasOwn(engine.prices,k)&&typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100000000) settings.prices[k]=v;
    });
  } catch (_) { /* 저장소가 제한되어도 계산은 계속 제공한다. */ }
  let category=0,result=null,toastTimer;
  const format=n=>Math.round(n).toLocaleString('ko-KR');
  const won=n=>format(n)+'원';
  const man=n=>format(n/10000);
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options=(name,label,values,extra={})=>({name,label,type:'options',values,...extra});
  const numeric=(name,label,min,max,unit,extra={})=>({name,label,type:'number',min,max,unit,...extra});
  const toggle=(name,label)=>({name,label,type:'boolean'});
  const area={name:'area',label:'시공 면적 · 전용면적',type:'area'};
  const brand=options('brand','선호하는 자재 브랜드',[['brand','브랜드'],['nonbrand','비브랜드'],['any','무관']]);
  const current=options('current','현재 바닥 상태',[['vinyl','장판'],['wood','마루'],['none','없음']]);
  const expanded=toggle('expanded','발코니가 확장되어 있어요');
  const shapes=[['straight','ㅡ형'],['l','ㄱ형'],['u','ㄷ형']];
  const bathroomExtras=[['zendai','젠다이'],['cabinet','거울수납장'],['shelf','선반'],['fan','환풍기'],['bidet','비데']];
  const kitchenExtras=[['island','아일랜드 식탁'],['fridge','냉장고장'],['tall','키큰장'],['shelf','뒷선반'],['cooktop','쿡탑'],['flap','플랩장']];
  const includes=(s,k,v)=>s[k].includes(v);
  const fields=[
    [options('residence','주거 유형',[['apartment','아파트'],['villa','빌라'],['house','단독주택']],{housing:true}),{...area,label:'평수 · 공급면적',slider:true},
      options('window','창호 / 샷시',[['none','시공 안 함'],['full','전체 시공'],['partial','부분 시공'],['film','필름 시공'],['folding','폴딩도어']]),
      options('balcony','발코니 확장',[[0,'시공 안 함'],[1,'1개'],[2,'2개'],[3,'3개']]),
      options('paper','도배',[['none','시공 안 함'],['silk','실크'],['paper','합지'],['mix','실크 & 합지']]),
      options('floor','바닥재',[['none','시공 안 함'],['v20','장판'],['laminate','강화마루'],['engineered','강마루'],['wood','원목마루'],['porcelain','포세린타일'],['marble','천연대리석']]),
      options('kitchen','주방',[['none','시공 안 함'],['full','전체 교체'],['partial','부분 교체']]),
      options('bathrooms','욕실',[[0,'시공 안 함'],[1,'1개'],[2,'2개'],[3,'3개']]),
      options('door','도어 / 문틀',[['none','시공 안 함'],['reform','리폼'],['frame','교체']]),
      options('electric','전기 / 조명',[['socket','스위치 & 콘센트'],['wiring','전기배선'],['light','조명']],{multiple:true}),
      options('etc','기타 시공',[['veranda','베란다 칠 & 타일'],['molding','몰딩 교체'],['entrance','현관 타일·문'],['shoe','현관장'],['middle','3연동 중문'],['heating','보일러·난방']],{multiple:true})],
    [options('paper','벽지 종류',[['paper','합지'],['silk','실크']]),options('grade','벽지 등급',[['normal','일반'],['premium','고급']]),area,expanded,options('ceiling','천장 시공',[[true,'천장 포함'],[false,'천장 미포함']])],
    [options('thickness','장판 두께',[['v18','1.8mm'],['v20','2.0mm'],['v22','2.2mm']]),brand,area,expanded,current],
    [options('floor','마루 종류',[['engineered','강마루'],['laminate','강화마루'],['wood','원목마루'],['ondol','온돌마루']]),brand,area,expanded,current],
    [numeric('big','공용 욕실 (거실)',0,3,'개',{integer:true}),numeric('small','소형 욕실 (안방)',0,3,'개',{integer:true}),
      options('type','욕실 형태',[['tub','욕조형'],['shower','샤워부스형'],['powder','파우더형']]),
      options('tub','욕조 형태',[['tub','일반'],['whirlpool','월풀'],['mobile','이동식']],{when:s=>s.type==='tub'}),
      options('booth','샤워부스 형태',[['partition','파티션'],['swing','여닫이'],['booth','부스']],{when:s=>s.type==='shower'}),
      options('ceiling','천장 유형',[['woodCeil','리빙우드'],['smcCeil','SMC 돔']]),options('tile','타일 시공 범위',[['wall','벽'],['floor','바닥'],['both','벽 + 바닥']]),
      options('addons','추가 옵션',bathroomExtras,{multiple:true})],
    [options('shape','싱크대 형태',shapes),numeric('length','싱크대 가로 사이즈 (가장 긴 면)',100,1500,'cm'),
      options('top','상판 종류',[['pt','PT'],['stone','인조대리석']]),options('door','도어 종류',[['hi','하이그로시 (유광)'],['pet','PET (무광)'],['transfer','열전사'],['uv','UV 도장'],['wood','원목']]),
      options('wall','벽타일',[[false,'기존 유지'],[true,'교체 시공']]),options('addons','추가 옵션',kitchenExtras,{multiple:true})],
    [options('features','필름 시공 항목',[['molding','천장몰딩'],['baseboard','걸레받이'],['window','창호'],['door','문·문틀'],['entrance','현관문'],['middle','중문'],['sink','싱크대'],['shoe','신발장'],['builtin','붙박이장']],{multiple:true}),
      {...area,when:s=>includes(s,'features','molding')||includes(s,'features','baseboard')},
      numeric('windows','시공할 창호 개수',1,20,'개',{integer:true,when:s=>includes(s,'features','window')}),
      numeric('doors','시공할 방문 개수',1,10,'개',{integer:true,when:s=>includes(s,'features','door')}),
      numeric('midDoors','시공할 중문 개수',1,5,'개',{integer:true,when:s=>includes(s,'features','middle')}),
      numeric('sinkDoors','싱크대 문 개수',1,30,'개',{integer:true,when:s=>includes(s,'features','sink')}),
      numeric('shoeWidth','신발장 가로 길이',10,1500,'cm',{when:s=>includes(s,'features','shoe')}),
      numeric('builtinWidth','붙박이장 가로 길이',10,1500,'cm',{when:s=>includes(s,'features','builtin')}),brand],
    [options('features','타일 시공 공간',[['kitchen','주방'],['entrance','현관'],['balcony','발코니'],['floor','바닥']],{multiple:true}),area,
      options('shape','현재 싱크대 형태',shapes,{when:s=>includes(s,'features','kitchen')}),
      options('entrance','현관 타일 등급',[['normal','일반'],['premium','고급']],{when:s=>includes(s,'features','entrance')}),
      options('balcony','발코니 타일 등급',[['normal','일반'],['premium','고급']],{when:s=>includes(s,'features','balcony')}),
      options('floor','바닥 타일 종류',[['polished','폴리싱타일'],['porcelain','포세린타일']],{when:s=>includes(s,'features','floor')}),
      {...expanded,when:s=>includes(s,'features','floor')},{...current,values:current.values.slice(0,2),when:s=>includes(s,'features','floor')},{...brand,when:s=>includes(s,'features','floor')}],
    [options('features','도어 시공 항목',[['room','방문'],['mid','중문'],['folding','폴딩도어']],{multiple:true}),
      numeric('rooms','방문 개수',1,10,'개',{integer:true,when:s=>includes(s,'features','room')}),
      options('roomType','방문 시공 범위',[['room','문만 시공'],['frame','문·문틀 포함']],{when:s=>includes(s,'features','room')}),
      numeric('midDoors','중문 개수',1,5,'개',{integer:true,when:s=>includes(s,'features','mid')}),
      options('midType','중문 종류',[[0,'여닫이 기본'],[1,'여닫이 망입'],[2,'2연동 포켓 기본'],[3,'2연동 포켓 망입'],[4,'3연동 포켓 기본'],[5,'3연동 포켓 망입'],[6,'ㄱ자 3연동 기본'],[7,'ㄱ자 3연동 망입']],{when:s=>includes(s,'features','mid')}),
      numeric('width','폴딩도어 가로 길이',50,1500,'cm',{when:s=>includes(s,'features','folding')}),
      options('foldingType','폴딩도어 문짝 폭',[['folding500','500mm'],['folding650','650mm']],{when:s=>includes(s,'features','folding')}),
      options('demolition','기존 창호',[[true,'철거·마감 포함'],[false,'기존 창호 없음']],{when:s=>includes(s,'features','folding')})]
  ];
  host.innerHTML=`<div class="ic-top"><div class="ic-eyebrow">BIDCALC · INTERIOR</div><h1>인테리어 비용,<br class="ic-mobile-br"> 미리 계산해 보세요</h1><p>우리 집 면적과 시공 항목을 선택하면 예상 예산을 바로 확인할 수 있어요.</p></div>
    <div class="ic-layout"><nav class="ic-nav" aria-label="인테리어 공종" role="tablist">${names.map((n,i)=>`<button type="button" role="tab" id="ic-tab-${i}" aria-controls="ic-form" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-category="${i}"><i class="fas fa-${icons[i]}" aria-hidden="true"></i>${n}</button>`).join('')}</nav>
    <div class="ic-form"><div class="ic-form-head"><h2 id="ic-title"></h2><button type="button" class="ic-reset" data-action="reset">↻ 초기화</button></div>
    <div class="ic-notice"><strong>선택한 자재와 시공 범위로 예산을 계산합니다.</strong><br>아래 금액은 bidcalc의 임시 기준단가로 산정한 참고 예산입니다. 현장 상태와 업체에 따라 달라집니다. 종합은 공급면적, 부분 시공은 전용면적을 입력해주세요.<button type="button" class="ic-sample" data-action="sample">32평 리모델링 예시 입력</button></div>
    <form id="ic-form" role="tabpanel" aria-labelledby="ic-tab-0" novalidate></form>
    <details class="ic-basis"><summary>계산 기준과 단가 조정</summary><p>오늘의집과 동일한 계산식·단가가 아닙니다. 자재와 기본 시공 인건비를 포함한 임시값이며, 실제 업체 견적을 받은 후 아래 단가를 수정해 비교할 수 있습니다.</p>
      <label class="ic-inline"><input type="checkbox" data-setting="vat" checked> 부가세 10% 포함</label>
      <div class="ic-rate-row"><label>현장 관리비 (%)<input type="number" data-setting="overhead" min="0" max="30" step="1" value="0"></label><label>예비비 (%)<input type="number" data-setting="reserve" min="0" max="30" step="1" value="10"></label></div>
      <p>시공비 = 수량 × 기준단가 × 보정계수의 합계<br>부가세 = (시공비 + 관리비) × 10%<br>예산 범위 = 부가세 반영 합계의 ±15%<br>권장 준비금 = 합계 + 예비비</p>
      <div id="ic-price-editor"></div><button type="button" class="ic-secondary ic-price-reset" data-action="prices-reset">단가를 기본값으로 되돌리기</button><p>수정한 단가는 이 브라우저에만 저장됩니다. 단가 변경은 모든 공종에 공통 적용됩니다. 예비비는 견적 합계에 중복으로 더하지 않습니다.</p>
    </details><p class="ic-tail">확장·철거·폐기물 처리·설비 이전·누수 보수 등 현장 추가 비용은 시공 범위에 따라 달라집니다. 종합의 전용면적·싱크대 길이·문 개수와 욕실·타일 면적은 가정값이므로 계산 기준을 함께 확인해주세요.</p></div>
    <aside class="ic-result" id="ic-result" aria-label="인테리어 계산 결과"><div class="ic-result-head"><p>선택한 조건의 예상 견적</p><div id="ic-range" class="ic-price" aria-live="polite"></div><p class="ic-subprice" id="ic-result-caption"></p></div>
    <div class="ic-result-body"><div id="ic-summary"></div><div class="ic-result-actions"><button type="button" class="ic-secondary" data-action="copy">결과 복사</button><button type="button" class="ic-secondary" data-action="download">내역 저장</button><button type="button" class="ic-secondary" data-action="print">인쇄</button></div>
    <div class="ic-apply"><select aria-label="수익률에 적용할 금액" id="ic-apply-value"><option value="total">기준 견적 적용</option><option value="min">최소 예산 적용</option><option value="max">최대 예산 적용</option><option value="budget">예비비 포함 준비금 적용</option></select><button type="button" class="ic-primary" data-action="apply">수익률 계산에 적용</button></div>
    <details class="ic-details" open><summary>상세 시공 내역 <span id="ic-item-count"></span></summary><div id="ic-breakdown"></div></details><p class="ic-tail">임시 기준단가를 사용한 참고 예산입니다.<br>공식 시공 견적이나 오늘의집 견적이 아닙니다.</p></div></aside></div>
    <div class="ic-mobile-bar"><div><small>예상 견적 · 참고 예산</small><strong id="ic-mobile-price"></strong></div><button type="button" class="ic-primary" data-action="result">상세 보기</button></div><div class="ic-status" role="status" hidden></div>`;
  const form=host.querySelector('#ic-form');
  form.addEventListener('submit',e=>e.preventDefault());
  function notify(message) {
    const box=host.querySelector('.ic-status');box.textContent=message;box.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{box.hidden=true;},2800);
  }
  function visibleFields(){return fields[category].filter(f=>!f.when||f.when(states[category]));}
  function renderForm() {
    const s=states[category];
    host.querySelector('#ic-title').textContent=titles[category];
    form.setAttribute('aria-labelledby','ic-tab-'+category);
    host.querySelector('.ic-sample').hidden=category!==0;
    form.innerHTML=visibleFields().map(f=>{
      const val=s[f.name],id='ic-field-'+f.name;
      let content='';
      if(f.type==='options') {
        const klass=f.values.length===2?'two':f.values.length===4?'four':'';
        content=`<div class="ic-options ${klass}">${f.values.map(([value,label],i)=>{
          const checked=f.multiple?val.includes(value):val===value;
          const icon=f.housing?`<i class="fas fa-${['building','house','house-chimney'][i]}" aria-hidden="true"></i>`:'';
          return `<label class="ic-choice ${f.housing?'ic-housing':''}"><input type="${f.multiple?'checkbox':'radio'}" aria-label="${escape(label)}" name="${f.name}" value="${escape(value)}" data-field="${f.name}" data-kind="${typeof value}" ${checked?'checked':''}><span>${icon}${escape(label)}</span></label>`;
        }).join('')}</div>`;
      } else if(f.type==='boolean') content=`<label class="ic-inline"><input type="checkbox" name="${f.name}" data-field="${f.name}" ${val?'checked':''}>${escape(f.label)}</label>`;
      else {
        const isArea=f.type==='area';
        content=`<div class="ic-number"><input type="number" id="${id}" name="${f.name}" aria-label="${escape(f.label)}" inputmode="decimal" data-field="${f.name}" min="${f.min??(isArea&&s.unit==='sqm'?engine.SQM_PER_PYEONG:1)}" max="${f.max??(s.unit==='sqm'?495.86775:150)}" step="${f.integer?1:'any'}" value="${escape(val)}" ${f.integer?'data-integer="true"':''}>${isArea?`<select data-field="unit" aria-label="면적 단위"><option value="py" ${s.unit==='py'?'selected':''}>평</option><option value="sqm" ${s.unit==='sqm'?'selected':''}>㎡</option></select>`:`<span class="ic-unit">${f.unit}</span>`}</div>`;
        if(isArea) content+=`<p class="ic-area-caption" id="ic-area-caption"></p>${f.slider?`<input class="ic-range" type="range" min="20" max="59" step="1" value="${s.unit==='sqm'?Number(val)/engine.SQM_PER_PYEONG:val}" data-area-range aria-label="공급면적 평수 슬라이더"><div class="ic-range-labels"><span>20평</span><span>59평</span></div><div class="ic-quick">${[20,24,32,40,59].map(n=>`<button type="button" data-pyeong="${n}">${n}평</button>`).join('')}</div>`:''}`;
      }
      return `<fieldset class="ic-field" data-name="${f.name}">${f.type!=='boolean'?`<legend>${escape(f.label)}${f.multiple?'<span class="ic-hint">여러 항목을 함께 선택할 수 있어요</span>':''}</legend>`:''}${content}</fieldset>`;
    }).join('');
    renderResult();
  }
  function setText(selector,text){host.querySelector(selector).textContent=text;}
  function renderResult() {
    result=engine.calculate(category,states[category],settings);
    const has=result.valid&&result.rows.length>0;
    const errors=result.errors;
    setText('#ic-range',!result.valid?'입력값 확인':has?`${man(result.min)} ~ ${man(result.max)}만원`:'시공 항목을 선택해주세요');
    setText('#ic-mobile-price',!result.valid?'입력값 확인':has?`${man(result.min)} ~ ${man(result.max)}만원`:'시공 항목 선택');
    setText('#ic-result-caption',has?`${names[category]} · ${result.rows.length}개 항목 · 부가세 ${settings.vat?'포함':'별도'} · 범위 ±15%`:'면적과 시공 범위를 선택하면 계산됩니다.');
    host.querySelector('#ic-summary').innerHTML=!result.valid?`<p class="ic-error" role="alert">${errors.map(escape).join('<br>')}</p>`:!has?'<div class="ic-empty">왼쪽에서 필요한 시공을 선택해주세요.</div>':
      `<p>선택한 시공 ${result.rows.length}개 항목의 기준 예산</p><div class="ic-totals">${[['시공비 합계',result.subtotal],['현장 관리비',result.management],['부가세',result.vat],['기준 견적',result.total],['예비비',result.contingency],['예비비 포함 준비금',result.budget]].map(([label,n],i)=>`<div class="ic-total-row ${i===3||i===5?'em':''}"><span>${label}</span><strong>${won(n)}</strong></div>`).join('')}</div>`;
    host.querySelector('#ic-breakdown').innerHTML=has?result.rows.map(r=>`<div class="ic-line-item"><div><span>${escape(r.label)}</span><strong>${won(r.amount)}</strong></div><small>${Number(r.qty.toFixed(3))}${r.unit} × ${won(r.unitPrice)}${r.factor!==1?' × '+Number(r.factor.toFixed(4)):''}${r.note?' · '+escape(r.note):''}</small></div>`).join(''):'';
    setText('#ic-item-count',has?`(${result.rows.length})`:'');
    host.querySelectorAll('[data-action="copy"],[data-action="download"],[data-action="apply"],[data-action="print"]').forEach(b=>b.disabled=!has);
    const editor=host.querySelector('#ic-price-editor');
    const keys=has?[...new Set(result.rows.map(r=>r.key))]:[];
    const editing=document.activeElement&&document.activeElement.dataset.price;
    if(!editing) editor.innerHTML=keys.map(k=>{const p=engine.prices[k];return `<div class="ic-price-row"><label for="ic-price-${k}">${escape(p.label)}<br><small>원 / ${p.unit}</small></label><input id="ic-price-${k}" type="number" min="0" max="100000000" step="1" data-price="${k}" value="${settings.prices[k]??p.amount}" aria-label="${escape(p.label)} 단가"></div>`;}).join('');
    const areaCaption=host.querySelector('#ic-area-caption');
    if(areaCaption){const s=states[category],n=Number(s.area);areaCaption.textContent=n>0?`${(s.unit==='py'?n*engine.SQM_PER_PYEONG:n).toFixed(2)}㎡ · ${(s.unit==='sqm'?n/engine.SQM_PER_PYEONG:n).toFixed(2)}평`:'';}
    host.querySelectorAll('[data-field]').forEach(input=>{if(input.type==='number')input.setAttribute('aria-invalid',input.validity.valid?'false':'true');});
  }
  function switchCategory(next,focus=false){
    category=next;
    host.querySelectorAll('[data-category]').forEach(b=>{const selected=Number(b.dataset.category)===next;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
    renderForm();if(focus)host.querySelector(`[data-category="${next}"]`).focus();
  }
  function parseValue(input){return input.dataset.kind==='boolean'?input.value==='true':input.dataset.kind==='number'?Number(input.value):input.value;}
  host.addEventListener('input',e=>{
    const input=e.target,s=states[category];
    if(input.matches('[data-area-range]')) {s.area=s.unit==='sqm'?Number(input.value)*engine.SQM_PER_PYEONG:Number(input.value);form.querySelector('[data-field="area"]').value=s.area;renderResult();return;}
    if(input.dataset.price){settings.prices[input.dataset.price]=input.value===''?NaN:Number(input.value);renderResult();return;}
    if(input.dataset.setting){settings[input.dataset.setting]=input.type==='checkbox'?input.checked:input.value===''?NaN:Number(input.value);renderResult();return;}
    const key=input.dataset.field;
    if(!key||input.type==='radio'||input.type==='checkbox'||input.tagName==='SELECT')return;
    s[key]=input.value===''?'':Number(input.value);renderResult();
    const slider=form.querySelector('[data-area-range]');if(slider&&key==='area')slider.value=s.unit==='sqm'?Number(s.area)/engine.SQM_PER_PYEONG:s.area;
  });
  host.addEventListener('change',e=>{
    const input=e.target,s=states[category],key=input.dataset.field;
    if(input.dataset.price){
      if(result.valid){try{localStorage.setItem(storageKey,JSON.stringify(settings.prices));}catch(_){notify('단가가 적용됐습니다. 브라우저 저장은 제한되어 있습니다.');}}
      return;
    }
    if(!key)return;
    if(key==='unit') {
      const area=Number(s.area);const old=s.unit;s.unit=input.value;
      if(Number.isFinite(area)&&s.area!=='')s.area=old==='py'?area*engine.SQM_PER_PYEONG:area/engine.SQM_PER_PYEONG;
      renderForm();return;
    }
    const field=fields[category].find(f=>f.name===key);
    if(input.type==='checkbox'&&field.multiple){const value=parseValue(input);s[key]=input.checked?[...s[key],value]:s[key].filter(v=>v!==value);}
    else if(field.type==='boolean')s[key]=input.checked;
    else if(input.type==='radio')s[key]=parseValue(input);
    if(['features','type'].includes(key))renderForm();else renderResult();
  });
  host.querySelector('.ic-nav').addEventListener('keydown',e=>{
    let next=category;
    if(e.key==='ArrowDown'||e.key==='ArrowRight')next=(category+1)%9;
    else if(e.key==='ArrowUp'||e.key==='ArrowLeft')next=(category+8)%9;
    else if(e.key==='Home')next=0;else if(e.key==='End')next=8;else return;
    e.preventDefault();switchCategory(next,true);
  });
  function exportText(){
    return [`bidcalc ${titles[category]}`,'임시 기준단가를 사용한 참고 예산 (오늘의집 견적과 다름)',...result.rows.map(r=>`${r.label}: ${Number(r.qty.toFixed(3))}${r.unit} × ${won(r.unitPrice)} × ${Number(r.factor.toFixed(4))} = ${won(r.amount)}${r.note?' ('+r.note+')':''}`),`시공비: ${won(result.subtotal)}`,`현장 관리비: ${won(result.management)}`,`부가세: ${won(result.vat)} (${settings.vat?'포함':'별도'})`,`기준 견적: ${won(result.total)}`,`예상 범위 (±15%): ${won(result.min)} ~ ${won(result.max)}`,`예비비 (${settings.reserve}%): ${won(result.contingency)}`,`예비비 포함 준비금: ${won(result.budget)}`].join('\n');
  }
  host.addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.category!=null){switchCategory(Number(button.dataset.category));return;}
    if(button.dataset.pyeong){states[category].area=states[category].unit==='sqm'?Number(button.dataset.pyeong)*engine.SQM_PER_PYEONG:Number(button.dataset.pyeong);renderForm();return;}
    const action=button.dataset.action;
    if(action==='reset'){states[category]=engine.clone(engine.defaults[category]);renderForm();notify('현재 공종을 초기화했습니다.');}
    if(action==='prices-reset'){settings.prices={};try{localStorage.removeItem(storageKey);}catch(_){}renderResult();notify('기준단가를 초기화했습니다.');}
    if(action==='sample'){states[0]={...engine.clone(engine.defaults[0]),paper:'silk',floor:'engineered',kitchen:'full',bathrooms:1,door:'reform',electric:['socket','light']};switchCategory(0);notify('32평 리모델링 예시를 입력했습니다.');}
    if(action==='result')host.querySelector('#ic-result').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    if(action==='copy') {
      try{await navigator.clipboard.writeText(exportText());notify('계산 결과를 복사했습니다.');}
      catch(_){notify('복사가 제한되어 있습니다. 내역 저장을 이용해주세요.');}
    }
    if(action==='download') {
      const csvCell=v=>'"'+String(v).replace(/"/g,'""')+'"';
      const rows=[['항목','수량','단위','단가(원)','보정계수','금액(원)','계산 기준'],...result.rows.map(r=>[r.label,r.qty.toFixed(4),r.unit,r.unitPrice,r.factor,r.amount,r.note]),['시공비','','','','',result.subtotal,''],['현장 관리비','','','','',result.management,settings.overhead+'%'],['부가세','','','','',result.vat,settings.vat?'포함':'별도'],['기준 견적','','','','',result.total,''],['예비비','','','','',result.contingency,settings.reserve+'%'],['예비비 포함 준비금','','','','',result.budget,''],['예상 최소','','','','',result.min,'합계 -15%'],['예상 최대','','','','',result.max,'합계 +15%'],['주의','','','','','','bidcalc 임시 기준단가이며 오늘의집 견적과 다름']];
      const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download=`bidcalc_인테리어_${names[category]}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);notify('내역을 저장했습니다.');
    }
    if(action==='print'){host.querySelector('.ic-details').open=true;window.print();}
    if(action==='apply') {
      const amount=result[host.querySelector('#ic-apply-value').value];
      const target=document.getElementById('r_repair');
      if(!target){location.href='index.html?tab=roi&repair='+amount;return;}
      target.value=amount;target.dataset.edited='true';target.dispatchEvent(new Event('input',{bubbles:true}));
      window.switchTab('roi',document.querySelector('.tab-btn[data-tab="roi"]'));target.scrollIntoView({block:'center'});target.focus({preventScroll:true});
      if(window.showToast)window.showToast('인테리어 비용 '+won(amount)+'을 적용했습니다.');
    }
  });
  // 다른 계산기를 보고 있을 때 모바일 하단 바가 화면을 가리지 않도록 처리한다.
  const pane=document.getElementById('tab-interior');
  const updateVisibility=()=>{host.querySelector('.ic-mobile-bar').hidden=pane&&!pane.classList.contains('active');};
  if(pane)new MutationObserver(updateVisibility).observe(pane,{attributes:true,attributeFilter:['class']});
  const params=new URLSearchParams(location.search);
  const start=Number(params.get('category')||0);if(Number.isInteger(start)&&start>=0&&start<=8)category=start;
  switchCategory(category);updateVisibility();
  const initialize=()=>{
    const requested=params.get('tab');
    if(window.switchTab&&['interior','roi'].includes(requested)){const button=document.querySelector(`.tab-btn[data-tab="${requested}"]`);if(button)window.switchTab(requested,button);}
    const repair=params.get('repair');
    if(requested==='roi'&&repair!==null&&/^\d{1,13}$/.test(repair)&&Number(repair)<=1000000000000){
      const input=document.getElementById('r_repair');if(input){input.value=repair;input.dataset.edited='true';input.dispatchEvent(new Event('input',{bubbles:true}));}
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();

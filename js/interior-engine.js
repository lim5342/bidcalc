/* bidcalc 자체 예산 모델. 모든 기본 단가는 임시 입력값이며 오늘의집 단가가 아니다. */
(function (root) {
  'use strict';
  const SQM_PER_PYEONG = 3.305785;
  const prices = {};
  const add = (key, label, unit, amount) => { prices[key] = { label, unit, amount }; };
  [
    ['paper.silk','실크 도배','평',105000],['paper.paper','합지 도배','평',65000],['paper.mix','실크·합지 도배','평',85000],
    ['floor.v18','장판 1.8mm','평',65000],['floor.v20','장판 2.0mm','평',80000],['floor.v22','장판 2.2mm','평',95000],
    ['floor.laminate','강화마루','평',110000],['floor.engineered','강마루','평',145000],['floor.wood','원목마루','평',250000],['floor.ondol','온돌마루','평',180000],
    ['floor.porcelain','포세린타일 바닥','평',230000],['floor.marble','천연대리석 바닥','평',400000],
    ['remove.vinyl','장판 철거','평',10000],['remove.wood','마루 철거','평',30000],['remove.tile','타일 철거','㎡',20000],
    ['window.full','창호 전체 교체','공급평',320000],['window.partial','창호 부분 교체','공급평',150000],['window.film','창호 필름','공급평',50000],['window.folding','폴딩도어','m',650000],
    ['balcony.expand','발코니 확장','개',3500000],['kitchen.full','주방 전체 교체','m',1300000],['kitchen.partial','주방 부분 교체','m',650000],
    ['bath.base','욕실 기본 시공','개',1800000],['bath.tile','욕실 타일 시공','㎡',90000],['bath.tub','일반 욕조','개',500000],['bath.whirlpool','월풀 욕조','개',1500000],['bath.mobile','이동식 욕조','개',700000],
    ['bath.partition','샤워 파티션','개',350000],['bath.swing','샤워 여닫이','개',550000],['bath.booth','샤워부스','개',850000],
    ['bath.woodCeil','욕실 리빙우드 천장','개',250000],['bath.smcCeil','욕실 SMC 돔 천장','개',400000],
    ['bath.zendai','젠다이','개',180000],['bath.cabinet','거울수납장','개',220000],['bath.shelf','욕실 선반','개',60000],['bath.fan','환풍기','개',90000],['bath.bidet','비데','개',350000],
    ['door.reform','문·문틀 리폼','개',180000],['door.room','방문 교체','개',250000],['door.frame','방문·문틀 교체','개',450000],
    ['door.mid0','여닫이 기본 중문','개',700000],['door.mid1','여닫이 망입 중문','개',850000],['door.mid2','2연동 포켓 기본','개',1000000],['door.mid3','2연동 포켓 망입','개',1150000],
    ['door.mid4','3연동 포켓 기본','개',1100000],['door.mid5','3연동 포켓 망입','개',1250000],['door.mid6','ㄱ자 3연동 기본','개',1500000],['door.mid7','ㄱ자 3연동 망입','개',1700000],
    ['door.folding500','폴딩도어 폭 500mm','m',650000],['door.folding650','폴딩도어 폭 650mm','m',700000],['door.demolition','기존 창호 철거·마감','건',400000],
    ['electric.socket','스위치·콘센트','공급평',18000],['electric.wiring','전기배선','공급평',35000],['electric.light','조명','공급평',30000],
    ['etc.veranda','베란다 도장·타일','건',800000],['etc.molding','몰딩 교체','공급평',25000],['etc.entrance','현관 타일·문','건',1100000],['etc.shoe','현관장','건',650000],['etc.middle','3연동 중문','개',1100000],['etc.heating','보일러·난방','공급평',100000],
    ['kitchen.pt','PT 상판','m',160000],['kitchen.stone','인조대리석 상판','m',280000],['kitchen.hi','하이그로시 도어·장','m',650000],['kitchen.pet','PET 도어·장','m',750000],['kitchen.transfer','열전사 도어·장','m',800000],['kitchen.uv','UV 도장 도어·장','m',1000000],['kitchen.wood','원목 도어·장','m',1400000],
    ['kitchen.wall','주방 벽타일','m',150000],['kitchen.island','아일랜드 식탁','개',650000],['kitchen.fridge','냉장고장','개',450000],['kitchen.tall','키큰장','개',350000],['kitchen.shelf','주방 뒷선반','개',120000],['kitchen.cooktop','쿡탑','개',350000],['kitchen.flap','플랩장','개',150000],
    ['film.molding','천장몰딩 필름','전용평',20000],['film.baseboard','걸레받이 필름','전용평',12000],['film.window','창호 필름','개',180000],['film.door','문·문틀 필름','개',150000],['film.entrance','현관문 필름','개',200000],['film.middle','중문 필름','개',200000],['film.sink','싱크대 문 필름','개',50000],['film.shoe','신발장 필름','m',200000],['film.builtin','붙박이장 필름','m',250000],
    ['tile.kitchen','주방 벽타일','㎡',85000],['tile.entrance','현관 타일','㎡',90000],['tile.balcony','발코니 타일','㎡',85000],['tile.polished','폴리싱 바닥 타일','㎡',65000],['tile.porcelain','포세린 바닥 타일','㎡',75000]
  ].forEach(row => add(...row));

  const defaults = [
    {area:32,unit:'py',residence:'apartment',window:'none',balcony:0,paper:'none',floor:'none',kitchen:'none',bathrooms:0,door:'none',electric:[],etc:[]},
    {area:25,unit:'py',paper:'silk',grade:'normal',ceiling:true,expanded:false},
    {area:25,unit:'py',thickness:'v20',brand:'any',expanded:false,current:'vinyl'},
    {area:25,unit:'py',floor:'engineered',brand:'any',expanded:false,current:'vinyl'},
    {big:1,small:0,type:'tub',tub:'tub',booth:'partition',ceiling:'smcCeil',tile:'both',addons:[]},
    {shape:'straight',length:300,top:'stone',door:'pet',wall:false,addons:[]},
    {area:25,unit:'py',features:['door'],windows:2,doors:3,midDoors:1,sinkDoors:6,shoeWidth:120,builtinWidth:240,brand:'any'},
    {area:25,unit:'py',features:['entrance'],shape:'straight',entrance:'normal',balcony:'normal',floor:'porcelain',expanded:false,current:'vinyl',brand:'any'},
    {features:['room'],rooms:3,midDoors:1,width:300,roomType:'frame',midType:4,foldingType:'folding500',demolition:true}
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  const isOn = (s,key,value) => Array.isArray(s[key]) && s[key].includes(value);
  const selected = (s,key) => Array.isArray(s[key]) ? s[key] : [];
  function calculate(category, state, settings = {}) {
    if (!Number.isInteger(category) || category < 0 || category > 8) throw new Error('계산 종류가 올바르지 않습니다.');
    const s = {...clone(defaults[category]),...state};
    const rows = [], errors = [];
    const number = (key,min,max,label,integer=false) => {
      const raw = s[key];
      const value = raw === '' || raw == null ? NaN : Number(raw);
      if (!Number.isFinite(value) || value<min || value>max || (integer && !Number.isInteger(value))) {
        errors.push(`${label}: ${min}~${max}${integer?' 사이의 정수':' 사이의 숫자'}를 입력해주세요.`); return 0;
      }
      return value;
    };
    const choice = (key,options,label) => { if (!options.includes(s[key])) errors.push(`${label}을 선택해주세요.`); return s[key]; };
    const multi = (key,options,label) => {
      if (!Array.isArray(s[key]) || s[key].some(v=>!options.includes(v))) errors.push(`${label} 선택이 올바르지 않습니다.`);
    };
    const overrides = settings.prices || {};
    const put = (key,qty,factor=1,note='') => {
      if (!(qty>0)) return;
      const p=prices[key];
      if (!p || !Number.isFinite(qty) || !Number.isFinite(factor)) { errors.push('계산 항목이 올바르지 않습니다.'); return; }
      const unitPrice = Object.prototype.hasOwnProperty.call(overrides,key) ? Number(overrides[key]) : p.amount;
      if (!Number.isFinite(unitPrice) || unitPrice<0 || unitPrice>100000000) { errors.push(`${p.label} 단가를 확인해주세요.`); return; }
      rows.push({key,label:p.label,qty,unit:p.unit,unitPrice,factor,note,amount:Math.round(qty*unitPrice*factor)});
    };
    let area=0;
    const needsArea=[0,1,2,3,7].includes(category)||(category===6&&(isOn(s,'features','molding')||isOn(s,'features','baseboard')));
    if (needsArea) {
      choice('unit',['py','sqm'],'면적 단위');
      const raw=number('area',1,s.unit==='sqm'?495.86775:150,'면적');
      area=s.unit==='sqm'?raw/SQM_PER_PYEONG:raw;
      if (area<1 || area>150) errors.push('면적은 1~150평 범위에서 계산할 수 있습니다.');
    }
    const brandFactor = () => { choice('brand',['brand','nonbrand','any'],'브랜드'); return {brand:1.15,nonbrand:0.9,any:1}[s.brand]; };
    const floorArea = () => area*(s.expanded?1.1:1);
    if (category===0) {
      choice('residence',['apartment','villa','house'],'주거 유형');
      choice('window',['none','full','partial','film','folding'],'창호');
      choice('paper',['none','silk','paper','mix'],'도배');
      choice('floor',['none','v20','laminate','engineered','wood','porcelain','marble'],'바닥재');
      choice('kitchen',['none','full','partial'],'주방');
      choice('door',['none','reform','frame'],'도어');
      multi('electric',['socket','wiring','light'],'전기·조명'); multi('etc',['veranda','molding','entrance','shoe','middle','heating'],'기타');
      const factor={apartment:1,villa:1.05,house:1.15}[s.residence];
      const usable=area*0.78; // ponytail: 공급면적의 78%를 전용면적으로 가정. 실측 자료가 있으면 교체.
      const balcony=number('balcony',0,3,'확장 개수',true), bath=number('bathrooms',0,3,'욕실 개수',true);
      if (s.window!=='none') put('window.'+s.window,s.window==='folding'?3:area,factor,s.window==='folding'?'가로 3m 가정':'주거 유형 보정');
      put('balcony.expand',balcony,factor);
      if(s.paper!=='none') put('paper.'+s.paper,usable,factor,'천장 포함 · 공급면적 × 78%');
      if(s.floor!=='none') put('floor.'+s.floor,usable,factor,'공급면적 × 78%');
      if(s.kitchen!=='none') put('kitchen.'+s.kitchen,3,factor,'싱크대 3m 가정');
      put('bath.base',bath,factor); put('bath.tile',bath*20,factor,'욕실당 벽·바닥 20㎡ 가정'); put('bath.smcCeil',bath,factor);
      if(s.door!=='none') put('door.'+s.door,Math.max(2,Math.round(area/10)),factor,'공급평 ÷ 10, 최소 2개');
      selected(s,'electric').forEach(v=>put('electric.'+v,area,factor));
      selected(s,'etc').forEach(v=>put('etc.'+v,['molding','heating'].includes(v)?area:1,factor));
    } else if(category===1) {
      choice('paper',['silk','paper'],'벽지'); choice('grade',['normal','premium'],'벽지 등급');
      put('paper.'+s.paper,floorArea(),(s.grade==='premium'?1.2:1)*(s.ceiling?1:0.75),s.ceiling?'천장 포함':'천장 제외 보정 × 0.75');
    } else if(category===2 || category===3) {
      if(category===2) choice('thickness',['v18','v20','v22'],'장판 두께');
      else choice('floor',['engineered','laminate','wood','ondol'],'마루 종류');
      choice('current',['none','vinyl','wood'],'기존 바닥');
      put('floor.'+(category===2?s.thickness:s.floor),floorArea(),brandFactor(),s.expanded?'확장 면적 보정 × 1.1':'');
      if(s.current!=='none') put('remove.'+s.current,floorArea());
    } else if(category===4) {
      const big=number('big',0,3,'공용 욕실 개수',true), small=number('small',0,3,'소형 욕실 개수',true),count=big+small;
      if(count===0) errors.push('욕실을 1개 이상 선택해주세요.');
      choice('type',['tub','shower','powder'],'욕실 유형'); choice('ceiling',['woodCeil','smcCeil'],'욕실 천장'); choice('tile',['wall','floor','both'],'타일 범위');
      multi('addons',['zendai','cabinet','shelf','fan','bidet'],'욕실 추가 옵션');
      put('bath.base',big+small*0.75,1,'소형 욕실 기본비 × 0.75');
      const wall=big*16+small*10, floor=big*4+small*2.5;
      put('bath.tile',s.tile==='wall'?wall:s.tile==='floor'?floor:wall+floor,1,'공용 20㎡ · 소형 12.5㎡ 가정');
      if(s.type==='tub') { choice('tub',['tub','whirlpool','mobile'],'욕조'); put('bath.'+s.tub,count); }
      if(s.type==='shower') { choice('booth',['partition','swing','booth'],'샤워부스'); put('bath.'+s.booth,count); }
      put('bath.'+s.ceiling,count); selected(s,'addons').forEach(v=>put('bath.'+v,count));
    } else if(category===5) {
      choice('shape',['straight','l','u'],'주방 형태'); choice('top',['pt','stone'],'상판'); choice('door',['hi','pet','transfer','uv','wood'],'주방 도어');
      multi('addons',['island','fridge','tall','shelf','cooktop','flap'],'주방 추가 옵션');
      const length=number('length',100,1500,'싱크대 길이')/100;
      const perimeter=length*{straight:1,l:1.5,u:2}[s.shape]; // ponytail: 가장 긴 면으로 나머지 면을 추정. 실측 각 면 길이로 고도화 가능.
      put('kitchen.'+s.door,perimeter,1,'형태별 총 길이: ㅡ ×1, ㄱ ×1.5, ㄷ ×2'); put('kitchen.'+s.top,perimeter);
      if(s.wall) put('kitchen.wall',perimeter);
      selected(s,'addons').forEach(v=>put('kitchen.'+v,1));
    } else if(category===6) {
      multi('features',['molding','baseboard','window','door','entrance','middle','sink','shoe','builtin'],'필름 시공');
      const factor=brandFactor();
      const counts={window:['windows',20],door:['doors',10],middle:['midDoors',5],sink:['sinkDoors',30]};
      selected(s,'features').forEach(v=>{
        let qty=1;
        if(['molding','baseboard'].includes(v)) qty=area;
        if(counts[v]) qty=number(counts[v][0],1,counts[v][1],prices['film.'+v].label+' 개수',true);
        if(v==='shoe'||v==='builtin') qty=number(v==='shoe'?'shoeWidth':'builtinWidth',10,1500,'가로 길이')/100;
        put('film.'+v,qty,factor);
      });
    } else if(category===7) {
      multi('features',['kitchen','entrance','balcony','floor'],'타일 시공');
      if(isOn(s,'features','kitchen')) {choice('shape',['straight','l','u'],'주방 형태'); put('tile.kitchen',{straight:3,l:4.5,u:6}[s.shape],1,'주방 형태별 3/4.5/6㎡ 가정');}
      if(isOn(s,'features','entrance')) {choice('entrance',['normal','premium'],'현관 타일');put('tile.entrance',Math.max(2,area*0.08),s.entrance==='premium'?1.3:1,'현관 면적 max(2㎡, 전용평 × 0.08)');}
      if(isOn(s,'features','balcony')) {choice('balcony',['normal','premium'],'발코니 타일');put('tile.balcony',area*0.25,s.balcony==='premium'?1.3:1,'발코니 면적 전용평 × 0.25㎡');}
      if(isOn(s,'features','floor')) {
        choice('floor',['polished','porcelain'],'바닥 타일'); choice('current',['vinyl','wood'],'기존 바닥');
        put('tile.'+s.floor,floorArea()*SQM_PER_PYEONG,brandFactor()); put('remove.'+s.current,floorArea());
      }
    } else if(category===8) {
      multi('features',['room','mid','folding'],'도어 시공');
      if(isOn(s,'features','room')) {choice('roomType',['room','frame'],'방문 시공 범위');put('door.'+s.roomType,number('rooms',1,10,'방문 개수',true));}
      if(isOn(s,'features','mid')) {choice('midType',[0,1,2,3,4,5,6,7],'중문 종류');put('door.mid'+s.midType,number('midDoors',1,5,'중문 개수',true));}
      if(isOn(s,'features','folding')) {choice('foldingType',['folding500','folding650'],'폴딩도어 폭');put('door.'+s.foldingType,number('width',50,1500,'폴딩도어 가로 길이')/100);if(s.demolition)put('door.demolition',1);}
    }
    let overhead=Number(settings.overhead??0), reserve=Number(settings.reserve??10);
    if(!Number.isFinite(overhead)||overhead<0||overhead>30) errors.push('현장 관리비는 0~30%로 입력해주세요.');
    if(!Number.isFinite(reserve)||reserve<0||reserve>30) errors.push('예비비는 0~30%로 입력해주세요.');
    if(errors.length) return {valid:false,errors,rows:[],total:0,min:0,max:0,subtotal:0};
    const subtotal=rows.reduce((sum,r)=>sum+r.amount,0);
    const management=Math.round(subtotal*overhead/100);
    const vat=settings.vat===false?0:Math.round((subtotal+management)*0.1);
    const total=subtotal+management+vat;
    const contingency=Math.round(total*reserve/100);
    return {valid:true,errors:[],rows,area,subtotal,management,vat,total,contingency,budget:total+contingency,min:Math.floor(total*0.85/10000)*10000,max:Math.ceil(total*1.15/10000)*10000};
  }
  const api={prices,defaults,SQM_PER_PYEONG,calculate,clone};
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.InteriorCalc=api;
})(typeof window==='object'?window:globalThis);

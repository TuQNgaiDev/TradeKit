'use strict';
const $=id=>document.getElementById(id),C=CoinCore,api=new CoinAPI.FuturesClient(),latest=new CoinAPI.LatestOnly();
const fmt=n=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:Math.abs(n)<1?8:2}):'—';
const date=t=>new Date(t).toLocaleString('vi-VN'),dir=d=>d===1?'Long':d===-1?'Short':'Chưa rõ';
let frame='30m',symbol='SOLUSDT',lastSuccess=0,loading=false,validatedSymbol=null,chartData=null;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{$('message').textContent+=' Không lưu được trên trình duyệt (bộ nhớ đầy hoặc bị tắt).';return false;}}
const WATCH='cl-watch',HISTORY='cl-futures-ema-v2-history';
let watch=read(WATCH,['SOLUSDT','BTCUSDT','ETHUSDT']);
watch=Array.isArray(watch)?[...new Set(watch.filter(s=>typeof s==='string'&&/^[A-Z0-9]{1,26}USDT$/.test(s)))].slice(0,12):[];
let history=read(HISTORY,[]);
history=Array.isArray(history)?history.filter(h=>h&&typeof h.symbol==='string'&&C.FRAMES[h.frame]&&typeof h.label==='string'&&Number.isFinite(h.time)&&Number.isFinite(h.closeTime)).slice(0,20):[];
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function renderWatch(){
  $('watchlist').replaceChildren();watch.forEach(s=>{
    const wrap=node('span',undefined,'watchitem'),b=node('button',s.replace(/USDT$/,'')),remove=node('button','×','remove');
    b.onclick=()=>{$('symbol').value=s;run();};remove.setAttribute('aria-label','Bỏ theo dõi '+s);
    remove.onclick=()=>{watch=watch.filter(x=>x!==s);write(WATCH,watch);renderWatch();};wrap.append(b,remove);$('watchlist').append(wrap);
  });
}
function renderHistory(){
  const el=$('history');if(!el)return;
  el.replaceChildren();history.forEach(h=>{
    const row=node('div',undefined,'historyrow');
    row.append(node('span',h.symbol+' · '+(C.LABELS[h.frame]||h.frame)+' · '+h.label),node('span','Ghi: '+date(h.time)+' · Nến: '+date(h.closeTime)+(h.signalTime?' · Nến phát tín hiệu: '+date(h.signalTime):'')));
    el.append(row);
  });if(!history.length)el.textContent='Chưa có lịch sử Futures/EMA. Lịch sử phiên bản trước được giữ riêng.';
}
function clearCurrent(){
  lastSuccess=0;validatedSymbol=null;chartData=null;
  ['price','last-price','mark-price'].forEach(id=>$(id).textContent='—');
  ['closed-time','last-time','mark-time','updated'].forEach(id=>$(id).textContent='Chưa có dữ liệu');
  $('verdict').textContent='Chờ dữ liệu';$('verdict').className='';$('direction').textContent='Hướng quan sát: —';$('direction').className='direction';$('signalicon').textContent='—';$('signalicon').className='signalicon';
  $('explanation').textContent='Cần dữ liệu hợp lệ để đánh giá.';$('trade-plan').hidden=true;['plan-entry','plan-stop','plan-tp1','plan-tp2'].forEach(id=>$(id).textContent='—');
  $('indicator-balance').hidden=true;['long-bar','neutral-bar','short-bar'].forEach(id=>$(id).style.width='0%');
  $('timeframe-confluence').hidden=true;$('confluence-frames').replaceChildren();$('confluence-state').textContent='— Chưa rõ';$('confluence-state').className='status miss';
  ['conditions','ema-values'].forEach(id=>$(id).replaceChildren());$('chart').replaceChildren();$('methods').textContent='Chưa có dữ liệu';
  $('range').textContent='120 nến gần nhất';
}
function draw(data){
  chartData=data;const narrow=window.innerWidth<=650,viewWidth=narrow?520:900,edge=viewWidth-(narrow?54:48);
  $('chart').setAttribute('viewBox','0 0 '+viewWidth+' 330');
  const lines=[data.closes,data.e20,data.e50,data.e100].map((a,k)=>({values:a.slice(-120),color:['#77e2b8','#e0bb70','#7da9ec','#b79beb'][k],width:k?1.8:2.6,extra:false}));
  const values=lines.flatMap(l=>l.values).filter(Number.isFinite),min=Math.min(...values),max=Math.max(...values),pad=(max-min)*.12||max*.01||1,lo=min-pad,hi=max+pad;
  const x=i=>12+i*(edge-20)/119,y=v=>290-(v-lo)/(hi-lo)*270;
  let svg='<title>Giá đóng và EMA20–50–100 · '+symbol+' · '+C.LABELS[frame]+'</title>';
  svg+='<defs><linearGradient id="priceGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#77e2b8" stop-opacity="0.18"/><stop offset="100%" stop-color="#77e2b8" stop-opacity="0"/></linearGradient></defs>';
  for(let j=0;j<5;j++){
    const v=lo+(hi-lo)*j/4,yy=y(v);
    svg+='<line x1="10" x2="'+edge+'" y1="'+yy+'" y2="'+yy+'" stroke="#1f2830" stroke-dasharray="4 6"/><text x="'+(edge+10)+'" y="'+(yy+4)+'" fill="#718290" font-size="11" font-family="inherit">'+fmt(v)+'</text>';
  }
  const closePoints=[];
  lines[0].values.forEach((v,i)=>{if(Number.isFinite(v))closePoints.push(x(i)+','+y(v));});
  if(closePoints.length){
    const areaPoints=[x(0)+','+290,...closePoints,x(closePoints.length-1)+','+290].join(' ');
    svg+='<polygon points="'+areaPoints+'" fill="url(#priceGlow)"/>';
  }
  let lastX=null,lastY=null;
  lines.forEach((line,idx)=>{
    let points=[];
    const flush=()=>{if(points.length)svg+='<polyline points="'+points.join(' ')+'" fill="none" stroke="'+line.color+'" stroke-width="'+line.width+'" stroke-linecap="round" stroke-linejoin="round"/>';points=[];};
    line.values.forEach((v,i)=>{
      if(!Number.isFinite(v)){flush();return;}
      const px=x(i),py=y(v);
      if(idx===0){lastX=px;lastY=py;}
      points.push(px+','+py);
    });flush();
  });
  if(lastX!==null&&lastY!==null){
    svg+='<circle cx="'+lastX+'" cy="'+lastY+'" r="3.5" fill="#77e2b8"/>';
    svg+='<circle cx="'+lastX+'" cy="'+lastY+'" r="7" fill="none" stroke="#77e2b8" stroke-width="1.5" opacity="0.45"/>';
  }
  $('chart').innerHTML=svg;$('range').textContent=date(data.rows.at(-120).time)+' → '+date(data.rows.at(-1).closeTime);
}
function emaDirections(result){
  const d=result.direction;
  return [result.order,result.slope,d,result.pullbackIndex!==null?d:0,result.candidate?d:0,result.other?.direction||0];
}
function renderMethods(data,extra,ema,higher){
  const cards=CoinMethods.summarize(data.rows,extra,{higher});
  const directions=[...cards.map(card=>card.direction),...ema],total=directions.length,long=directions.filter(direction=>direction===1).length,short=directions.filter(direction=>direction===-1).length,neutral=total-long-short;
  const percent=value=>total?Math.round(value/total*100):0,longPct=percent(long),shortPct=percent(short),neutralPct=100-longPct-shortPct;
  const balance=$('indicator-balance');balance.hidden=false;balance.dataset.total=String(total);balance.dataset.long=String(long);balance.dataset.short=String(short);balance.dataset.neutral=String(neutral);
  $('long-percent').textContent=longPct+'%';$('short-percent').textContent=shortPct+'%';$('long-count').textContent=long+' trên '+total;$('short-count').textContent=short+' trên '+total;$('neutral-count').textContent='Chưa rõ · '+neutral+'/'+total+' · '+neutralPct+'%';
  balance.classList.toggle('long-leading',long>short);balance.classList.toggle('short-leading',short>long);balance.setAttribute('aria-label','Phân bổ '+longPct+'% Long, '+shortPct+'% Short, '+neutralPct+'% chưa rõ trên '+total+' góc nhìn');
  $('long-bar').style.width=longPct+'%';$('short-bar').style.width=shortPct+'%';$('neutral-bar').style.width=neutralPct+'%';
  const groups=Object.entries(CoinMethods.GROUPS).map(([key,label])=>{
    const items=cards.filter(card=>card.group===key),section=node('section',undefined,'method-group'),head=node('div',undefined,'method-group-head'),grid=node('div',undefined,'methods-grid');
    head.append(node('h3',label),node('span',items.length+' phương pháp'));
    grid.append(...items.map(card=>{
      const article=node('article',undefined,'method-card'),heading=node('div',undefined,'method-heading');
      const direction=card.direction===1?'↗ Xu hướng tăng':card.direction===-1?'↘ Xu hướng giảm':'— Chưa rõ';
      heading.append(node('h3',card.title),node('span',direction,'method-state '+(card.direction===1?'bull':card.direction===-1?'bear':'miss')));
      article.dataset.method=card.id;article.append(heading);return article;
    }));section.append(head,grid);return section;
  });
  $('methods').replaceChildren(...groups);
}
function emaTrendItem(title,direction){
  const el=node('article',undefined,'condition'),head=node('div',undefined,'condition-head');
  const label=direction===1?'↗ Xu hướng tăng':direction===-1?'↘ Xu hướng giảm':'— Chưa rõ';
  head.append(node('h3',title),node('span',label,'status '+(direction===1?'bull':direction===-1?'bear':'miss')));
  el.append(head);$('conditions').append(el);
}
function renderTradePlan(data,direction){
  const plan=CoinMethods.riskPlan(data.rows,data.methods,direction);if(!plan){$('trade-plan').hidden=true;return;}
  $('plan-side').textContent=direction===1?'Kịch bản theo xu hướng tăng':'Kịch bản theo xu hướng giảm';
  $('plan-entry').textContent=fmt(plan.entry);$('plan-stop').textContent=fmt(plan.stop);$('plan-tp1').textContent=fmt(plan.tp1);$('plan-tp2').textContent=fmt(plan.tp2);$('trade-plan').hidden=false;
}
function renderConfluence(results){
  const trendLabel=value=>value===1?'Tăng':value===-1?'Giảm':'Chưa rõ';
  const frames=C.TRADE_FRAMES.map(tf=>{
    const item=results[C.DATA_FRAMES.indexOf(tf)];if(item.status!=='fulfilled')return {tf,direction:0,error:true,long:0,short:0,total:0};
    const data=item.value,higherItem=results[C.DATA_FRAMES.indexOf(C.HIGHER[tf])],higher=higherItem?.status==='fulfilled'?higherItem.value:null,cards=CoinMethods.summarize(data.rows,CoinMethods.calculate(data.rows),{higher}),directions=cards.map(card=>card.direction),long=directions.filter(v=>v===1).length,short=directions.filter(v=>v===-1).length,methodDirection=Math.sign(long-short),ema=C.trendAt(data,data.rows.length-1).direction;
    return {tf,long,short,total:cards.length,ema,direction:ema!==0&&ema===methodDirection?ema:0,error:false};
  });
  const long=frames.filter(v=>v.direction===1).length,short=frames.filter(v=>v.direction===-1).length,direction=long>=2?1:short>=2?-1:0,state=$('confluence-state');
  state.textContent=direction===1?'↗ '+long+'/3 khung tăng':direction===-1?'↘ '+short+'/3 khung giảm':'— Chưa đồng thuận';state.className='status '+(direction===1?'bull':direction===-1?'bear':'miss');
  $('confluence-frames').replaceChildren(...frames.map(item=>{
    const card=node('article',undefined,'confluence-card'+(item.tf===frame?' current':'')),head=node('div');head.append(node('strong',C.LABELS[item.tf]),node('span',trendLabel(item.direction),'status '+(item.direction===1?'bull':item.direction===-1?'bear':'miss')));
    card.append(head,node('small',item.error?'Thiếu dữ liệu':'EMA '+trendLabel(item.ema)+' · PP '+item.long+'↑ '+item.short+'↓ / '+item.total));return card;
  }));$('timeframe-confluence').hidden=false;
}
function render(data,comparison,result,snapshot,results){
  const i=data.rows.length-1,r=data.rows[i],d=result.direction;
  const ema=emaDirections(result);data.methods=CoinMethods.calculate(data.rows);renderMethods(data,data.methods,ema,comparison);
  $('price').textContent=fmt(r.close)+' USDT';$('closed-time').textContent='Nến đóng: '+date(r.closeTime);
  $('direction').textContent='Hướng quan sát: '+dir(d);$('direction').className='direction '+(d===1?'bull':d===-1?'bear':'');$('verdict').textContent=d===1?'Xu hướng tăng':d===-1?'Xu hướng giảm':'Chưa có xu hướng rõ';
  $('verdict').className=d===1?'bull':d===-1?'bear':'';$('signalicon').textContent=d===1?'↗':d===-1?'↘':'↔';$('signalicon').className='signalicon '+(d===1?'bull':d===-1?'bear':'');
  $('explanation').textContent=result.current?'Nến đã đóng gần nhất đã xác nhận theo bộ quy tắc EMA.':d===1?'EMA20–50–100 và độ dốc đang ủng hộ hướng tăng; theo dõi nhịp hồi và nến xác nhận.':d===-1?'EMA20–50–100 và độ dốc đang ủng hộ hướng giảm; theo dõi nhịp hồi và nến xác nhận.':'Thứ tự EMA và độ dốc chưa cùng hướng; ưu tiên chờ cấu trúc rõ hơn.';
  $('ema-values').replaceChildren(...[['EMA20',data.e20[i],'gold'],['EMA50',data.e50[i],'blue'],['EMA100',data.e100[i],'purple']].map(([name,value,color])=>node('span',name+' · '+fmt(value),color)));
  ['01 · Thứ tự EMA','02 · Độ dốc 3 nến','03 · EMA đồng hướng','04 · Hồi theo EMA','05 · Nến xác nhận','06 · Khung lớn'].forEach((title,index)=>emaTrendItem(title,ema[index]));
  renderTradePlan(data,d);
  $('updated').textContent='Cập nhật: '+date(Date.now())+' · Máy chủ Binance: '+date(snapshot.serverTime)+' · '+data.rows.length+' nến đã đóng';
  renderConfluence(results);
  draw(data);
}
function quote(result,kind,snapshot){
  const prefix=kind==='mark'?'mark':'last';
  if(result.status==='rejected'){$(prefix+'-time').textContent=result.reason.message;return false;}
  const value=result.value,price=Number(kind==='mark'?value.markPrice:value.price),time=Number(value.time);
  if(value.symbol!==symbol||!Number.isFinite(price)||price<=0||!Number.isSafeInteger(time)||time<snapshot.serverTime-180000||time>snapshot.serverTime+30000){$(prefix+'-time').textContent='Thiếu dữ liệu hoặc giá đã cũ';return false;}
  $(prefix+'-price').textContent=fmt(price)+' USDT';$(prefix+'-time').textContent=date(time);return true;
}
async function run(){
  const isCurrent=latest.begin(),selectedFrame=frame;
  clearCurrent();loading=true;
  let input=$('symbol').value.trim().toUpperCase();
  if(!/^[A-Z0-9]{1,30}$/.test(input)){$('message').textContent='Nhập mã coin gồm chữ hoặc số, ví dụ SOL hoặc SOLUSDT.';$('connection').textContent='● Mã không hợp lệ';loading=false;return;}
  const selectedSymbol=input.endsWith('USDT')?input:input+'USDT';symbol=selectedSymbol;$('symbol').value=symbol;
  $('pair').textContent=symbol.replace(/USDT$/,' / USDT')+' · '+C.LABELS[selectedFrame];
  $('verdict').textContent='Đang tải…';$('message').textContent='Đang kiểm tra hợp đồng và tải nến Binance USDT-M Futures…';$('connection').textContent='● Đang kết nối';
  try{
    const [info,snapshot]=await Promise.all([api.exchange(),api.time()]);if(!isCurrent())return;
    api.validateSymbol(info,selectedSymbol);
    const keys=C.DATA_FRAMES;
    const results=await Promise.allSettled([...keys.map(async tf=>C.indicators(C.closedRows(await api.klines(selectedSymbol,tf),tf,snapshot.serverTime))),api.ticker(selectedSymbol),api.mark(selectedSymbol)]);
    if(!isCurrent())return;
    if(performance.now()-snapshot.receivedAt>180000)throw Error('Dữ liệu tải quá 3 phút, cần cập nhật lại.');
    const main=results[keys.indexOf(selectedFrame)];if(main.status==='rejected')throw main.reason;
    const other=results[keys.indexOf(C.HIGHER[selectedFrame])],comparison=other.status==='fulfilled'?other.value:null;
    const result=C.evaluate(main.value,comparison,selectedFrame);
    render(main.value,comparison,result,snapshot,results);
    const lastOK=quote(results[4],'last',snapshot),markOK=quote(results[5],'mark',snapshot);
    lastSuccess=performance.now();validatedSymbol=selectedSymbol;
    const partial=results.slice(0,4).some(x=>x.status==='rejected')||!lastOK||!markOK;
    $('connection').textContent=partial?'● Kết nối một phần':'● Đã cập nhật Futures';
    $('message').textContent=partial?'Một số dữ liệu chưa tải được hoặc đã cũ; xem trạng thái từng mục.':'';
    const item={symbol:selectedSymbol,frame:selectedFrame,label:result.direction===1?'Xu hướng tăng':result.direction===-1?'Xu hướng giảm':'Chưa rõ',time:Date.now(),closeTime:main.value.rows.at(-1).closeTime,signalTime:result.signal?.time??null,reference:result.signal?.price??null};
    if(!history[0]||['symbol','frame','label','closeTime'].some(k=>history[0][k]!==item[k])){history.unshift(item);history=history.slice(0,20);write(HISTORY,history);}
    renderHistory();
  }catch(e){
    if(!isCurrent())return;clearCurrent();$('verdict').textContent='Chờ dữ liệu';$('connection').textContent='● Chưa có dữ liệu hợp lệ';
    $('message').textContent=e.message+' Không dùng dữ liệu Spot thay thế, không tạo dữ liệu giả.';
  }finally{if(isCurrent())loading=false;}
}
$('search').onsubmit=e=>{e.preventDefault();run();};$('refresh').onclick=run;
$('frames').onclick=e=>{const b=e.target.closest('[data-frame]');if(!b)return;if(!C.TRADE_FRAMES.includes(b.dataset.frame))return;frame=b.dataset.frame;document.querySelectorAll('[data-frame]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});run();};
$('save').onclick=()=>{
  if(!validatedSymbol){$('message').textContent='Cần tải và kiểm tra hợp đồng hợp lệ trước khi lưu coin.';return;}
  if(!watch.includes(validatedSymbol)){watch=[validatedSymbol,...watch].slice(0,12);write(WATCH,watch);renderWatch();}
};
setInterval(()=>{if(!document.hidden&&!loading)run();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!loading)run();});
setInterval(()=>{if(lastSuccess&&performance.now()-lastSuccess>180000){clearCurrent();$('connection').textContent='● Dữ liệu đã cũ';$('verdict').textContent='Chờ dữ liệu mới';$('message').textContent='Bản tải đã quá 3 phút. Làm mới để đánh giá lại; xác nhận trước đã hết hiệu lực.';}},5000);
renderWatch();renderHistory();run();

let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(chartData)draw(chartData);},80);});

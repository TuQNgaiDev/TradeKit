/* Supplemental analysis from closed trade candles only. Never decides the EMA signal. */
(function(root){
'use strict';
const DAY=86400000;
const SOURCES={
  rsi:'https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/',
  adx:'https://www.tradingview.com/support/solutions/43000589099-average-directional-index-adx/',
  bb:'https://www.tradingview.com/support/solutions/43000501840-bollinger-bands-bb/',
  channel:'https://www.tradingview.com/support/solutions/43000502253-donchian-channels-dc/',
  vwap:'https://www.tradingview.com/support/solutions/43000502018-volume-weighted-average-price-vwap/',
  atr:'https://www.tradingview.com/support/solutions/43000501823-average-true-range-atr/',
  supertrend:'https://www.tradingview.com/support/solutions/43000634738-supertrend/',
  ichimoku:'https://www.tradingview.com/support/solutions/43000589152-ichimoku-cloud/',
  stochastic:'https://www.tradingview.com/support/solutions/43000502332-stochastic-stoch/',
  cci:'https://www.tradingview.com/support/solutions/43000502001-commodity-channel-index-cci/',
  macd:'https://www.tradingview.com/support/solutions/43000502344-macd-moving-average-convergence-divergence/',
  momentum:'https://www.tradingview.com/support/solutions/43000614331-technical-ratings/',
  aroon:'https://www.tradingview.com/support/solutions/43000501801-aroon-indicator/',
  roc:'https://www.tradingview.com/support/solutions/43000502343-rate-of-change-roc/',
  williams:'https://www.tradingview.com/support/solutions/43000501985-williams-r-r/',
  mfi:'https://www.tradingview.com/support/solutions/43000502348-money-flow-mfi/',
  obv:'https://www.tradingview.com/support/solutions/43000502593-on-balance-volume-obv/',
  chaikin:'https://www.tradingview.com/support/solutions/43000501979-chaikin-oscillator/',
  awesome:'https://www.tradingview.com/support/solutions/43000614331-technical-ratings/',
  stochrsi:'https://www.tradingview.com/support/solutions/43000614331-technical-ratings/',
  bullbear:'https://www.tradingview.com/support/solutions/43000717955-bull-bear-power/',
  ultimate:'https://www.tradingview.com/support/solutions/43000502328-ultimate-oscillator-uo/'
};
const GROUPS={trend:'Xu hướng & cấu trúc',momentum:'Động lượng',volume:'Dòng tiền & khối lượng',volatility:'Biến động',patterns:'Mô hình 3-EMA'};
const METHOD_GROUP={adx:'trend',channel:'trend',supertrend:'trend',ichimoku:'trend',aroon:'trend',bullbear:'trend',rsi:'momentum',stochastic:'momentum',cci:'momentum',macd:'momentum',momentum:'momentum',roc:'momentum',williams:'momentum',awesome:'momentum',stochrsi:'momentum',ultimate:'momentum',vwap:'volume',mfi:'volume',obv:'volume',chaikin:'volume',bb:'volatility',atr:'volatility',ema100retest:'patterns',htfrejection:'patterns',emasqueeze:'patterns',hiddendiv:'patterns',liquiditysweep:'patterns',rubberband:'patterns',doubletest:'patterns',trendsurf:'patterns'};
const LOCAL_SOURCE='Tài liệu đặc tả 3-EMA do người dùng cung cấp';
// Wilder: SMA seed of N consecutive finite samples; alpha = 1/N thereafter.
function rma(values,period){
  if(!Number.isInteger(period)||period<1)throw Error('Chu kỳ Wilder không hợp lệ');
  const out=Array(values.length).fill(null);let sum=0,count=0,previous=null;
  for(let i=0;i<values.length;i++){
    const v=values[i];
    if(!Number.isFinite(v)){sum=0;count=0;previous=null;continue;}
    if(previous===null){sum+=v;count++;if(count===period)out[i]=previous=sum/period;}
    else out[i]=previous=(previous*(period-1)+v)/period;
  }return out;
}
function rsi(closes,period=14){
  const gains=[null],losses=[null];
  for(let i=1;i<closes.length;i++){const delta=closes[i]-closes[i-1];gains.push(Math.max(delta,0));losses.push(Math.max(-delta,0));}
  const gain=rma(gains,period),loss=rma(losses,period);
  return closes.map((_,i)=>gain[i]===null?null:gain[i]===0&&loss[i]===0?50:loss[i]===0?100:100-100/(1+gain[i]/loss[i]));
}
function directional(rows,period=14){
  const tr=[],plus=[null],minus=[null];
  rows.forEach((r,i)=>{
    tr.push(i?Math.max(r.high-r.low,Math.abs(r.high-rows[i-1].close),Math.abs(r.low-rows[i-1].close)):r.high-r.low);
    if(i){const up=r.high-rows[i-1].high,down=rows[i-1].low-r.low;plus.push(up>0&&up>down?up:0);minus.push(down>0&&down>up?down:0);}
  });
  const atr=rma(tr,period),dmTR=rma([null,...tr.slice(1)],period),p=rma(plus,period),m=rma(minus,period);
  const plusDI=rows.map((_,i)=>p[i]===null?null:dmTR[i]===0?0:100*p[i]/dmTR[i]);
  const minusDI=rows.map((_,i)=>m[i]===null?null:dmTR[i]===0?0:100*m[i]/dmTR[i]);
  const dx=plusDI.map((v,i)=>v===null?null:v+minusDI[i]===0?0:100*Math.abs(v-minusDI[i])/(v+minusDI[i]));
  return {tr,atr,plusDI,minusDI,adx:rma(dx,period)};
}
function bollinger(closes,period=20,multiplier=2){
  const middle=[],upper=[],lower=[],width=[],percentB=[];
  for(let i=0;i<closes.length;i++){
    if(i<period-1){[middle,upper,lower,width,percentB].forEach(a=>a.push(null));continue;}
    const window=closes.slice(i-period+1,i+1),mean=window.reduce((s,v)=>s+v,0)/period;
    const deviation=Math.sqrt(window.reduce((s,v)=>s+(v-mean)**2,0)/period),u=mean+multiplier*deviation,l=mean-multiplier*deviation;
    middle.push(mean);upper.push(u);lower.push(l);width.push(mean===0?null:100*(u-l)/Math.abs(mean));percentB.push(u===l?null:(closes[i]-l)/(u-l));
  }return {middle,upper,lower,width,percentB};
}
// Exclude candle t so a close beyond the prior range can actually be detected.
function donchian(rows,period=20){
  const upper=[],lower=[],middle=[];
  rows.forEach((_,i)=>{
    if(i<period){upper.push(null);lower.push(null);middle.push(null);return;}
    const previous=rows.slice(i-period,i),u=Math.max(...previous.map(r=>r.high)),l=Math.min(...previous.map(r=>r.low));
    upper.push(u);lower.push(l);middle.push((u+l)/2);
  });return {upper,lower,middle};
}
function sessionVWAP(rows){
  const values=[],sessions=[],counts=[];let session=null,complete=false,total=0,volume=0,count=0;
  rows.forEach(r=>{
    const start=Math.floor(r.time/DAY)*DAY;
    if(start!==session){session=start;complete=r.time===start;total=0;volume=0;count=0;}
    total+=(r.high+r.low+r.close)/3*r.volume;volume+=r.volume;count++;
    // Refuse a truncated first UTC session; never label a partial anchor as full VWAP.
    values.push(complete&&volume>0?total/volume:null);sessions.push(start);counts.push(count);
  });return {values,sessions,counts};
}
function sma(values,period){
  const out=Array(values.length).fill(null);
  for(let i=period-1;i<values.length;i++){
    const window=values.slice(i-period+1,i+1);if(window.every(Number.isFinite))out[i]=window.reduce((s,v)=>s+v,0)/period;
  }return out;
}
function emaSeries(values,period){
  const out=Array(values.length).fill(null);let sum=0,seeded=false,previous=null;
  for(let i=0;i<values.length;i++){
    const v=values[i];if(!Number.isFinite(v)){if(!seeded)sum=0;continue;}
    if(!seeded){sum+=v;const valid=values.slice(0,i+1).filter(Number.isFinite);if(valid.length===period){previous=sum/period;out[i]=previous;seeded=true;}}
    else out[i]=previous=(2/(period+1))*v+(1-2/(period+1))*previous;
  }return out;
}
function supertrend(rows,period=10,multiplier=3){
  const atr=directional(rows,period).atr,upper=Array(rows.length).fill(null),lower=Array(rows.length).fill(null),line=Array(rows.length).fill(null),direction=Array(rows.length).fill(0);
  rows.forEach((r,i)=>{
    if(!Number.isFinite(atr[i]))return;
    const hl2=(r.high+r.low)/2,basicUpper=hl2+multiplier*atr[i],basicLower=hl2-multiplier*atr[i];
    if(i===0||!Number.isFinite(upper[i-1])){upper[i]=basicUpper;lower[i]=basicLower;direction[i]=-1;line[i]=upper[i];return;}
    upper[i]=basicUpper<upper[i-1]||rows[i-1].close>upper[i-1]?basicUpper:upper[i-1];
    lower[i]=basicLower>lower[i-1]||rows[i-1].close<lower[i-1]?basicLower:lower[i-1];
    direction[i]=line[i-1]===upper[i-1]?(r.close>upper[i]?1:-1):(r.close<lower[i]?-1:1);
    line[i]=direction[i]===1?lower[i]:upper[i];
  });return {atr,upper,lower,line,direction};
}
function midpoint(rows,i,period){
  if(i<period-1)return null;const window=rows.slice(i-period+1,i+1);return (Math.max(...window.map(r=>r.high))+Math.min(...window.map(r=>r.low)))/2;
}
function ichimoku(rows){
  const conversion=[],base=[],spanA=[],spanB=[],direction=[];
  rows.forEach((r,i)=>{
    conversion.push(midpoint(rows,i,9));base.push(midpoint(rows,i,26));
    const source=i-26,a=source>=0&&Number.isFinite(conversion[source])&&Number.isFinite(base[source])?(conversion[source]+base[source])/2:null,b=source>=0?midpoint(rows,source,52):null;
    spanA.push(a);spanB.push(b);direction.push(!Number.isFinite(a)||!Number.isFinite(b)?0:r.close>Math.max(a,b)&&a>b?1:r.close<Math.min(a,b)&&a<b?-1:0);
  });return {conversion,base,spanA,spanB,direction};
}
function stochastic(rows,period=14,smoothK=3,periodD=3){
  const raw=rows.map((r,i)=>{if(i<period-1)return null;const w=rows.slice(i-period+1,i+1),hi=Math.max(...w.map(x=>x.high)),lo=Math.min(...w.map(x=>x.low));return hi===lo?50:100*(r.close-lo)/(hi-lo);});
  const k=sma(raw,smoothK),d=sma(k,periodD);return {raw,k,d};
}
function cci(rows,period=20){
  const tp=rows.map(r=>(r.high+r.low+r.close)/3),values=Array(rows.length).fill(null);
  for(let i=period-1;i<rows.length;i++){
    const w=tp.slice(i-period+1,i+1),mean=w.reduce((s,v)=>s+v,0)/period,deviation=w.reduce((s,v)=>s+Math.abs(v-mean),0)/period;
    values[i]=deviation===0?0:(tp[i]-mean)/(.015*deviation);
  }return values;
}
function macd(closes){
  const fast=emaSeries(closes,12),slow=emaSeries(closes,26),line=closes.map((_,i)=>Number.isFinite(slow[i])?fast[i]-slow[i]:null),signal=emaSeries(line,9);return {line,signal};
}
function momentum(closes,period=10){return closes.map((v,i)=>i<period?null:v-closes[i-period]);}
function aroon(rows,period=14){
  const up=Array(rows.length).fill(null),down=Array(rows.length).fill(null);
  for(let i=period-1;i<rows.length;i++){
    const window=rows.slice(i-period+1,i+1),highs=window.map(r=>r.high),lows=window.map(r=>r.low);
    up[i]=100*highs.lastIndexOf(Math.max(...highs))/(period-1);down[i]=100*lows.lastIndexOf(Math.min(...lows))/(period-1);
  }return {up,down};
}
function roc(closes,period=9){return closes.map((v,i)=>i<period||closes[i-period]===0?null:100*(v-closes[i-period])/closes[i-period]);}
function williams(rows,period=14){return rows.map((r,i)=>{if(i<period-1)return null;const w=rows.slice(i-period+1,i+1),hi=Math.max(...w.map(x=>x.high)),lo=Math.min(...w.map(x=>x.low));return hi===lo?-50:-100*(hi-r.close)/(hi-lo);});}
function mfi(rows,period=14){
  const tp=rows.map(r=>(r.high+r.low+r.close)/3),flow=rows.map((r,i)=>tp[i]*r.volume),out=Array(rows.length).fill(null);
  for(let i=period;i<rows.length;i++){
    let positive=0,negative=0;for(let j=i-period+1;j<=i;j++){if(tp[j]>tp[j-1])positive+=flow[j];else if(tp[j]<tp[j-1])negative+=flow[j];}
    out[i]=negative===0?positive>0?100:50:100-100/(1+positive/negative);
  }return out;
}
function obv(rows){const out=[0];for(let i=1;i<rows.length;i++)out.push(out[i-1]+Math.sign(rows[i].close-rows[i-1].close)*rows[i].volume);return out;}
function chaikin(rows){
  let adl=0;const line=rows.map(r=>{const range=r.high-r.low,multiplier=range===0?0:((r.close-r.low)-(r.high-r.close))/range;return adl+=multiplier*r.volume;});
  const fast=emaSeries(line,3),slow=emaSeries(line,10);return line.map((_,i)=>Number.isFinite(slow[i])?fast[i]-slow[i]:null);
}
function awesome(rows){const median=rows.map(r=>(r.high+r.low)/2),fast=sma(median,5),slow=sma(median,34);return rows.map((_,i)=>Number.isFinite(slow[i])?fast[i]-slow[i]:null);}
function stochasticRsi(closes,rsiPeriod=14,stochPeriod=14,smoothK=3,smoothD=3){
  const base=rsi(closes,rsiPeriod),raw=base.map((v,i)=>{if(i<rsiPeriod+stochPeriod-1||!Number.isFinite(v))return null;const w=base.slice(i-stochPeriod+1,i+1);if(!w.every(Number.isFinite))return null;const hi=Math.max(...w),lo=Math.min(...w);return hi===lo?50:100*(v-lo)/(hi-lo);});
  const k=sma(raw,smoothK),d=sma(k,smoothD);return {raw,k,d};
}
function bullBear(rows,period=13){const baseline=emaSeries(rows.map(r=>r.close),period),bull=rows.map((r,i)=>Number.isFinite(baseline[i])?r.high-baseline[i]:null),bear=rows.map((r,i)=>Number.isFinite(baseline[i])?r.low-baseline[i]:null);return {baseline,bull,bear};}
function ultimate(rows){
  const bp=[],tr=[],out=Array(rows.length).fill(null);rows.forEach((r,i)=>{const prior=i?rows[i-1].close:r.close,low=Math.min(r.low,prior),high=Math.max(r.high,prior);bp.push(r.close-low);tr.push(high-low);});
  const ratio=(i,n)=>{const trSum=tr.slice(i-n+1,i+1).reduce((a,b)=>a+b,0);return trSum?bp.slice(i-n+1,i+1).reduce((a,b)=>a+b,0)/trSum:.5;};
  for(let i=27;i<rows.length;i++){const a=ratio(i,7),b=ratio(i,14),c=ratio(i,28);if([a,b,c].every(Number.isFinite))out[i]=100*(4*a+2*b+c)/7;}return out;
}
function calculate(rows){
  const closes=rows.map(r=>r.close);
  return {rsi:rsi(closes),...directional(rows),bb:bollinger(closes),channel:donchian(rows),vwap:sessionVWAP(rows),supertrend:supertrend(rows),ichimoku:ichimoku(rows),stochastic:stochastic(rows),cci:cci(rows),macd:macd(closes),momentum:momentum(closes),aroon:aroon(rows),roc:roc(closes),williams:williams(rows),mfi:mfi(rows),obv:obv(rows),chaikin:chaikin(rows),awesome:awesome(rows),stochrsi:stochasticRsi(closes),bullbear:bullBear(rows),ultimate:ultimate(rows),e20:emaSeries(closes,20),e50:emaSeries(closes,50),e100:emaSeries(closes,100)};
}
function riskPlan(rows,data,direction){
  const i=rows.length-1,entry=rows[i]?.close,atr=data?.atr?.[i];if(![1,-1].includes(direction)||!Number.isFinite(entry)||!Number.isFinite(atr)||atr<=0)return null;
  const recent=rows.slice(-4),base=direction===1?Math.min(...recent.map(x=>x.low),data.e50[i]):Math.max(...recent.map(x=>x.high),data.e50[i]),stop=base-direction*.5*atr,risk=direction*(entry-stop);
  return Number.isFinite(risk)&&risk>0?{entry,stop,tp1:entry+direction*1.3*risk,tp2:entry+direction*2.2*risk,risk,atr}:null;
}
const average=a=>a.length&&a.every(Number.isFinite)?a.reduce((s,v)=>s+v,0)/a.length:null;
const number=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:Math.abs(v)<1?4:2}):'—';
function summarize(rows,data,context={}){
  const i=rows.length-1,r=rows[i],cards=[];
  if(!r)return cards;
  function add(id,title,state,direction,metrics,meaning,rule,limit){
    cards.push({id,title,state,direction,group:METHOD_GROUP[id],metrics,meaning,rule,limit,source:SOURCES[id]||LOCAL_SOURCE});
  }
  const rv=data.rsi[i];
  add('rsi','RSI · Động lượng',rv===null?'Thiếu dữ liệu':rv>=70?'Quá mua':rv<=30?'Quá bán':rv>50?'Động lượng tăng':rv<50?'Động lượng giảm':'Cân bằng',rv===null?0:Math.sign(rv-50),
    [['RSI(14)',number(rv)]],rv===null?'Chưa có đủ 14 biến động giá đóng.':rv>=70||rv<=30?'Vùng cực trị động lượng; không tự suy ra giá sắp đảo chiều.':'So sánh sức tăng và giảm của giá đóng; mốc 50 phân chia động lượng.',
    'RSI = 100 − 100/(1 + RMA14(lãi)/RMA14(lỗ)); ngưỡng 30 / 50 / 70.',
    'Có thể nằm ở vùng quá mua/quá bán nhiều nến khi xu hướng mạnh.');
  const adx=data.adx[i],p=data.plusDI[i],m=data.minusDI[i],bias=Number.isFinite(p)&&Number.isFinite(m)?Math.sign(p-m):0;
  add('adx','ADX / DMI · Sức xu hướng',adx===null?'Thiếu dữ liệu':adx>=25?'Xu hướng có độ mạnh':adx<20?'Xu hướng yếu':'Vùng chuyển tiếp',adx!==null&&adx>=25?bias:0,
    [['ADX(14)',number(adx)],['+DI / −DI',number(p)+' / '+number(m)]],
    adx===null?'Chưa đủ chuỗi DX để làm ấm ADX.':'ADX đo độ mạnh, không chỉ hướng. '+(bias>0?'+DI > −DI: chuyển động tăng trội hơn.':bias<0?'−DI > +DI: chuyển động giảm trội hơn.':'Hai phía đang cân bằng.'),
    'Wilder RMA14 của TR và ±DM → ±DI → DX → ADX14. <20 yếu, 20–<25 chuyển tiếp, ≥25 có độ mạnh.',
    'Chỉ báo trễ; DI giao nhau khi ADX thấp dễ nhiễu. Các mốc là quy ước quan sát.');
  const bb=data.bb,u=bb.upper[i],l=bb.lower[i],mid=bb.middle[i],bbDir=Number.isFinite(mid)?Math.sign(r.close-mid):0;
  add('bb','Bollinger · Vị trí trong dải',u===null?'Thiếu dữ liệu':u===l?'Dải không có độ rộng':r.close>u?'Đóng trên dải trên':r.close<l?'Đóng dưới dải dưới':'Đóng trong dải',bbDir,
    [['Dưới / Giữa / Trên',number(l)+' / '+number(mid)+' / '+number(u)],['Độ rộng / %B',number(bb.width[i])+'% / '+number(bb.percentB[i])]],
    'Đọc vị trí giá đóng so với dải biến động. %B = 0 ở dải dưới, 1 ở dải trên; ngoài [0,1] là ngoài dải.',
    'SMA20(Close) ± 2σ; σ tổng thể chia cho 20. Độ rộng = (trên − dưới)/giữa × 100.',
    'Đóng ngoài dải không mặc định là đảo chiều; %B không xác định khi hai dải trùng nhau.');
  const ch=data.channel,cu=ch.upper[i],cl=ch.lower[i],breakout=cu===null?0:r.close>cu?1:r.close<cl?-1:0;
  add('channel','Donchian · Hỗ trợ / kháng cự',cu===null?'Thiếu dữ liệu':breakout===1?'Đóng phá đỉnh 20 nến':breakout===-1?'Đóng phá đáy 20 nến':'Chưa phá kênh',breakout,
    [['Hỗ trợ / Kháng cự',number(cl)+' / '+number(cu)],['Giá đóng',number(r.close)]],
    'So giá đóng với đỉnh/đáy của 20 nến trước. Chỉ râu nến xuyên vùng chưa được tính là đóng phá kênh.',
    'Đỉnh = max(High[t−20…t−1]); đáy = min(Low[t−20…t−1]); Close phải vượt nghiêm ngặt.',
    'Đây là mức tham chiếu động, không phải vùng hỗ trợ chắc chắn; phá vỡ có thể thất bại.');
  const vw=data.vwap.values[i],vwDir=vw===null?0:Math.sign(r.close-vw),session=data.vwap.sessions[i];
  add('vwap','VWAP · Giá theo khối lượng',vw===null?'Chưa đủ phiên / volume':vwDir>0?'Đóng trên VWAP':vwDir<0?'Đóng dưới VWAP':'Đóng tại VWAP',vwDir,
    [['VWAP ngày UTC',number(vw)],['Lệch giá đóng',vw===null?'—':number(100*(r.close/vw-1))+'%'],['Nến trong phiên',String(data.vwap.counts[i])]],
    'Phiên từ '+new Date(session).toISOString().slice(0,10)+' 00:00 UTC (07:00 Việt Nam). Dùng các nến đã đóng trong phiên đó.',
    'Σ[((High + Low + Close)/3) × Volume] / ΣVolume; đặt lại tại 00:00 UTC.',
    'Xấp xỉ theo HLC3 và volume nến, không phải VWAP từng giao dịch. Đầu phiên ít nến; phiên thiếu đầu hoặc tổng volume 0 không có giá trị.');
  const atr=data.atr[i],prior=average(data.atr.slice(Math.max(0,i-20),i)),ratio=prior>0?atr/prior:null;
  add('atr','ATR · Biến động',atr===null?'Thiếu dữ liệu':ratio===null?'Chưa có mốc so sánh':ratio>=1.2?'Biến động mở rộng':ratio<=.8?'Biến động thu hẹp':'Biến động gần nền',0,
    [['ATR(14) / ATR%',number(atr)+' / '+number(atr===null?null:100*atr/r.close)+'%'],['So TB20 ATR trước',ratio===null?'—':number(ratio)+'×']],
    'Ước lượng biên độ biến động, không chỉ hướng Long/Short và không phải dự báo giá đi được bao xa.',
    'TR = max(H−L, |H−Close trước|, |L−Close trước|); ATR = RMA14(TR). Tỷ số so với TB20 ATR trước: ≥1,2× mở rộng, ≤0,8× thu hẹp.',
    'Ngưỡng tỷ số là quy tắc riêng của công cụ, chưa kiểm định. Không dùng để tự đặt đòn bẩy, stop hay lợi nhuận.');
  const st=data.supertrend,stDir=st.direction[i]||0;
  add('supertrend','Supertrend · ATR 10×3',stDir===1?'Giá trên Supertrend':stDir===-1?'Giá dưới Supertrend':'Thiếu dữ liệu',stDir,[['Supertrend',number(st.line[i])]],'Theo dõi xu hướng bằng dải ATR.','ATR10 Wilder, hệ số 3; hướng đổi khi giá đóng vượt dải cuối.','Có thể đảo hướng liên tục khi thị trường đi ngang.');
  const ichi=data.ichimoku,ichiDir=ichi.direction[i]||0;
  add('ichimoku','Ichimoku · Mây 9–26–52',ichiDir===1?'Giá trên mây tăng':ichiDir===-1?'Giá dưới mây giảm':'Trong mây / chưa đồng thuận',ichiDir,[['Span A / B',number(ichi.spanA[i])+' / '+number(ichi.spanB[i])]],'So giá đóng với mây được dịch 26 nến.','Tăng khi giá trên mây và Span A > Span B; giảm khi điều kiện đảo lại.','Dữ liệu lịch sử, không dự đoán tương lai.');
  const sto=data.stochastic,k=sto.k[i],sd=sto.d[i],stoDir=!Number.isFinite(k)||!Number.isFinite(sd)?0:k<20&&sd<20&&k>sd?1:k>80&&sd>80&&k<sd?-1:0;
  add('stochastic','Stochastic · 14–3–3',stoDir===1?'Tín hiệu tăng vùng thấp':stoDir===-1?'Tín hiệu giảm vùng cao':'Chưa rõ',stoDir,[['%K / %D',number(k)+' / '+number(sd)]],'Đọc vị trí giá đóng trong biên 14 nến.','Theo Technical Ratings: K,D <20 và K>D là tăng; K,D >80 và K<D là giảm.','Có thể nhiễu khi ngược xu hướng chính.');
  const cv=data.cci[i],prevCci=data.cci[i-1],cciDir=!Number.isFinite(cv)||!Number.isFinite(prevCci)?0:cv<-100&&cv>prevCci?1:cv>100&&cv<prevCci?-1:0;
  add('cci','CCI · Chu kỳ 20',cciDir===1?'CCI hồi lên dưới −100':cciDir===-1?'CCI quay xuống trên 100':'Chưa rõ',cciDir,[['CCI(20)',number(cv)]],'Đo độ lệch typical price khỏi trung bình.','Theo Technical Ratings: dưới −100 và tăng là tăng; trên 100 và giảm là giảm.','Ngưỡng cực trị có thể khác theo tài sản.');
  const ml=data.macd.line[i],ms=data.macd.signal[i],macdDir=!Number.isFinite(ml)||!Number.isFinite(ms)?0:Math.sign(ml-ms);
  add('macd','MACD · 12–26–9',macdDir>0?'MACD trên tín hiệu':macdDir<0?'MACD dưới tín hiệu':'Chưa rõ',macdDir,[['MACD / Signal',number(ml)+' / '+number(ms)]],'So động lượng EMA nhanh và chậm.','MACD > signal là tăng; MACD < signal là giảm.','Chỉ báo trễ và dễ nhiễu khi đi ngang.');
  const mo=data.momentum[i],prevMo=data.momentum[i-1],moDir=!Number.isFinite(mo)||!Number.isFinite(prevMo)?0:Math.sign(mo-prevMo);
  add('momentum','Momentum · Chu kỳ 10',moDir>0?'Động lượng tăng':moDir<0?'Động lượng giảm':'Chưa rõ',moDir,[['Momentum(10)',number(mo)]],'So giá đóng với 10 nến trước và hướng thay đổi của chênh lệch.','Theo Technical Ratings: momentum hiện tại cao hơn trước là tăng, thấp hơn là giảm.','Phản ứng nhanh nhưng có thể đổi hướng thường xuyên.');
  const au=data.aroon.up[i],ad=data.aroon.down[i],aroonDir=!Number.isFinite(au)||!Number.isFinite(ad)?0:au>50&&ad<50?1:ad>50&&au<50?-1:0;
  add('aroon','Aroon · Chu kỳ 14',aroonDir===1?'Đỉnh mới gần hơn':aroonDir===-1?'Đáy mới gần hơn':'Chưa rõ',aroonDir,[['Up / Down',number(au)+' / '+number(ad)]],'Đo độ gần của đỉnh và đáy mới nhất trong cửa sổ 14 nến.','Tăng khi Aroon Up > 50 và Down < 50; giảm khi ngược lại.','Nhạy với đỉnh/đáy mới và có thể đổi nhanh trong vùng nhiễu.');
  const rc=data.roc[i],rocDir=Number.isFinite(rc)?Math.sign(rc):0;
  add('roc','ROC · Chu kỳ 9',rocDir>0?'Giá cao hơn 9 nến trước':rocDir<0?'Giá thấp hơn 9 nến trước':'Chưa rõ',rocDir,[['ROC(9)',number(rc)+'%']],'Đo phần trăm thay đổi giá đóng so với 9 nến trước.','ROC = (Close / Close[t−9] − 1) × 100; dấu quanh 0 xác định hướng.','Không có biên cố định và có thể phản ứng mạnh với điểm so sánh cũ.');
  const wr=data.williams[i],prevWr=data.williams[i-1],wrDir=!Number.isFinite(wr)||!Number.isFinite(prevWr)?0:wr<-80&&wr>prevWr?1:wr>-20&&wr<prevWr?-1:0;
  add('williams','Williams %R · Chu kỳ 14',wrDir>0?'Hồi lên khỏi vùng thấp':wrDir<0?'Quay xuống từ vùng cao':'Chưa rõ',wrDir,[['Williams %R',number(wr)]],'Đặt giá đóng trong biên cao–thấp 14 nến.','Theo Technical Ratings: tăng khi %R < −80 và đi lên; giảm khi %R > −20 và đi xuống.','Quá mua/quá bán có thể kéo dài trong xu hướng mạnh.');
  const mf=data.mfi[i],mfiDir=Number.isFinite(mf)?Math.sign(mf-50):0;
  add('mfi','MFI · Dòng tiền 14',mf===null?'Thiếu dữ liệu':mf>50?'Áp lực mua trội':mf<50?'Áp lực bán trội':'Cân bằng',mfiDir,[['MFI(14)',number(mf)]],'Kết hợp typical price và volume để ước lượng áp lực mua/bán.','Tổng raw money flow dương/âm 14 nến → tỷ lệ → MFI; mốc 50 phân hướng.','Volume nến Futures là dữ liệu tổng hợp; MFI không tự chứng minh dòng tiền thực vào/ra.');
  const ov=data.obv[i],obvDir=i>=3?Math.sign(ov-data.obv[i-3]):0;
  add('obv','OBV · Áp lực khối lượng',obvDir>0?'OBV tăng 3 nến':obvDir<0?'OBV giảm 3 nến':'Chưa rõ',obvDir,[['OBV / chênh 3 nến',number(ov)+' / '+number(i>=3?ov-data.obv[i-3]:null)]],'Cộng volume khi giá đóng tăng và trừ khi giảm.','Hướng dựa trên OBV hiện tại so với 3 nến trước.','Giá trị tuyệt đối phụ thuộc điểm bắt đầu; chỉ dùng độ thay đổi.');
  const co=data.chaikin[i],chaikinDir=Number.isFinite(co)?Math.sign(co):0;
  add('chaikin','Chaikin Oscillator · 3–10',chaikinDir>0?'Áp lực mua trội':chaikinDir<0?'Áp lực bán trội':'Chưa rõ',chaikinDir,[['Chaikin Oscillator',number(co)]],'Đo động lượng của Accumulation/Distribution bằng chênh EMA.','Money Flow Volume tích lũy thành ADL; Chaikin = EMA3(ADL) − EMA10(ADL).','Có thể nhiễu khi volume hoặc vị trí đóng trong nến biến động bất thường.');
  const ao=data.awesome,aoNow=ao[i],aoPrev=ao[i-1],aoOld=ao[i-2],aoDir=!Number.isFinite(aoOld)?0:(aoPrev<=0&&aoNow>0)||(aoNow>0&&aoPrev>0&&aoNow>aoPrev&&aoPrev<aoOld)?1:(aoPrev>=0&&aoNow<0)||(aoNow<0&&aoPrev<0&&aoNow<aoPrev&&aoPrev>aoOld)?-1:0;
  add('awesome','Awesome Oscillator · 5–34',aoDir>0?'Động lượng tăng mới':aoDir<0?'Động lượng giảm mới':'Chưa rõ',aoDir,[['AO',number(aoNow)]],'So SMA5 và SMA34 của giá trung vị High–Low.','Theo Technical Ratings: giao qua 0 hoặc hai nến cùng phía rồi quay lại theo hướng đó.','Chỉ phát hướng ở điểm giao hoặc điểm quay; phần lớn thời gian có thể trung tính.');
  const sr=data.stochrsi,sk=sr.k[i],srd=sr.d[i],ema13=data.bullbear.baseline,emaTrend=Number.isFinite(ema13[i-1])?Math.sign(ema13[i]-ema13[i-1]):0,stochRsiDir=!Number.isFinite(sk)||!Number.isFinite(srd)?0:emaTrend<0&&sk<20&&srd<20&&sk>srd?1:emaTrend>0&&sk>80&&srd>80&&sk<srd?-1:0;
  add('stochrsi','Stochastic RSI · 3–3–14–14',stochRsiDir>0?'Hồi tăng vùng thấp':stochRsiDir<0?'Quay giảm vùng cao':'Chưa rõ',stochRsiDir,[['%K / %D',number(sk)+' / '+number(srd)]],'Đặt RSI14 vào biên RSI 14 nến rồi làm mượt K3 và D3.','Theo Technical Ratings: tín hiệu vùng cực trị phải đi cùng điều kiện xu hướng EMA13.','Nhạy hơn RSI nên dễ tạo nhiễu; vùng cực trị không tự đồng nghĩa đảo chiều.');
  const bbp=data.bullbear,bull=bbp.bull[i],bear=bbp.bear[i],bullBearDir=!Number.isFinite(bull)||!Number.isFinite(bear)||i<1?0:emaTrend>0&&bear<0&&bear>bbp.bear[i-1]?1:emaTrend<0&&bull>0&&bull<bbp.bull[i-1]?-1:0;
  add('bullbear','Bull Bear Power · EMA13',bullBearDir>0?'Bear Power đang cải thiện':bullBearDir<0?'Bull Power đang suy yếu':'Chưa rõ',bullBearDir,[['Bull / Bear',number(bull)+' / '+number(bear)]],'Đo High và Low lệch khỏi EMA13 để đọc sức mua/bán.','Theo Technical Ratings: hướng EMA13, dấu của Bull/Bear Power và thay đổi so với nến trước phải đồng thuận.','Phụ thuộc biên High–Low và có thể trung tính trong phần lớn xu hướng.');
  const uo=data.ultimate[i],ultimateDir=!Number.isFinite(uo)?0:uo>70?1:uo<30?-1:0;
  add('ultimate','Ultimate Oscillator · 7–14–28',ultimateDir>0?'Áp lực mua mạnh':ultimateDir<0?'Áp lực mua yếu':'Chưa rõ',ultimateDir,[['UO',number(uo)]],'Gộp buying pressure trên ba cửa sổ với trọng số 4–2–1.','Theo Technical Ratings: UO >70 là tăng, UO <30 là giảm, còn lại trung tính.','Ngưỡng cực trị hiếm và không thay thế phân tích phân kỳ đầy đủ.');
  if(i<40){
    [['ema100retest','EMA100 · Breakout & Retest'],['htfrejection','HTF · Rút râu tại EMA'],['emasqueeze','EMA Squeeze · Inside Breakout'],['hiddendiv','Phân kỳ kín · EMA Bounce'],['liquiditysweep','EMA 2B · Quét thanh khoản'],['rubberband','Rubber Band · Hồi về EMA20'],['doubletest','EMA50 · Kiểm tra kép'],['trendsurf','Trend Surfing · EMA20']].forEach(([id,title])=>add(id,title,'Thiếu dữ liệu',0,[['Trạng thái','Cần thêm nến']],'Chưa đủ mẫu để đánh giá mô hình.','Chỉ đánh giá trên chuỗi nến đã đóng có đủ dữ liệu làm ấm.','Không tạo hướng khi thiếu mẫu.'));
    return cards;
  }
  const avgVolume=average(rows.slice(i-20,i).map(x=>x.volume)),volumeRatio=avgVolume?rows[i].volume/avgVolume:null,atrNow=data.atr[i],candleBull=r.close>r.open,candleBear=r.close<r.open;
  const crossUp=(a,b,j)=>a[j]>b[j]&&a[j-1]<=b[j-1],crossDown=(a,b,j)=>a[j]<b[j]&&a[j-1]>=b[j-1];
  const e100Up=i>11&&rows.slice(i-11,i-1).every((x,j)=>x.close<=data.e100[i-11+j])&&crossUp(rows.map(x=>x.close),data.e100,i-1)&&rows[i-1].volume>=1.5*average(rows.slice(i-21,i-1).map(x=>x.volume))&&r.low<=data.e100[i]&&r.close>=data.e100[i]&&candleBull;
  const e100Down=i>11&&rows.slice(i-11,i-1).every((x,j)=>x.close>=data.e100[i-11+j])&&crossDown(rows.map(x=>x.close),data.e100,i-1)&&rows[i-1].volume>=1.5*average(rows.slice(i-21,i-1).map(x=>x.volume))&&r.high>=data.e100[i]&&r.close<=data.e100[i]&&candleBear;
  add('ema100retest','EMA100 · Breakout & Retest',e100Up?'Retest tăng sau phá EMA100':e100Down?'Retest giảm sau phá EMA100':'Chưa rõ',e100Up?1:e100Down?-1:0,[['Volume / SMA20',volumeRatio===null?'—':number(volumeRatio)+'×']],'Nhận diện phá EMA100 bằng volume rồi retest trên nến kế tiếp.','10 nến cùng phía cũ; nến trước cắt EMA100 với volume ≥1,5×; nến cuối retest và đóng đúng màu.','Quy tắc chặt nên tín hiệu hiếm; không tự suy ra điểm vào hoặc mức dừng lỗ.');
  const higher=context.higher,higherE=higher?.e50?.at(-1),higherE100=higher?.e100?.at(-1),upperWick=r.high-Math.max(r.open,r.close),lowerWick=Math.min(r.open,r.close)-r.low,range=r.high-r.low;
  const htfShort=Number.isFinite(higherE)&&[higherE,higherE100].some(v=>Number.isFinite(v)&&r.high>=v&&r.low<=v)&&range>0&&upperWick>=.5*range&&r.close<data.e20[i];
  const htfLong=Number.isFinite(higherE)&&[higherE,higherE100].some(v=>Number.isFinite(v)&&r.high>=v&&r.low<=v)&&range>0&&lowerWick>=.5*range&&r.close>data.e20[i];
  add('htfrejection','HTF · Rút râu tại EMA',htfLong?'Rút chân tăng tại EMA khung lớn':htfShort?'Rút râu giảm tại EMA khung lớn':'Chưa rõ',htfLong?1:htfShort?-1:0,[['EMA HTF 50 / 100',number(higherE)+' / '+number(higherE100)]],'Đối chiếu biên nến hiện tại với EMA50/100 của khung lớn đã đóng.','Râu từ chối ≥50% biên nến và Close quay về đúng phía EMA20 khung hiện tại.','EMA khung lớn là giá trị nến đóng gần nhất, không nội suy trong nến.');
  const mother=rows[i-2],inside=rows[i-1],insideBar=inside.high<=mother.high&&inside.low>=mother.low,squeezed=Math.abs(data.e20[i-1]-data.e50[i-1])<=.4*data.atr[i-1],squeezeLong=insideBar&&squeezed&&r.close>mother.high&&volumeRatio>=1.2,squeezeShort=insideBar&&squeezed&&r.close<mother.low&&volumeRatio>=1.2;
  add('emasqueeze','EMA Squeeze · Inside Breakout',squeezeLong?'Bung nén tăng':squeezeShort?'Bung nén giảm':'Chưa rõ',squeezeLong?1:squeezeShort?-1:0,[['Khoảng EMA / ATR',number(Math.abs(data.e20[i]-data.e50[i]))+' / '+number(atrNow)]],'Tìm Inside Bar trong lúc EMA20–50 co hẹp rồi phá Mother Bar.','|EMA20−EMA50| ≤0,4×ATR; Close phá biên Mother Bar; volume ≥1,2×SMA20.','Breakout có thể thất bại; không dùng riêng để đặt lệnh.');
  const pivots=(kind)=>{const out=[];for(let j=Math.max(2,i-40);j<=i-2;j++){const v=rows[j][kind],window=rows.slice(j-2,j+3).map(x=>x[kind]);if((kind==='low'&&v===Math.min(...window))||(kind==='high'&&v===Math.max(...window)))out.push(j);}return out;},lows=pivots('low').slice(-2),highs=pivots('high').slice(-2);
  const hiddenLong=lows.length===2&&rows[lows[1]].low>rows[lows[0]].low&&data.rsi[lows[1]]<data.rsi[lows[0]]&&Math.min(Math.abs(rows[lows[1]].low-data.e50[lows[1]]),Math.abs(rows[lows[1]].low-data.e100[lows[1]]))<=.3*data.atr[lows[1]]&&candleBull;
  const hiddenShort=highs.length===2&&rows[highs[1]].high<rows[highs[0]].high&&data.rsi[highs[1]]>data.rsi[highs[0]]&&Math.min(Math.abs(rows[highs[1]].high-data.e50[highs[1]]),Math.abs(rows[highs[1]].high-data.e100[highs[1]]))<=.3*data.atr[highs[1]]&&candleBear;
  add('hiddendiv','Phân kỳ kín · EMA Bounce',hiddenLong?'Phân kỳ kín tăng':hiddenShort?'Phân kỳ kín giảm':'Chưa rõ',hiddenLong?1:hiddenShort?-1:0,[['Pivot gần nhất',lows.at(-1)??highs.at(-1)??'—']],'So hai swing đã xác nhận bằng cửa sổ 5 nến với RSI và EMA50/100.','Tăng: higher low của giá, lower low RSI, chạm EMA ±0,3ATR và nến cuối tăng; giảm đối xứng.','Pivot cần hai nến bên phải nên có độ trễ; không repaint sau khi xác nhận.');
  const prev=rows[i-1],sweepShort=prev.high>data.e50[i-1]&&r.close<data.e50[i]&&candleBear&&r.open>=prev.close&&r.close<=prev.open&&r.volume>prev.volume,sweepLong=prev.low<data.e50[i-1]&&r.close>data.e50[i]&&candleBull&&r.open<=prev.close&&r.close>=prev.open&&r.volume>prev.volume;
  add('liquiditysweep','EMA 2B · Quét thanh khoản',sweepLong?'Quét xuống rồi đảo tăng':sweepShort?'Quét lên rồi đảo giảm':'Chưa rõ',sweepLong?1:sweepShort?-1:0,[['Volume hiện tại / trước',number(r.volume)+' / '+number(prev.volume)]],'Nhận diện phá giả EMA50 rồi nến kế tiếp engulfing kéo giá trở lại.','Nến trước xuyên EMA50; nến cuối engulfing ngược hướng, đóng lại phía kia và volume lớn hơn.','Không thể xác định ý đồ thị trường; đây chỉ là mẫu hình giá/volume.');
  const stretch=(r.close-data.e20[i])/atrNow,prevRange=prev.high-prev.low,prevDoji=prevRange>0&&Math.abs(prev.close-prev.open)<=.15*prevRange,prevHammer=prevRange>0&&(Math.min(prev.open,prev.close)-prev.low)>=.5*prevRange,prevStar=prevRange>0&&(prev.high-Math.max(prev.open,prev.close))>=.5*prevRange;
  const rubberLong=stretch<=-3&&data.rsi[i-1]<=25&&(prevDoji||prevHammer)&&r.close>prev.high,rubberShort=stretch>=3&&data.rsi[i-1]>=75&&(prevDoji||prevStar)&&r.close<prev.low;
  add('rubberband','Rubber Band · Hồi về EMA20',rubberLong?'Hồi quy tăng tiềm năng':rubberShort?'Hồi quy giảm tiềm năng':'Chưa rõ',rubberLong?1:rubberShort?-1:0,[['Khoảng cách / ATR',number(stretch)+'×']],'Tìm giá cách EMA20 ít nhất 3 ATR, RSI cực trị và nến xác nhận phá mẫu đảo chiều.','RSI ≤25 hoặc ≥75; Doji/Hammer/Shooting Star; nến cuối phá biên theo hướng hồi quy.','Là mô hình ngược xu hướng rủi ro cao; chỉ hiển thị quan sát.');
  const touches50=j=>rows[j].high>=data.e50[j]&&rows[j].low<=data.e50[j],touches=[];for(let j=i-9;j<=i;j++)if(j>=1&&touches50(j))touches.push(j);const t2=touches.at(-1),t1=touches.slice(0,-1).reverse().find(j=>t2-j>=3&&t2-j<=8),doubleLong=t1!==undefined&&t2===i&&rows[t2].low>=rows[t1].low-.2*data.atr[t2]&&candleBull,doubleShort=t1!==undefined&&t2===i&&rows[t2].high<=rows[t1].high+.2*data.atr[t2]&&candleBear;
  add('doubletest','EMA50 · Kiểm tra kép',doubleLong?'Hai lần test hỗ trợ':doubleShort?'Hai lần test kháng cự':'Chưa rõ',doubleLong?1:doubleShort?-1:0,[['Khoảng cách hai lần',t1===undefined?'—':String(t2-t1)+' nến']],'Tìm hai lần chạm EMA50 cách nhau 3–8 nến với lần hai không xuyên sâu.','Lần hai lệch tối đa 0,2ATR so với lần đầu và đóng đúng màu.','Không kiểm tra mức nảy 0,8ATR giữa hai lần nếu chuỗi chạm liên tục.');
  const adxRising=data.adx[i]>=30&&data.adx[i]>data.adx[i-1],emaSlope=data.e20[i]-data.e20[i-3],retestLong=prev.low<=data.e20[i-1]&&prev.close>=data.e20[i-1]&&r.close>prev.high,retestShort=prev.high>=data.e20[i-1]&&prev.close<=data.e20[i-1]&&r.close<prev.low,trendLong=adxRising&&emaSlope>=1.5*atrNow&&retestLong,trendShort=adxRising&&emaSlope<=-1.5*atrNow&&retestShort;
  add('trendsurf','Trend Surfing · EMA20',trendLong?'Gia tốc tăng trên EMA20':trendShort?'Gia tốc giảm dưới EMA20':'Chưa rõ',trendLong?1:trendShort?-1:0,[['ADX / dốc EMA20',number(data.adx[i])+' / '+number(emaSlope)]],'Tìm xu hướng rất mạnh bám EMA20 và nến cuối phá biên nến retest.','ADX ≥30 và tăng; dốc EMA20 trong 3 nến ≥1,5ATR; retest nông rồi phá biên.','Điều kiện dốc rất chặt nên tín hiệu hiếm; không triển khai trailing stop.');
  return cards;
}
root.CoinMethods={SOURCES,GROUPS,rma,rsi,directional,bollinger,donchian,sessionVWAP,sma,supertrend,ichimoku,stochastic,cci,macd,momentum,aroon,roc,williams,mfi,obv,chaikin,awesome,stochasticRsi,bullBear,ultimate,calculate,riskPlan,summarize};
})(globalThis);

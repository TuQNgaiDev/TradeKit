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
  momentum:'https://www.tradingview.com/support/solutions/43000614331-technical-ratings/'
};
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
function calculate(rows){
  const closes=rows.map(r=>r.close);
  return {rsi:rsi(closes),...directional(rows),bb:bollinger(closes),channel:donchian(rows),vwap:sessionVWAP(rows),supertrend:supertrend(rows),ichimoku:ichimoku(rows),stochastic:stochastic(rows),cci:cci(rows),macd:macd(closes),momentum:momentum(closes)};
}
const average=a=>a.length&&a.every(Number.isFinite)?a.reduce((s,v)=>s+v,0)/a.length:null;
const number=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:Math.abs(v)<1?4:2}):'—';
function summarize(rows,data){
  const i=rows.length-1,r=rows[i],cards=[];
  if(!r)return cards;
  function add(id,title,state,direction,metrics,meaning,rule,limit){
    cards.push({id,title,state,direction,metrics,meaning,rule,limit,source:SOURCES[id]});
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
  return cards;
}
root.CoinMethods={SOURCES,rma,rsi,directional,bollinger,donchian,sessionVWAP,sma,supertrend,ichimoku,stochastic,cci,macd,momentum,calculate,summarize};
})(globalThis);

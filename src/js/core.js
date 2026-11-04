/* Pure EMA/signal rules. No network, UI, clock or storage dependencies. */
(function(root){
'use strict';
const FRAMES={'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000};
const TRADE_FRAMES=['15m','30m','1h'];
const DATA_FRAMES=[...TRADE_FRAMES,'4h'];
const LABELS={'15m':'M15','30m':'M30','1h':'H1','4h':'H4','1d':'D1'};
const HIGHER={'15m':'1h','30m':'1h','1h':'4h','4h':'1d','1d':'4h'};
function ema(values,period){
  if(!Number.isInteger(period)||period<1)throw Error('Chu kỳ EMA không hợp lệ');
  const result=Array(values.length).fill(null);let sum=0,previous=null;
  values.forEach((v,i)=>{
    if(!Number.isFinite(v))throw Error('Giá EMA không hợp lệ');
    if(i<period){sum+=v;if(i===period-1)result[i]=previous=sum/period;}
    else result[i]=previous=v*2/(period+1)+previous*(1-2/(period+1));
  });return result;
}
function closedRows(raw,frame,serverTime){
  const step=FRAMES[frame];
  if(!step||!Number.isFinite(serverTime)||!Array.isArray(raw))throw Error('Dữ liệu hoặc thời gian máy chủ không hợp lệ.');
  const rows=raw.map(r=>{
    if(!Array.isArray(r)||r.length<7||r.slice(0,7).some(v=>v===null||v===''||!Number.isFinite(Number(v))))throw Error('Nến chứa dữ liệu không hợp lệ.');
    const [time,open,high,low,close,volume,closeTime]=r.map(Number);
    if(!Number.isSafeInteger(time)||time<0||time%step!==0||closeTime!==time+step-1||low<=0||volume<0||high<Math.max(open,close,low)||low>Math.min(open,close))throw Error('Biên độ hoặc thời gian nến không hợp lệ.');
    return {time,open,high,low,close,volume,closeTime};
  });
  for(let i=1;i<rows.length;i++)if(rows[i].time!==rows[i-1].time+step)throw Error('Nến thiếu, trùng hoặc sai thứ tự.');
  const closed=rows.filter(r=>r.closeTime<serverTime);
  if(closed.length<500)throw Error('Thiếu dữ liệu: cần ít nhất 500 nến đã đóng để làm ấm EMA.');
  const expected=Math.floor(serverTime/step)*step-step;
  if(closed.at(-1).time!==expected)throw Error('Dữ liệu nến đã cũ: chưa có nến đã đóng gần nhất theo máy chủ Binance.');
  return closed;
}
function indicators(rows){
  const closes=rows.map(r=>r.close),e20=ema(closes,20),e50=ema(closes,50),e100=ema(closes,100);
  const e12=ema(closes,12),e26=ema(closes,26),macd=closes.map((_,i)=>e26[i]===null?null:e12[i]-e26[i]);
  const signal=Array(25).fill(null).concat(ema(macd.slice(25),9));
  const i=rows.length-1,avg=rows.slice(i-20,i).reduce((s,r)=>s+r.volume,0)/20;
  return {rows,closes,e20,e50,e100,macd,signal,volumeRatio:avg?rows[i].volume/avg:null};
}
function trendAt(data,i){
  const a=data.e20[i],b=data.e50[i],c=data.e100[i];
  const order=a>b&&b>c?1:a<b&&b<c?-1:0;
  const diffs=[data.e20,data.e50,data.e100].map(e=>i>=3&&e[i-3]!==null?e[i]-e[i-3]:NaN);
  const slope=diffs.every(x=>x>0)?1:diffs.every(x=>x<0)?-1:0;
  return {order,slope,diffs,direction:order!==0&&order===slope?order:0};
}
function touches(data,i){
  const a=data.e20[i],b=data.e50[i],r=data.rows[i];
  return a!==null&&b!==null&&r.high>=Math.min(a,b)&&r.low<=Math.max(a,b);
}
function setupAt(data,i){
  const trend=trendAt(data,i),r=data.rows[i];let pullbackIndex=null;
  for(let j=i-1;j>=Math.max(99,i-5);j--)if(touches(data,j)){pullbackIndex=j;break;}
  const candle=trend.direction===1?r.close>r.open&&r.close>data.e20[i]:trend.direction===-1?r.close<r.open&&r.close<data.e20[i]:false;
  return {...trend,pullbackIndex,candle,candidate:!!trend.direction&&pullbackIndex!==null&&candle};
}
function evaluate(data,comparison,frame){
  const i=data.rows.length-1,setup=setupAt(data,i),other=comparison?trendAt(comparison,comparison.rows.length-1):null;
  const higher=frame!=='1d',aligned=!!setup.direction&&other?.direction===setup.direction;
  let status='Chưa có xu hướng rõ',reason='Thứ tự EMA và độ dốc 3 nến chưa cùng hướng.',current=false;
  if(setup.direction){
    const recentTouch=touches(data,i)||setup.pullbackIndex!==null;
    status=recentTouch?'Đã hồi — chờ nến xác nhận':'Có xu hướng — chờ hồi';
    reason=recentTouch?'Chờ nến đúng màu đóng vượt EMA20 sau lần hồi trong 5 nến trước.':'Chưa có high–low giao vùng EMA20–50 trong cửa sổ hồi.';
    if(!other||!aligned){status='Thiếu dữ liệu hoặc khung thời gian trái chiều';reason=!other?'Không tải được khung đối chiếu; chưa thể xác nhận.':other.direction===0?'Khung đối chiếu chưa có xu hướng rõ.':'Khung đối chiếu trái hướng; chưa thể xác nhận.';}
    if(setup.candidate&&higher&&aligned){current=true;status='Có xác nhận '+(setup.direction===1?'Long':'Short');reason='Nến đã đóng gần nhất thỏa thứ tự EMA, độ dốc, hồi trong 5 nến trước và nến xác nhận; khung lớn hơn cùng hướng.';}
    if(setup.candidate&&!higher){status='Thiếu dữ liệu hoặc khung thời gian trái chiều';reason='1d đủ mẫu nến tại khung đang xem, nhưng không có xác nhận từ khung lớn hơn. 4h chỉ tham khảo.';}
  }
  return {...setup,other,aligned,higher,current,status,reason,signal:current?{time:data.rows[i].closeTime,price:data.rows[i].close,direction:setup.direction}:null};
}
root.CoinCore={FRAMES,TRADE_FRAMES,DATA_FRAMES,LABELS,HIGHER,ema,closedRows,indicators,trendAt,touches,setupAt,evaluate};
})(globalThis);

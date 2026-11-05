/* Synthetic tests only: never loaded by the production page. Node or tests/index.html. */
async function runTests(){
  const C=globalThis.CoinCore,A=globalThis.CoinAPI,results=[];
  function assert(ok,message='Điều kiện sai'){if(!ok)throw Error(message);}
  function near(a,b){assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);}
  async function test(name,fn){try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
  function fixture(direction=1){return Array.from({length:500},(_,i)=>{const close=direction===1?100+i*.5:direction===-1?1000-i*.5:100,open=close-direction*.2;return {time:i*900000,closeTime:(i+1)*900000-1,open,close,high:Math.max(open,close)+.2,low:Math.min(open,close)-.2,volume:10};});}
  function pulled(direction=1,index=498){const rows=fixture(direction),data=C.indicators(rows);if(direction===1)rows[index].low=data.e50[index]-1;else rows[index].high=data.e50[index]+1;return C.indicators(rows);}
  const raw=rows=>rows.map(r=>[r.time,r.open,r.high,r.low,r.close,r.volume,r.closeTime]);
  await test('EMA seed trung bình N, chuỗi có đáp án biết trước',()=>{
    const e=C.ema([2,4,8,10,14,16],3);assert(e[0]===null&&e[1]===null);[14/3,22/3,32/3,40/3].forEach((v,i)=>near(e[i+2],v));
    for(const n of [20,50,100]){const a=C.ema(Array.from({length:500},(_,i)=>i+1),n);near(a[n-1],(n+1)/2);near(a.at(-1),500-(n-1)/2);}
  });
  await test('EMA hằng số và dữ liệu không hợp lệ',()=>{for(const n of [20,50,100])near(C.ema(Array(500).fill(42),n).at(-1),42);let threw=false;try{C.ema([1,NaN],2);}catch{threw=true;}assert(threw);});
  await test('Long có hồi và khung lớn đồng hướng',()=>{const d=pulled(),r=C.evaluate(d,C.indicators(fixture()),'15m');assert(r.current&&r.status==='Có xác nhận Long');assert(r.signal.time===d.rows.at(-1).closeTime);near(r.signal.price,d.rows.at(-1).close);});
  await test('Short có hồi và khung lớn đồng hướng',()=>{const r=C.evaluate(pulled(-1),C.indicators(fixture(-1)),'1h');assert(r.current&&r.status==='Có xác nhận Short');});
  await test('Đi ngang',()=>{const d=C.indicators(fixture(0));assert(C.evaluate(d,d,'15m').status==='Chưa có xu hướng rõ');});
  await test('Có xu hướng chờ hồi',()=>{const d=C.indicators(fixture());assert(C.evaluate(d,d,'15m').status==='Có xu hướng — chờ hồi');});
  await test('Đã hồi nhưng nến cuối chưa xác nhận',()=>{const rows=pulled().rows;rows.at(-1).open=rows.at(-1).close+.1;const d=C.indicators(rows);assert(C.evaluate(d,d,'15m').status==='Đã hồi — chờ nến xác nhận');});
  await test('Khung lớn trái chiều ngăn xác nhận',()=>{const r=C.evaluate(pulled(),C.indicators(fixture(-1)),'4h');assert(!r.current&&r.status==='Thiếu dữ liệu hoặc khung thời gian trái chiều');});
  await test('Thiếu khung đối chiếu ngăn xác nhận',()=>{assert(!C.evaluate(pulled(),null,'15m').current);});
  await test('M30 được hỗ trợ và đối chiếu H1; chỉ chọn M15/M30/H1',()=>{const d=pulled();assert(C.FRAMES['30m']===1800000&&C.HIGHER['30m']==='1h');assert(C.TRADE_FRAMES.join(',')==='15m,30m,1h');assert(C.DATA_FRAMES.join(',')==='15m,30m,1h,4h');assert(C.evaluate(d,d,'30m').current);});
  await test('Cửa sổ hồi đúng t−5 đến t−1, không gồm t−6',()=>{assert(C.evaluate(pulled(1,494),C.indicators(fixture()),'15m').current);assert(!C.evaluate(pulled(1,493),C.indicators(fixture()),'15m').current);});
  await test('Chỉ nến cuối chạm vùng không xác nhận ngay',()=>{const d=pulled(1,499);assert(!C.evaluate(d,d,'15m').current);});
  await test('Nến doji không xác nhận',()=>{const d=pulled();d.rows.at(-1).open=d.rows.at(-1).close;assert(!C.evaluate(d,d,'15m').current);});
  await test('Xu hướng/độ dốc phải còn hợp lệ tại xác nhận',()=>{const d=pulled();d.e100[499]=d.e20[499]+1;assert(!C.evaluate(d,d,'15m').current);const s=pulled();s.e50[496]=s.e50[499]+1;assert(!C.evaluate(s,s,'15m').current);});
  await test('Biên hồi chạm bằng được tính',()=>{const d=C.indicators(fixture());d.rows[498].low=d.e20[498];assert(C.touches(d,498));d.rows[498].low=d.e20[498]+1;assert(!C.touches(d,498));});
  await test('Không giữ xác nhận cũ sang nến kế tiếp',()=>{const d=pulled(1,497);d.rows[499].open=d.rows[499].close+.1;assert(C.setupAt(d,498).candidate);assert(!C.evaluate(d,d,'15m').current);});
  await test('MACD/volume không ảnh hưởng tín hiệu',()=>{const d=pulled(),before=C.evaluate(d,d,'15m');d.macd.fill(-1e9);d.signal.fill(1e9);d.volumeRatio=0;assert(C.evaluate(d,d,'15m').status===before.status);});
  await test('Loại nến chưa đóng, kể cả closeTime = serverTime',()=>{
    const rows=fixture(),next={...rows[499],time:450000000,closeTime:450899999,close:99999,high:100000};
    const filtered=C.closedRows(raw([...rows,next]),'15m',450899999);assert(filtered.length===500);near(C.indicators(filtered).e20.at(-1),C.indicators(rows).e20.at(-1));
  });
  await test('Từ chối thiếu nến, nến cũ, NaN, trùng và đứt đoạn',()=>{
    const r=raw(fixture()),cases=[r.slice(1),r.slice(0,-1),[...r.slice(0,20),...r.slice(21)],r.map((v,i)=>i===30?[...v.slice(0,4),'oops',...v.slice(5)]:v),[...r.slice(0,20),r[19],...r.slice(20)]];
    for(const bad of cases){let threw=false;try{C.closedRows(bad,'15m',450000001);}catch{threw=true;}assert(threw);}
    let stale=false;try{C.closedRows(r,'15m',450900001);}catch(e){stale=e.message.includes('cũ');}assert(stale);
  });
  const response=(value,status=200,retry=null)=>({ok:status===200,status,headers:{get:()=>retry},json:async()=>value});
  await test('exchangeInfo chỉ nhận USDT perpetual đang giao dịch',()=>{
    const client=new A.FuturesClient({fetcher:async()=>{}}),base={symbol:'BTCUSDT',contractType:'PERPETUAL',status:'TRADING',quoteAsset:'USDT',marginAsset:'USDT'};
    assert(client.validateSymbol({symbols:[base]},'BTCUSDT')===base);
    for(const patch of [{contractType:'CURRENT_QUARTER'},{status:'SETTLING'},{quoteAsset:'USDC'},{marginAsset:'BTC'},{symbol:'OTHERUSDT'}]){let threw=false;try{client.validateSymbol({symbols:[{...base,...patch}]},'BTCUSDT');}catch{threw=true;}assert(threw);}
  });
  await test('Cache, gộp yêu cầu trùng và giới hạn đồng thời',async()=>{
    let active=0,maximum=0,calls=0;const client=new A.FuturesClient({maxConcurrent:3,fetcher:async()=>{calls++;active++;maximum=Math.max(maximum,active);await new Promise(r=>setTimeout(r,5));active--;return response({ok:true});}});
    await Promise.all(['/a','/a','/b','/c','/d','/e'].map(p=>client.get(p)));assert(calls===5&&maximum===3);await client.get('/a');assert(calls===5);
  });
  await test('429/418 tạm dừng và không retry vô hạn',async()=>{
    for(const status of [429,418]){let calls=0,time=1000;const client=new A.FuturesClient({now:()=>time,fetcher:async()=>{calls++;return response({},status,'120');}});
      await client.get('/a').catch(()=>{});await client.get('/b').catch(()=>{});assert(calls===1&&client.blockedUntil===121000);}
  });
  await test('Timeout hủy yêu cầu và không retry',async()=>{
    let calls=0;const client=new A.FuturesClient({timeout:5,fetcher:(_,opts)=>new Promise((_,reject)=>{calls++;opts.signal.addEventListener('abort',()=>{const e=Error();e.name='AbortError';reject(e);});})});
    const message=await client.get('/timeout').then(()=>'',e=>e.message);assert(calls===1&&message.includes('quá thời gian'));
  });
  await test('Lỗi mạng/API không gọi Spot hoặc tự sinh dữ liệu',async()=>{
    const paths=[],client=new A.FuturesClient({fetcher:async url=>{paths.push(url);throw TypeError('Failed to fetch');}});
    const msg=await client.get('/fapi/v1/time').then(()=>'',e=>e.message);assert(msg.includes('Không truy cập')&&paths.length===1&&paths[0].startsWith('https://fapi.binance.com/'));
  });
  await test('Bỏ phản hồi cũ khi đổi yêu cầu nhanh',async()=>{
    const gate=new A.LatestOnly(),old=gate.begin(),current=gate.begin();let rendered='';
    await Promise.all([new Promise(r=>setTimeout(()=>{if(old())rendered='OLD';r();},15)),Promise.resolve().then(()=>{if(current())rendered='NEW';})]);assert(rendered==='NEW');
  });
  const M=globalThis.CoinMethods;
  await test('Wilder RMA: seed trung bình, alpha 1/N và khuyết mẫu',()=>{
    const a=M.rma([null,2,4,6,8],3);assert(a[2]===null);near(a[3],4);near(a[4],16/3);
    const b=M.rma([1,3,null,5,7],2);assert(b[2]===null&&b[3]===null);near(b[4],6);
  });
  await test('RSI đáp án tính tay cho chu kỳ 3',()=>{
    const a=M.rsi([10,11,10,12,11],3);assert(a[2]===null);near(a[3],75);near(a[4],600/11);
  });
  await test('RSI14 bảng Wilder có kết quả kỳ vọng',()=>{
    const a=M.rsi([44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46.00]);
    near(a[14],70.46413502109705);near(a[15],66.24961855355505);
  });
  await test('RSI chuỗi chỉ tăng/giảm/hằng số: 100/0/50',()=>{
    for(const [direction,expected] of [[1,100],[-1,0],[0,50]])near(M.rsi(fixture(direction).map(r=>r.close)).at(-1),expected);
  });
  await test('ATR dùng gap và Wilder đúng đáp án tính tay',()=>{
    const rows=[{high:11,low:9,close:10},{high:15,low:13,close:14},{high:16,low:12,close:15},{high:17,low:14,close:16}];
    const a=M.directional(rows,3);assert(a.tr.join(',')==='2,5,4,3');near(a.atr[2],11/3);near(a.atr[3],31/9);
  });
  await test('ADX/DMI: seed, hướng tăng và giảm với đáp án 50/100',()=>{
    for(const sign of [1,-1]){
      const rows=Array.from({length:60},(_,i)=>({high:101+sign*i,low:99+sign*i,close:100+sign*i}));
      const d=M.directional(rows);assert(d.plusDI[13]===null&&d.adx[26]===null);
      near(d.plusDI[14],sign===1?50:0);near(d.minusDI[14],sign===-1?50:0);near(d.adx[27],100);
    }
  });
  await test('DMI bằng biên và nến không biến động không tạo NaN',()=>{
    const rows=Array.from({length:60},()=>({high:100,low:100,close:100})),d=M.directional(rows);
    near(d.atr.at(-1),0);near(d.plusDI.at(-1),0);near(d.minusDI.at(-1),0);near(d.adx.at(-1),0);
    const equal=M.directional([{high:11,low:9,close:10},{high:12,low:8,close:10}],1);near(equal.plusDI[1],0);near(equal.minusDI[1],0);
  });
  await test('Bollinger20: phương sai tổng thể chia N',()=>{
    const b=M.bollinger(Array.from({length:20},(_,i)=>i+1));assert(b.upper[18]===null);near(b.middle[19],10.5);near(b.upper[19],10.5+2*Math.sqrt(33.25));near(b.lower[19],10.5-2*Math.sqrt(33.25));
  });
  await test('Bollinger dải phẳng không chia cho 0',()=>{const b=M.bollinger(Array(30).fill(42));near(b.width.at(-1),0);assert(b.percentB.at(-1)===null);});
  await test('Donchian loại nến hiện tại khỏi mức hỗ trợ/kháng cự',()=>{
    const rows=fixture(),a=M.donchian(rows);assert(a.upper[19]===null);near(a.upper[20],rows[19].high);near(a.lower[20],rows[0].low);
    const u=a.upper.at(-1),l=a.lower.at(-1);rows.at(-1).high=99999;rows.at(-1).low=.01;const b=M.donchian(rows);near(b.upper.at(-1),u);near(b.lower.at(-1),l);
  });
  await test('Donchian: đóng phá kênh tăng/giảm; chạm bằng chưa phá',()=>{
    for(const [sign,label] of [[1,'đỉnh'],[-1,'đáy']]){
      const rows=fixture(sign),data=M.calculate(rows),card=M.summarize(rows,data).find(c=>c.id==='channel');assert(card.state.includes(label)&&card.direction===sign);
      rows.at(-1).close=sign===1?data.channel.upper.at(-1):data.channel.lower.at(-1);
      assert(M.summarize(rows,M.calculate(rows)).find(c=>c.id==='channel').state==='Chưa phá kênh');
    }
  });
  await test('VWAP trọng số HLC3, volume 0 và reset UTC',()=>{
    const r=(time,close,volume)=>({time,high:close+1,low:close-1,close,volume});
    const d=M.sessionVWAP([r(0,10,1),r(900000,20,3),r(1800000,30,0),r(86400000,40,2)]);
    near(d.values[0],10);near(d.values[1],17.5);near(d.values[2],17.5);near(d.values[3],40);assert(d.counts[3]===1&&d.sessions[3]===86400000);
    assert(M.sessionVWAP([r(0,10,0)]).values[0]===null);
  });
  await test('VWAP từ chối phiên bị cắt đầu; đủ ngày sau mới có giá',()=>{
    const rows=[{time:900000,high:11,low:9,close:10,volume:1},{time:86400000,high:21,low:19,close:20,volume:1}],v=M.sessionVWAP(rows);assert(v.values[0]===null);near(v.values[1],20);
  });
  await test('SMA và Stochastic 14–3–3 có kết quả kỳ vọng',()=>{
    const s=M.sma([1,2,3,4],3);assert(s[0]===null&&s[1]===null);near(s[2],2);near(s[3],3);
    const d=M.stochastic(fixture());near(d.raw.at(-1),100*(fixture().at(-1).close-fixture().slice(-14).reduce((v,r)=>Math.min(v,r.low),Infinity))/(fixture().slice(-14).reduce((v,r)=>Math.max(v,r.high),-Infinity)-fixture().slice(-14).reduce((v,r)=>Math.min(v,r.low),Infinity)));assert(Number.isFinite(d.k.at(-1))&&Number.isFinite(d.d.at(-1)));
  });
  await test('Supertrend và Ichimoku nhận đúng chuỗi tăng/giảm',()=>{
    assert(M.supertrend(fixture()).direction.at(-1)===1);assert(M.supertrend(fixture(-1)).direction.at(-1)===-1);
    assert(M.ichimoku(fixture()).direction.at(-1)===1);assert(M.ichimoku(fixture(-1)).direction.at(-1)===-1);
  });
  await test('CCI, MACD và Momentum không bịa hướng trên chuỗi phẳng',()=>{
    const flat=fixture(0),closes=flat.map(r=>r.close);near(M.cci(flat).at(-1),0);near(M.macd(closes).line.at(-1),0);near(M.macd(closes).signal.at(-1),0);near(M.momentum(closes).at(-1),0);
  });
  await test('Phương pháp mới không nhận nến mở và không có look-ahead',()=>{
    const rows=fixture(),next={...rows[499],time:450000000,closeTime:450899999,close:99999,high:100000};
    const closed=C.closedRows(raw([...rows,next]),'15m',450000001),a=M.calculate(closed),b=M.calculate(rows);
    near(a.rsi.at(-1),b.rsi.at(-1));near(a.atr.at(-1),b.atr.at(-1));near(a.vwap.values.at(-1),b.vwap.values.at(-1));
    const before=M.calculate(rows.slice(0,499));near(b.rsi[498],before.rsi.at(-1));near(b.bb.upper[498],before.bb.upper.at(-1));
  });
  await test('22 thẻ thuộc 4 nhóm có quy tắc/nguồn; ATR không chỉ hướng; không đổi EMA',()=>{
    const d=pulled(),before=C.evaluate(d,d,'30m').status,extra=M.calculate(d.rows),cards=M.summarize(d.rows,extra);
    assert(cards.length===22&&new Set(cards.map(c=>c.id)).size===22&&new Set(cards.map(c=>c.group)).size===4);assert(cards.every(c=>c.rule&&c.limit&&c.source.startsWith('https://www.tradingview.com/')));
    assert(cards.find(c=>c.id==='atr').direction===0);d.methods=extra;assert(C.evaluate(d,d,'30m').status===before);
    assert(cards.find(c=>c.id==='rsi').state==='Quá mua'&&cards.find(c=>c.id==='rsi').direction===1);
  });
  await test('Aroon, ROC, Williams %R, MFI, OBV và Chaikin có kết quả xác định',()=>{
    const up=fixture(),down=fixture(-1),u=M.calculate(up),d=M.calculate(down);
    near(u.aroon.up.at(-1),100);near(u.aroon.down.at(-1),0);near(d.aroon.up.at(-1),0);near(d.aroon.down.at(-1),100);
    assert(u.roc.at(-1)>0&&d.roc.at(-1)<0&&u.williams.at(-1)>-20&&d.williams.at(-1)<-80);
    near(u.mfi.at(-1),100);near(d.mfi.at(-1),0);assert(u.obv.at(-1)>0&&d.obv.at(-1)<0);
    assert(Number.isFinite(u.chaikin.at(-1))&&Number.isFinite(d.chaikin.at(-1)));
  });
  await test('AO, Stochastic RSI, Bull Bear Power và Ultimate có seed và giá trị hữu hạn',()=>{
    const rows=fixture(),d=M.calculate(rows),flat=fixture(0),f=M.calculate(flat);
    assert(d.awesome[32]===null&&Number.isFinite(d.awesome[33]));
    assert(d.stochrsi.k.slice(0,29).every(v=>v===null)&&Number.isFinite(d.stochrsi.k.at(-1))&&Number.isFinite(d.stochrsi.d.at(-1)));
    assert(d.bullbear.baseline[11]===null&&Number.isFinite(d.bullbear.baseline[12])&&Number.isFinite(d.bullbear.bull.at(-1)));
    assert(d.ultimate[26]===null&&Number.isFinite(d.ultimate[27]));near(f.ultimate.at(-1),50);
  });
  await test('Thiếu mẫu chỉ báo mới trả null thay vì giá trị bịa',()=>{
    const rows=fixture().slice(0,2),d=M.calculate(rows);assert(d.rsi.at(-1)===null&&d.adx.at(-1)===null&&d.atr.at(-1)===null&&d.channel.upper.at(-1)===null);
    const cards=M.summarize(rows,d);assert(cards.find(c=>c.id==='atr').metrics[0][1]==='— / —%');
  });
  return {type:'Dữ liệu mô phỏng / kiểm thử quy tắc và mạng giả lập',passed:results.filter(r=>r.passed).length,total:results.length,results};
}
if(typeof module!=='undefined')module.exports=runTests;

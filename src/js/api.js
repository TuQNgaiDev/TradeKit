/* Public Futures only. Shared cache and bounded queue across all UI generations. */
(function(root){
'use strict';
class FuturesClient{
  constructor({fetcher=globalThis.fetch.bind(globalThis),now=()=>Date.now(),timeout=12000,maxConcurrent=3}={}){
    this.fetcher=fetcher;this.now=now;this.timeout=timeout;this.maxConcurrent=maxConcurrent;
    this.active=0;this.queue=[];this.cache=new Map();this.pending=new Map();this.blockedUntil=0;
  }
  get(path,ttl=15000){
    const cached=this.cache.get(path);
    if(cached&&this.now()-cached.time<ttl)return Promise.resolve(cached.value);
    if(this.pending.has(path))return this.pending.get(path);
    if(this.now()<this.blockedUntil)return Promise.reject(Error('Binance giới hạn yêu cầu. Thử lại sau '+Math.ceil((this.blockedUntil-this.now())/1000)+' giây.'));
    const promise=new Promise((resolve,reject)=>{this.queue.push({path,resolve,reject});this.pump();});
    this.pending.set(path,promise);
    promise.then(()=>this.pending.delete(path),()=>this.pending.delete(path));return promise;
  }
  pump(){
    while(this.active<this.maxConcurrent&&this.queue.length){
      const job=this.queue.shift();this.active++;
      this.request(job.path).then(job.resolve,job.reject).finally(()=>{this.active--;this.pump();});
    }
  }
  async request(path){
    if(this.now()<this.blockedUntil)throw Error('Đang tạm ngừng yêu cầu do giới hạn Binance.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeout);
    try{
      const response=await this.fetcher('https://fapi.binance.com'+path,{signal:controller.signal,cache:'no-store'});
      if(!response.ok){
        if(response.status===429||response.status===418){
          const retry=response.headers.get('Retry-After');
          const seconds=retry&&Number.isFinite(Number(retry))?Number(retry):retry?Math.max(0,(Date.parse(retry)-this.now())/1000):60;
          this.blockedUntil=this.now()+Math.max(60,Number.isFinite(seconds)?seconds:60)*1000;
          throw Error('Binance giới hạn yêu cầu (HTTP '+response.status+'). Tạm dừng ít nhất '+Math.ceil((this.blockedUntil-this.now())/1000)+' giây.');
        }
        throw Error(response.status===451||response.status===403?'Binance từ chối truy cập (HTTP '+response.status+'); mạng hoặc khu vực có thể bị hạn chế.':'Lỗi Binance Futures (HTTP '+response.status+').');
      }
      const value=await response.json();
      if(value?.code<0)throw Error('Binance Futures: '+String(value.msg||value.code));
      this.cache.set(path,{time:this.now(),value});
      // LRU-like bounded insertion cache; old symbols cannot grow memory indefinitely.
      if(this.cache.size>80)this.cache.delete(this.cache.keys().next().value);
      return value;
    }catch(e){
      if(e.name==='AbortError')throw Error('Yêu cầu Binance quá thời gian (12 giây).');
      if(e instanceof TypeError)throw Error('Không truy cập được Binance Futures. Kiểm tra mạng, CORS hoặc giới hạn khu vực.');
      throw e;
    }finally{clearTimeout(timer);}
  }
  async exchange(){const info=await this.get('/fapi/v1/exchangeInfo',300000);if(!Array.isArray(info?.symbols))throw Error('exchangeInfo không hợp lệ.');return info;}
  validateSymbol(info,symbol){
    const contract=info.symbols.find(s=>s.symbol===symbol);
    if(!contract||contract.contractType!=='PERPETUAL'||contract.status!=='TRADING'||contract.quoteAsset!=='USDT'||contract.marginAsset!=='USDT')throw Error('Mã không phải hợp đồng vĩnh cửu USDT đang giao dịch theo exchangeInfo.');
    return contract;
  }
  async time(){const start=performance.now(),t=await this.get('/fapi/v1/time',0);if(!Number.isSafeInteger(t?.serverTime)||t.serverTime<=0)throw Error('Không xác nhận được thời gian máy chủ Binance.');return {serverTime:t.serverTime,receivedAt:performance.now(),roundTrip:performance.now()-start};}
  klines(symbol,frame){return this.get('/fapi/v1/klines?'+new URLSearchParams({symbol,interval:frame,limit:'501'}),15000);}
  ticker(symbol){return this.get('/fapi/v2/ticker/price?symbol='+encodeURIComponent(symbol));}
  mark(symbol){return this.get('/fapi/v1/premiumIndex?symbol='+encodeURIComponent(symbol));}
}
class LatestOnly{
  constructor(){this.version=0;}
  begin(){const version=++this.version;return ()=>version===this.version;}
}
root.CoinAPI={FuturesClient,LatestOnly};
})(globalThis);

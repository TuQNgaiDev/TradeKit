"""Read-only smoke check. Saves real responses for separately labelled verification."""
import json, urllib.request, urllib.error, datetime, pathlib, concurrent.futures
BASE='https://fapi.binance.com'
paths=['/fapi/v1/time','/fapi/v1/exchangeInfo']+[f'/fapi/v1/klines?symbol=SOLUSDT&interval={tf}&limit=501' for tf in ['15m','30m','1h','4h']]+['/fapi/v2/ticker/price?symbol=SOLUSDT','/fapi/v1/premiumIndex?symbol=SOLUSDT']
root=pathlib.Path(__file__).resolve().parent.parent/'qa'
root.mkdir(exist_ok=True)
def check(pair):
 i,path=pair
 try:
  with urllib.request.urlopen(BASE+path,timeout=15) as r:
   data=json.load(r); status=r.status; cors=r.headers.get('Access-Control-Allow-Origin')
  (root/f'live-{i}.json').write_text(json.dumps(data),encoding='utf-8')
  summary={'path':path,'status':status,'cors':cors}
  if 'klines' in path:summary['candles']=len(data)
  return summary
 except Exception as e:return {'path':path,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(check,enumerate(paths)))
report={'checked_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'type':'API trực tiếp, không mô phỏng','results':results}
(root/'live-api-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))

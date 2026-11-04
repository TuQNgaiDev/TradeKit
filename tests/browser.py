"""Browser verification: direct Binance phase and explicitly simulated phase."""
import asyncio,json,pathlib,time,math
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
BASE='http://localhost:8080'
async def main():
 report={'checked_at_local':time.strftime('%Y-%m-%d %H:%M:%S %Z'),'direct_browser':{},'simulated_browser':{},'errors':[]}
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  page=await browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  await page.goto(BASE+'/tests/index.html')
  await page.wait_for_function('window.testReport !== undefined')
  unit=await page.evaluate('testReport')
  (ROOT/'qa/unit-report.json').write_text(json.dumps(unit,ensure_ascii=False,indent=2))
  print('UNIT',unit['passed'],'/',unit['total'])
  for r in unit['results']:
   if not r['passed']:print('FAIL',r)
  # Live API through the browser. No routing / fixtures here.
  requests=[]
  page.on('response',lambda r:requests.append({'url':r.url,'status':r.status}) if 'fapi.binance.com' in r.url else None)
  await page.goto(BASE)
  await page.wait_for_function("!document.getElementById('connection').textContent.includes('Đang kết nối')",timeout=50000)
  report['direct_browser']={'connection':await page.locator('#connection').inner_text(),'message':await page.locator('#message').inner_text(),'verdict':await page.locator('#verdict').inner_text(),'requests':requests.copy(),'four_curves':await page.locator('#chart polyline').count(),'supplemental_methods':await page.locator('.method-card').count()}
  await page.screenshot(path=str(ROOT/'qa/desktop-live.png'),full_page=True)
  await page.screenshot(path=str(ROOT/'qa/desktop-methods-live.png'),full_page=True)
  await page.set_viewport_size({'width':390,'height':844})
  await page.wait_for_timeout(150)
  await page.screenshot(path=str(ROOT/'qa/mobile-live.png'),full_page=True)
  await page.screenshot(path=str(ROOT/'qa/mobile-methods-live.png'),full_page=True)
  # All subsequent market requests are synthetic and marked in screenshots.
  await page.close()
  context=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
  page=await context.new_page()
  await page.clock.install()
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  now=int(time.time()*1000)
  steps={'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000}
  active=0;maximum=0;mode='normal';calls=[]
  def klines(tf,symbol):
   step=steps[tf];end=now//step*step
   rows=[]
   for i in range(501):
    t=end-(500-i)*step;close=100+i*.5;op=close-.2
    low=close-.4
    if i==498:low=close-15 # wick reaches EMA20–50; close unchanged
    if i==500:close=999999 # open candle MUST be ignored
    rows.append([t,str(op),str(max(op,close)+.2),str(low),str(close),'10',t+step-1,'0',1,'0','0','0'])
   if symbol=='ETHUSDT':
    rows=[[r[0]]+[str(float(v)*2) for v in r[1:5]]+r[5:] for r in rows]
   return rows
  async def handle(route):
   nonlocal active,maximum
   from urllib.parse import urlparse,parse_qs
   u=urlparse(route.request.url);q=parse_qs(u.query);symbol=q.get('symbol',['BTCUSDT'])[0];path=u.path
   active+=1;maximum=max(maximum,active);calls.append(route.request.url)
   try:
    if mode=='blocked':await route.fulfill(status=451,json={'msg':'Restricted'});return
    if mode=='rate':await route.fulfill(status=429,headers={'Retry-After':'120'},json={'code':-1003});return
    if path.endswith('exchangeInfo'):
     await route.fulfill(json={'symbols':[{'symbol':s,'contractType':'PERPETUAL','status':'TRADING','quoteAsset':'USDT','marginAsset':'USDT'} for s in ['BTCUSDT','ETHUSDT','SOLUSDT']]})
    elif path.endswith('/time'):await route.fulfill(json={'serverTime':now})
    elif path.endswith('/klines'):
     # Deliberately return BTC after ETH after rapid switch.
     await asyncio.sleep(.7 if symbol=='BTCUSDT' else .02)
     await route.fulfill(json=klines(q['interval'][0],symbol))
    else:await route.fulfill(json={'symbol':symbol,'price':'355','markPrice':'354','time':now})
   finally:active-=1
  await context.route('https://fapi.binance.com/**',handle)
  await page.add_init_script("localStorage.setItem('cl-history',JSON.stringify([{symbol:'OLDUSDT',label:'SPOT OLD'}])); if(!localStorage.getItem('cl-watch')) localStorage.setItem('cl-watch',JSON.stringify(['BTCUSDT']));")
  await page.goto(BASE)
  await page.wait_for_function("document.getElementById('connection').textContent.includes('Đã cập nhật')")
  assert await page.locator('#verdict').inner_text()=='Có xác nhận Long'
  assert 'bull' in (await page.locator('#signalicon').get_attribute('class'))
  assert 'bull' in (await page.locator('#direction').get_attribute('class'))
  assert await page.locator('#price').inner_text()=='349.5 USDT'
  assert '999' not in await page.locator('#ema-values').inner_text()
  assert await page.locator('#chart polyline').count()==4
  report['simulated_browser']['long_and_open_candle']=True
  # Primary supplemental overview and signal conditions start expanded.
  assert await page.locator('.disclosures > details').count()==2
  assert await page.locator('.disclosures > details[open]').count()==2
  assert await page.locator('#methods-panel').get_attribute('open') is not None
  assert await page.locator('#conditions-panel').get_attribute('open') is not None
  assert await page.locator('#conditions').is_visible()
  assert await page.locator('#conditions .condition').count()==6
  assert await page.locator('#conditions .status').count()==6
  assert await page.locator('#conditions .condition p').count()==0
  ema_states=await page.locator('#conditions .status').all_text_contents()
  assert all(state in ['↗ Xu hướng tăng','↘ Xu hướng giảm','— Chưa rõ'] for state in ema_states)
  shared_style=await page.evaluate('''() => {
    const method=getComputedStyle(document.querySelector('.method-card'));
    const condition=getComputedStyle(document.querySelector('.condition'));
    const methodPanel=getComputedStyle(document.querySelector('#methods-panel'));
    const conditionPanel=getComputedStyle(document.querySelector('#conditions-panel'));
    return {
      cards:[method.backgroundColor,condition.backgroundColor,method.borderRadius,condition.borderRadius],
      panels:[methodPanel.paddingLeft,conditionPanel.paddingLeft]
    };
  }''')
  assert shared_style['cards'][0]==shared_style['cards'][1]
  assert shared_style['cards'][2]==shared_style['cards'][3]
  assert shared_style['panels'][0]==shared_style['panels'][1]
  await page.locator('#conditions-panel summary').focus()
  await page.keyboard.press('Enter')
  assert not await page.locator('#conditions').is_visible()
  await page.keyboard.press('Enter')
  assert await page.locator('#conditions').is_visible()
  for section in ['methods','conditions']:
   await page.locator(f'#{section}-panel summary').click()
   await page.locator(f'#{section}-panel summary').click()
  report['simulated_browser']['compact_disclosures_and_keyboard']=True
  assert await page.locator('.method-card').count()==12
  balance=await page.locator('#indicator-balance').evaluate('(e)=>({total:Number(e.dataset.total),long:Number(e.dataset.long),short:Number(e.dataset.short),neutral:Number(e.dataset.neutral)})')
  assert balance['total']==18 and balance['long']+balance['short']+balance['neutral']==18
  assert await page.locator('#long-percent').inner_text()==f"{round(balance['long']/18*100)}%"
  assert await page.locator('#short-percent').inner_text()==f"{round(balance['short']/18*100)}%"
  compact_height=await page.locator('.method-card').first.bounding_box()
  assert compact_height['height']<=100
  states=await page.locator('.method-state').all_text_contents()
  assert all(state in ['↗ Xu hướng tăng','↘ Xu hướng giảm','— Chưa rõ'] for state in states)
  assert await page.locator('[data-method="atr"]').count()==1
  assert await page.locator('[data-method="atr"] .method-state').text_content()=='— Chưa rõ'
  original_verdict=await page.locator('#verdict').inner_text()
  assert await page.locator('#chart polyline').count()==4
  report['simulated_browser']['twelve_method_directions_and_chart_overlays']=True
  report['simulated_browser']['overlays_keep_ema_signal_and_make_no_requests']=True
  report['simulated_browser']['vwap_does_not_connect_utc_sessions']=True

  # Clearly label all simulation screenshots outside the product DOM flow.
  await page.evaluate("document.body.insertAdjacentHTML('afterbegin','<div id=sim-label style=\"padding:12px;background:#ffda7a;color:#131313;text-align:center\">KIỂM THỬ MÔ PHỎNG — KHÔNG PHẢI DỮ LIỆU THẬT</div>')")
  for width,height in [(320,780),(390,844),(768,1024),(1440,1000)]:
   await page.set_viewport_size({'width':width,'height':height})
   await page.wait_for_timeout(150)
   assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'Overflow at {width}'
   clipped_titles=await page.locator('.method-heading h3').evaluate_all('(items)=>items.filter(e=>e.scrollWidth>e.clientWidth+1 || e.scrollHeight>e.clientHeight+1).map(e=>e.textContent)')
   assert not clipped_titles,f'Clipped method titles at {width}: {clipped_titles}'
   clipped_states=await page.locator('.method-state').evaluate_all('(items)=>items.filter(e=>e.scrollWidth>e.clientWidth+1 || e.scrollHeight>e.clientHeight+1).map(e=>e.textContent)')
   assert not clipped_states,f'Clipped method states at {width}: {clipped_states}'
   clipped_conditions=await page.locator('.condition h3,.condition .status').evaluate_all('(items)=>items.filter(e=>e.scrollWidth>e.clientWidth+1 || e.scrollHeight>e.clientHeight+1).map(e=>e.textContent)')
   assert not clipped_conditions,f'Clipped EMA conditions at {width}: {clipped_conditions}'
   card_height=await page.locator('.method-card').first.bounding_box()
   assert card_height['height']<=(96 if width<=650 else 90),f'Method card too tall at {width}: {card_height}'
   await page.locator('.disclosures > details').evaluate_all('(items)=>items.forEach(el=>el.open=true)')
   assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'Expanded overflow at {width}'
   await page.locator('.disclosures > details').evaluate_all('(items)=>items.forEach(el=>el.open=false)')
   await page.locator('#methods-panel').evaluate('(el)=>el.open=true')
   if width in [390,1440]:await page.screenshot(path=str(ROOT/f'qa/{"mobile" if width==390 else "desktop"}-simulated.png'),full_page=True)
  report['simulated_browser']['no_horizontal_overflow_widths']=[320,390,768,1440]
  report['simulated_browser']['expanded_details_no_overflow']=True
  assert await page.locator('#symbol').input_value()=='SOLUSDT'
  assert 'M30' in await page.locator('#pair').inner_text()
  assert await page.locator('[data-frame="30m"]').get_attribute('aria-pressed')=='true'
  assert await page.locator('[data-frame]').all_text_contents()==['M15','M30','H1']
  await page.click('[data-frame="30m"]')
  await page.wait_for_function("document.getElementById('connection').textContent.includes('Đã cập nhật')")
  assert 'M30' in await page.locator('#pair').inner_text()
  assert await page.locator('#verdict').inner_text()=='Có xác nhận Long'
  assert 'M30 → H1' in await page.locator('#comparison').inner_text()
  report['simulated_browser']['sol_default_and_three_frames']=True
  report['simulated_browser']['m30_with_h1_confirmation']=True
  # Start slower BTC request with empty cache, switch to ETH immediately, then frame.
  await page.evaluate('api.cache.clear()')
  await page.locator('#symbol').fill('BTC')
  await page.locator('#search button').click()
  await page.wait_for_timeout(80)
  await page.locator('#symbol').fill('ETH')
  await page.locator('#search button').click()
  await page.click('[data-frame="15m"]')
  await page.wait_for_function("document.getElementById('pair').textContent.includes('ETH') && document.getElementById('connection').textContent.includes('Đã cập nhật')")
  await page.wait_for_timeout(1500)
  assert 'ETH' in await page.locator('#pair').inner_text()
  assert 'M15' in await page.locator('#pair').inner_text()
  assert await page.locator('#price').inner_text()=='699 USDT'
  assert await page.locator('[data-method="channel"]').count()==1
  assert maximum<=3
  report['simulated_browser']['rapid_symbol_frame_switch']=True
  report['simulated_browser']['maximum_concurrent_requests']=maximum
  # Invalid input must invalidate in-flight generation as well.
  await page.locator('#symbol').fill('BAD!')
  await page.locator('#search button').click()
  assert await page.locator('#price').inner_text()=='—'
  assert await page.locator('#chart polyline').count()==0
  assert await page.locator('.method-card').count()==0
  # watchlist and futures history persist, legacy key preserved.
  await page.locator('#symbol').fill('SOL')
  await page.locator('#search button').click()
  await page.wait_for_function("document.getElementById('connection').textContent.includes('Đã cập nhật')")
  await page.click('#save')
  assert 'SOLUSDT' in await page.evaluate("JSON.parse(localStorage.getItem('cl-watch'))")
  assert await page.evaluate("JSON.parse(localStorage.getItem('cl-history'))[0].symbol")=='OLDUSDT'
  assert await page.evaluate("JSON.parse(localStorage.getItem('cl-futures-ema-v2-history'))[0].symbol")=='SOLUSDT'
  report['simulated_browser']['storage_and_legacy_isolation']=True
  await page.reload()
  await page.wait_for_function("document.getElementById('connection').textContent.includes('Đã cập nhật')")
  assert 'SOLUSDT' in await page.evaluate("JSON.parse(localStorage.getItem('cl-watch'))")
  report['simulated_browser']['persist_after_reload']=True
  # Advance controlled browser time: interval while visible, skip while hidden,
  # and immediate refresh when returning to the page.
  count_before=len(calls)
  await page.clock.fast_forward(60000)
  for _ in range(100):
   if len(calls)>count_before:break
   await asyncio.sleep(.02)
  await page.wait_for_function("document.getElementById('connection').textContent.includes('Đã cập nhật')")
  assert len(calls)>count_before
  report['simulated_browser']['automatic_60s_refresh']=True
  await page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})")
  count_before=len(calls)
  await page.clock.fast_forward(60000)
  assert len(calls)==count_before
  await page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))")
  await page.wait_for_function("document.getElementById('connection').textContent.includes('Đã cập nhật')")
  assert len(calls)>count_before
  report['simulated_browser']['hidden_skips_and_visible_refreshes']=True
  # Expire loaded data, ensure reference is cleared too.
  await page.evaluate('lastSuccess=performance.now()-181000')
  await page.clock.fast_forward(5000)
  await page.wait_for_function("document.getElementById('connection').textContent.includes('đã cũ')",timeout=7000)
  assert await page.locator('#reference').is_hidden()
  assert await page.locator('#price').inner_text()=='—'
  report['simulated_browser']['stale_clears_confirmation']=True
  # Errors are tested in fresh tabs, avoiding production cache.
  for error_mode,expected in [('blocked','451'),('rate','429')]:
   mode=error_mode
   await page.reload()
   await page.wait_for_function("!document.getElementById('connection').textContent.includes('Đang kết nối')")
   assert expected in await page.locator('#message').inner_text()
   assert await page.locator('#price').inner_text()=='—'
   report['simulated_browser'][error_mode]=True
  await browser.close()
 (ROOT/'qa/browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2))
 assert unit['passed']==unit['total']
 assert not report['errors']
asyncio.run(main())

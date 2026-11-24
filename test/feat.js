const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 });
  // 2026-11-25(수) 12:00 필리핀 시간 = 04:00 UTC 로 시계 고정
  await ctx.addInitScript(()=>{ const T=Date.UTC(2026,10,25,4,0); const _now=Date.now; const off=T-_now(); Date.now=()=>_now()+off; });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('.vc'); await pg.waitForTimeout(400);
  ok((await pg.$eval('.when',e=>e.textContent)).includes('2일차'),'home date = day 2 at fixed clock');
  ok((await pg.$$eval('.quick > *',e=>e.length))===5,'5 quick actions (weather first)');
  // phrases
  await pg.click('[data-phrases]'); await pg.waitForSelector('[data-phrase]'); const np=await pg.$$eval('[data-phrase]',e=>e.length); ok(np>=30,'phrase cards '+np);
  await pg.click('[data-phrase="0-2"]'); ok((await pg.$eval('#driver .big',e=>e.textContent))==='No ice, please.','phrase fullscreen'); await pg.screenshot({path:'test/f-phrase.png'});
  await pg.click('[data-closedriver]'); await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('[data-expadd2]');
  // expenses
  await pg.click('[data-expadd2]'); await pg.waitForSelector('#ex-what');
  await pg.fill('#ex-what','Subo 저녁'); await pg.fill('#ex-amt','6000'); await pg.click('[data-expsave]'); await pg.waitForTimeout(400);
  await pg.click('[data-expadd2]'); await pg.fill('#ex-what','환전 전 택시'); await pg.fill('#ex-amt','20'); await pg.click('[data-cur="USD"]'); await pg.fill('#ex-payer','엄마'); await pg.click('[data-expsave]'); await pg.waitForTimeout(400);
  const ep=await pg.$eval('#expPanel',e=>e.innerText); ok(/7,278/.test(ep),'expense total ₱6,000 + $20(₱1,278) = ₱7,278: '+ep.split('\n').slice(1,3).join(' '));
  await pg.goto('http://localhost:8765/_test_live.html#ledger'); await pg.waitForSelector('#lbody table'); const st=await pg.$eval('#lbody',e=>e.innerText); console.log('  ledger:', st.split('\n').slice(1,8).join(' | '));
  ok(/수복/.test(st)&&/엄마/.test(st)&&/₱7,278/.test(st),'who-spent table and total ₱7,278'); await pg.screenshot({path:'test/f-settle.png'}); await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('.vc');
  await pg.screenshot({path:'test/f-home.png',fullPage:true});
  // eat: open filter + badges
  await pg.click('.nav a[data-tab="eat"]'); await pg.waitForSelector('#vlist .vc');
  const badges=await pg.$$eval('#vlist .vc .meta .badge',e=>e.map(x=>x.textContent));
  const open=badges.filter(t=>/영업 중|24시간|곧 마감/.test(t)).length, unk=badges.filter(t=>/미확인/.test(t)).length;
  ok(open>20,'open badges at noon: '+open+' open / '+unk+' unknown / '+badges.length+' total');
  await pg.click('[data-efil="open"]'); await pg.waitForTimeout(100); const no=await pg.$$eval('#vlist .vc',e=>e.length); ok(no===open,'open filter count '+no);
  await pg.click('[data-efil="open"]'); await pg.click('[data-ecat="fruit"]'); await pg.waitForTimeout(100); ok((await pg.$$eval('#vlist .vc',e=>e.length))>=8,'fruit filter in eat');
  await pg.screenshot({path:'test/f-eat.png'});
  // detail weekly hours
  await pg.goto('http://localhost:8765/_test_live.html#p-v-shop-n11010640771'); await pg.waitForTimeout(500);
  const hrs=await pg.$eval('#sheet .kv',e=>e.innerText); ok(/08:00–17:30/.test(hrs)&&/영업 중/.test(hrs),'Palawan hours + open: '+hrs.split('\n').slice(0,4).join(' '));
  // info: money + fruit
  await pg.goto('http://localhost:8765/_test_live.html#info'); await pg.waitForTimeout(500);
  const inf=await pg.evaluate(()=>document.body.textContent); ok(/환전소 · 은행/.test(inf)&&/과일 가게/.test(inf)&&/한국에 가져갈 수 없어요/.test(inf),'info has changers, fruit, quarantine');
  await pg.evaluate(()=>{const d=[...document.querySelectorAll('details.fold')].find(x=>x.textContent.includes('환전소 · 은행')); if(d){d.open=true; d.scrollIntoView();}}); await pg.screenshot({path:'test/f-money.png'});
  // map chips
  await pg.goto('http://localhost:8765/_test_live.html#map'); await pg.waitForSelector('.chip[data-cat="money"]');
  await pg.click('.chip[data-cat="money"]'); await pg.waitForTimeout(200); ok((await pg.$$eval('.pin:not(.dim)',e=>e.length))===9,'map money pins 9');
  await pg.click('.chip[data-cat="fruit"]'); await pg.waitForTimeout(200); ok((await pg.$$eval('.pin:not(.dim)',e=>e.length))===11,'map fruit pins 11');
  await pg.screenshot({path:'test/f-map.png'});
  const hs=await pg.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]); ok(hs[0]<=hs[1],'no hscroll');
  console.log('errors', JSON.stringify(errs)); await b.close();
})();

const { chromium, devices } = require('playwright');
function fake(){ const hours={}, days={}; ["2026-11-24","2026-11-25","2026-11-26","2026-11-27","2026-11-28"].forEach((d,di)=>{ for(let h=0;h<24;h++){ const day=h>=6&&h<18?1:0; hours[d+"T"+String(h).padStart(2,"0")+":00"]=[h<12?1:(di===2?61:2),26+Math.round(4*Math.sin((h-6)/12*Math.PI)),30,di===2?60:10,day?Math.max(0,Math.round(11*Math.sin((h-6)/12*Math.PI))):0,14,day]; } days[d]={code:di===2?61:2,tmin:26,tmax:31,rain:di===2?60:10,uv:11,sunrise:"06:02",sunset:"17:25",wind:18}; }); return {updated:"2026-11-24 06:05",src:"Open-Meteo",hours,days}; }
(async () => {
  const b = await chromium.launch(); const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m); const errs=[];
  const ctx=await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 });
  await ctx.route('**/weather.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(fake())}));
  const pg=await ctx.newPage(); pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('#wxCard .wxnow'); await pg.waitForTimeout(300);
  const card=await pg.$eval('#wxCard',e=>e.innerText); ok(/보라카이/.test(card)&&/자외선 최고/.test(card)&&/일몰 17:25/.test(card),'home weather card: '+card.replace(/\n+/g,' | ').slice(0,160));
  ok(await pg.evaluate(()=>document.querySelector('#pin').getBoundingClientRect().bottom<=document.querySelector('#wxCard').getBoundingClientRect().top+1),'weather card right under notice');
  await pg.screenshot({path:'test/wx-home.png'});
  await pg.goto('http://localhost:8765/_test_live.html#course'); await pg.waitForSelector('.wxday'); await pg.waitForTimeout(300);
  ok((await pg.$$eval('.wxday',e=>e.length))===5,'daily weather on all 5 days');
  const chips=await pg.$$eval('.wxc',e=>e.length); ok(chips>=12,'weather chips on timed slots: '+chips);
  const d1=await pg.$$eval('.day:first-of-type .slot',e=>e.map(x=>(x.querySelector('time')||{}).textContent+':'+(x.querySelector('.wxc')?'Y':'-')).join(' ')); console.log('  d1:',d1);
  ok(/09:20:-/.test(d1),'no Boracay weather on Incheon departure');
  await pg.locator('.day').nth(2).scrollIntoViewIfNeeded(); await pg.screenshot({path:'test/wx-course.png'});
  const hs=await pg.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]); ok(hs[0]<=hs[1],'no hscroll');
  console.log('errors',JSON.stringify(errs)); await b.close();
})();

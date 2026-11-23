const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
  await pg.goto('http://localhost:8765/_test_live.html#info'); await pg.waitForSelector('.pg-row',{state:'attached'}); await pg.waitForTimeout(300);
  const tabs=await pg.$$eval('.nav a',e=>e.map(x=>x.textContent.replace(/[0-9+]/g,'').trim())); ok(tabs.join(',')==='홈,돈·정보,지출·예약,맛집,지도,코스,회화','nav order: '+tabs.join(','));
  const groups=await pg.$$eval('.panel h3',e=>e.map(x=>x.textContent.trim())); ok(['패스트푸드','필리핀 현지식','양식','해산물','카페 음료','디저트·쉐이크','주류·음료'].every(g=>groups.some(h=>h.startsWith(g))),'all category groups present');
  ok(!(await pg.evaluate(()=>document.body.innerText.includes('식사 적정 총액'))),'per-restaurant total table removed');
  const row=await pg.$eval('.pg-row',e=>e.textContent); console.log('  first row:',row.replace(/\n/g,' | '));
  await pg.selectOption('#ck-m',{label:'시시그'}); await pg.fill('#ck-p','450'); await pg.waitForTimeout(100);
  const v1=await pg.$eval('#ck-out',e=>e.innerText); ok(/적정해요/.test(v1)&&/₩/.test(v1),'checker 시시그 ₱450 → '+v1.split('\n')[0]);
  await pg.fill('#ck-p','900'); await pg.waitForTimeout(100); ok(/비싼 편이에요/.test(await pg.$eval('#ck-out',e=>e.innerText)),'checker ₱900 → 비싼 편');
  await pg.fill('#ck-p','200'); await pg.waitForTimeout(100); ok(/저렴/.test(await pg.$eval('#ck-out',e=>e.innerText)),'checker ₱200 → 저렴');
  await pg.screenshot({path:'test/m-1.png'});  await pg.screenshot({path:'test/m-2.png'});
  const hs=await pg.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]); ok(hs[0]<=hs[1],'no hscroll');
  console.log('errors',JSON.stringify(errs)); await b.close();
})();

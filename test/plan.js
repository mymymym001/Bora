const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
  await pg.goto('http://localhost:8765/_test_live.html#course'); await pg.waitForSelector('.slot.meal'); await pg.waitForTimeout(400);
  const meals=await pg.$$eval('.slot.meal',e=>e.length); ok(meals===8,'8 meal slots (d1 lunch+dinner, d2-4 lunch+dinner)');
  ok((await pg.$$eval('.slot.meal .fine',e=>e.filter(x=>x.textContent.includes('아직 안 정했어요')).length))===8,'all meals start empty (no preset restaurants)');
  const b1=await pg.$eval('.slot.meal .bud',e=>e.innerText); ok(/인당 ₱[\d,]+–[\d,]+ \/ ₩[\d,]+–[\d,]+/.test(b1)&&/총 7명/.test(b1),'budget line format: '+b1.split('\n')[0]);
  ok((await pg.$$eval('.slot.fouru',e=>e.length))===2,'4U pickup rows on arrival and departure');
  const tot0=await pg.$eval('.panel.num p',e=>e.innerText); console.log('  trip total (defaults):',tot0.replace(/\n/g,' | '));
  await pg.screenshot({path:'test/c-1.png'});
  // pick from list for d2 lunch
  await pg.click('[data-pickmeal="d2-lunch"]'); await pg.waitForSelector('#pm-list button');
  await pg.fill('#pm-q','Smoke'); await pg.waitForTimeout(100); await pg.click('#pm-list button >> nth=0'); await pg.waitForTimeout(400);
  const d2=await pg.$eval('[data-pickmeal="d2-lunch"]',e=>e.closest('.slot').innerText); ok(/Smoke/.test(d2)&&/Smoke Resto 1인 예상/.test(d2),'picked Smoke for 11/25 lunch: '+d2.split('\n').slice(1,3).join(' '));
  // custom text + budget for d2 dinner
  await pg.click('[data-pickmeal="d2-dinner"]'); await pg.waitForSelector('#pm-text'); await pg.fill('#pm-text','리조트 바비큐 뷔페'); await pg.fill('#pm-bud','900'); await pg.click('[data-mealsave]'); await pg.waitForTimeout(400);
  const d2d=await pg.$eval('[data-pickmeal="d2-dinner"]',e=>e.closest('.slot').innerText); ok(/리조트 바비큐 뷔페/.test(d2d)&&/인당 ₱900/.test(d2d)&&/총 7명 ₱6,300/.test(d2d),'custom dinner + budget: '+d2d.split('\n').slice(1,3).join(' '));
  // 4U time
  await pg.click('[data-edit4u="4u-depart"]'); await pg.fill('#pt-text','11/28 07:30 로비'); await pg.click('[data-textsave]'); await pg.waitForTimeout(400);
  ok((await pg.$eval('[data-edit4u="4u-depart"]',e=>e.closest('.slot').innerText)).includes('07:30 로비'),'4U departure time saved');
  // memo
  await pg.click('[data-editmemo="d3-memo"]'); await pg.fill('#pt-text','10:00 아일랜드 호핑'); await pg.click('[data-textsave]'); await pg.waitForTimeout(300);
  ok((await pg.evaluate(()=>document.body.innerText)).includes('10:00 아일랜드 호핑'),'memo saved');
  const chat=[...(await pg.evaluate(()=>[...window.__mockStore.entries()].filter(([k])=>k.startsWith('chat/')).map(([k,v])=>v.text)))]; ok(chat.some(t=>t.includes('[일정]'))&&chat.some(t=>t.includes('[4U]')),'plan changes announced in chat');
  ok((await pg.evaluate(()=>[...window.__mockStore.keys()].filter(k=>k.startsWith('plan/')).length))===4,'4 plan docs stored (shared)');
  await pg.screenshot({path:'test/c-2.png',fullPage:false}); await pg.locator('[data-pickmeal="d2-lunch"]').scrollIntoViewIfNeeded(); await pg.screenshot({path:'test/c-3.png'});
  await pg.click('.nav a[data-tab="home"]'); await pg.waitForSelector('.day'); ok((await pg.$eval('.day',e=>e.innerText)).includes('4U'),'home today card shows plan');
  const hs=await pg.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]); ok(hs[0]<=hs[1],'no hscroll');
  console.log('errors', JSON.stringify(errs)); await b.close();
})();

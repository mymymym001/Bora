const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  const bad=[]; pg.on('response',r=>{ if(r.url().includes('/img/')&&r.status()!==200) bad.push(r.url()); });
  const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('#scenic img'); await pg.waitForTimeout(600);
  const loaded=await pg.$$eval('#scenic img',e=>e.filter(i=>i.complete&&i.naturalWidth>0).length); ok(loaded>=1,'home scenic photos loaded: '+loaded);
  await pg.screenshot({path:'test/p-home.png'});
  await pg.click('[data-scenic="0"]'); ok(await pg.isVisible('#viewer img'),'scenic fullscreen'); await pg.click('[data-vnext]'); ok((await pg.$eval('#viewer .vt span',e=>e.textContent))==='2 / 3','viewer next'); await pg.click('[data-vclose]');
  await pg.goto('http://localhost:8765/_test_live.html#p-aria'); await pg.waitForSelector('#gal img'); await pg.waitForTimeout(600);
  const n=await pg.$$eval('#gal img',e=>e.filter(i=>i.complete&&i.naturalWidth>0).length); ok(n===3,'Aria gallery 3 photos loaded');
  const cap=await pg.$eval('#gal .cap',e=>e.textContent); ok(/CC BY/.test(cap),'caption has license: '+cap);
  await pg.screenshot({path:'test/p-aria.png'});
  await pg.click('#gal [data-view="1"]'); await pg.waitForSelector('#viewer img'); await pg.screenshot({path:'test/p-viewer.png'});
  ok(bad.length===0,'no broken images '+bad.join(','));
  console.log('errors', JSON.stringify(errs)); await b.close();
})();

const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8765/_test.html#map'); await pg.waitForSelector('.card');
  const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
  for (const cat of ['all','restaurant','cafe','convenience','h24','pharmacy','bar']) {
    await pg.click(`.chip[data-cat="${cat}"]`); await pg.waitForTimeout(150);
    const n = await pg.$eval(`.chip[data-cat="${cat}"] .n`, e=>+e.textContent);
    const lit = await pg.$$eval('.pin:not(.dim), .dp:not(.dim)', e=>e.length); const big = await pg.$$eval('.pin:not(.dim)', e=>e.length); const cards = await pg.$$eval('.card', e=>e.length);
    ok(n===lit && Math.min(60,big)===cards, `filter ${cat}: chip=${n} lit(pins+dots)=${lit} researched pins=${big} cards=${cards}`);
  }
  await pg.click('.chip[data-cat="restaurant"]');
  const c7 = await pg.$eval('.card .cost', e=>e.textContent); const first7 = await pg.$eval('.card h3', e=>e.textContent);
  await pg.click('.seg button[data-n="2"]'); await pg.waitForTimeout(150);
  const c2 = await pg.$eval('.card .cost', e=>e.textContent); const first2 = await pg.$eval('.card h3', e=>e.textContent);
  ok(c7!==c2, `party 7→2 cost: "${c7}" → "${c2}"`); console.log('  top pick 7:', first7, '| 2:', first2);
  const order2 = await pg.$$eval('.card h3', e=>e.map(x=>x.textContent).join(', ')); await pg.click('.seg button[data-n="7"]'); await pg.waitForTimeout(150);
  const order7 = await pg.$$eval('.card h3', e=>e.map(x=>x.textContent).join(', '));
  ok(order2!==order7, 'ranking changes with party size'); await pg.click('.chip[data-cat="all"]');
  await pg.click('#zhome'); await pg.waitForTimeout(400); await pg.locator('.pin[aria-label="LJ Pharmacy"]').click(); await pg.waitForTimeout(200);
  const sel = await pg.$eval('.card[aria-current="true"] h3', e=>e.textContent).catch(()=>null);
  const retT = await pg.$eval('.ret h3', e=>e.textContent); ok(sel && retT.startsWith(sel), `pin tap selects card+return: ${sel}`);
  await pg.click('.mode[data-mode="trike"]'); ok(await pg.$eval('.mode[data-mode="trike"]',e=>e.getAttribute('aria-pressed'))==='true','trike mode toggle');
  await pg.click('#ret [data-driver]'); ok(await pg.isVisible('#driver'),'driver card opens'); await pg.click('[data-closedriver]'); ok(!(await pg.isVisible('#driver')),'driver card closes');
  await pg.click('.card .more'); await pg.waitForTimeout(200); ok(await pg.isVisible('#sheet'),'detail opens: '+await pg.$eval('#sheet .t',e=>e.textContent));
  await pg.click('[data-onmap]'); await pg.waitForTimeout(400); ok(!(await pg.isVisible('#sheet')) && await pg.isVisible('#cv'),'지도에서 경로 보기 returns to map');
  for (const id of ['zin','zout','zhome']) { await pg.click('#'+id); } ok(true,'map buttons clicked');
  for (const t of ['home','eat','course','info','map']) { await pg.click(`.nav a[data-tab="${t}"]`); await pg.waitForTimeout(200); ok((await pg.evaluate(()=>location.hash))==='#'+t,'tab '+t); }
  await pg.click('.nav a[data-tab="eat"]'); await pg.click('#vlist .vc .tt button >> nth=0'); await pg.waitForTimeout(200); ok(await pg.isVisible('#sheet'),'course link opens place');
  await pg.click('[data-close]'); await pg.waitForTimeout(200); ok(!(await pg.isVisible('#sheet')),'close button');
  await pg.goto('http://localhost:8765/_test.html#prices'); await pg.click('[data-fxm="usd"]'); await pg.fill('#fx-in','200');
  ok((await pg.$eval('#fx-main',e=>e.textContent))==='12,600','USD 200 → ₱'+await pg.$eval('#fx-main',e=>e.textContent)+' '+await pg.$eval('#fx-sub',e=>e.textContent));
  const links = await pg.$$eval('a[href^="http"]', e=>e.length); console.log('external links on prices:', links);
  console.log('errors', JSON.stringify(errs)); await b.close();
})();

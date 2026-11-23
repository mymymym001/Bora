const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light','dark']) {
    const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, colorScheme: scheme });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
    const o = 'test/'+scheme;
    await pg.goto('http://localhost:8765/_test.html#map'); await pg.waitForSelector('.card'); await pg.waitForTimeout(500);
    await pg.screenshot({ path: o+'-1map.png' });
    await pg.goto('http://localhost:8765/_test.html#p-aria'); await pg.waitForTimeout(400);
    await pg.screenshot({ path: o+'-2detail.png' });
    await pg.locator('#sheet').evaluate(e=>e.scrollTop=700); await pg.waitForTimeout(150);
    await pg.screenshot({ path: o+'-3detail2.png' });
    for (const t of ['course','prices','info']) { await pg.goto('http://localhost:8765/_test.html#'+t); await pg.waitForTimeout(300); await pg.screenshot({ path: o+'-4'+t+'.png' }); }
    const ov = await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
    console.log(scheme,'errors:', JSON.stringify(errs), 'hscroll:', ov);
    await ctx.close();
  }
  await b.close();
})();

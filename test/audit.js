const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg=await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage();
  for (const t of ['home','info','ledger','eat','map','course','talk']) {
    await pg.goto('http://localhost:8765/_test_live.html#'+t); await pg.waitForTimeout(900);
    await pg.screenshot({path:'test/au-'+t+'.png',fullPage:true});
    const h=await pg.evaluate(()=>document.documentElement.scrollHeight); console.log(t,h);
  }
  await pg.goto('http://localhost:8765/_test_live.html#p-subo'); await pg.waitForTimeout(900); await pg.screenshot({path:'test/au-detail.png'});
  await b.close();
})();

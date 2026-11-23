const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1, colorScheme:'dark' })).newPage();
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('.vc'); await pg.waitForTimeout(500);
  const bg=await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor); console.log('body bg in dark-mode phone:', bg);
  await pg.screenshot({path:'test/dark-home.png'}); await b.close();
})();

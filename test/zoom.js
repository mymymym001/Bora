const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage();
  await pg.goto('http://localhost:8765/_test.html#map'); await pg.waitForSelector('.card');
  for (let i=0;i<5;i++){ await pg.click('#zout'); await pg.waitForTimeout(380); }
  await pg.locator('#mapbox').screenshot({ path: 'test/b-zoomout.png' });
  await b.close();
})();

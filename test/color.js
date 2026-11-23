const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m); const errs=[];
  const pg=await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage(); pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('#chat .msg'); await pg.waitForTimeout(300);
  const momC=await pg.$eval('#chat .msg',e=>e.style.getPropertyValue('--uc')); ok(/^#/.test(momC),'existing messages get a stable color: '+momC);
  await pg.click('[data-profile]'); await pg.waitForSelector('.colors'); ok((await pg.$$eval('.colors button',e=>e.length))===8,'8 color choices');
  await pg.click('[data-ucolor="#30A46C"]'); await pg.click('[data-saveprofile]'); await pg.waitForTimeout(300);
  await pg.fill('#chatIn','초록색 테스트'); await pg.click('.chatform .send'); await pg.waitForTimeout(400);
  const mine=await pg.$eval('#chat .msg.mine:last-child',e=>[e.style.getPropertyValue('--uc'),getComputedStyle(e.querySelector('.t')).borderLeftColor]);
  ok(mine[0]==='#30A46C'&&mine[1]==='rgb(48, 164, 108)','my bubble uses my color: '+mine.join(' '));
  await pg.screenshot({path:'test/color-chat.png'});
  await pg.click('[data-pick]'); await pg.waitForSelector('[data-pickhotel]'); await pg.click('[data-pickhotel]'); await pg.waitForTimeout(500);
  ok((await pg.$eval('.ava.me',e=>e.style.getPropertyValue('--uc')))==='#30A46C','map avatar ring uses my color');
  console.log('errors',JSON.stringify(errs)); await b.close();
})();

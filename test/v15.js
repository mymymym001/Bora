const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m); const errs=[];
  const pg=await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage(); pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8765/_test_live.html#eat'); await pg.waitForSelector('#vlist .vc'); await pg.waitForTimeout(600);
  // unread badge: mock has msgs from mom unseen
  ok(await pg.isVisible('.nav a[data-tab="home"] .nb'),'unread badge on 홈 tab: '+(await pg.$eval('.nav a[data-tab="home"] .nb',e=>e.textContent).catch(()=>'none')));
  await pg.click('.nav a[data-tab="home"]'); await pg.waitForSelector('#chat .msg'); await pg.waitForTimeout(300);
  ok(!(await pg.isVisible('.nav a[data-tab="home"] .nb')),'badge cleared after opening home');
  // clock
  const ck=await pg.$eval('#clock',e=>e.innerText); ok(/필리핀 \d\d:\d\d/.test(ck)&&/한국 \d\d:\d\d/.test(ck),'clock: '+ck.replace(/\n/g,' '));
  // send + delete own message
  await pg.fill('#chatIn','삭제 테스트'); await pg.click('.chatform .send'); await pg.waitForTimeout(400);
  const before=await pg.$$eval('.msg',e=>e.length);
  await pg.locator('.msg.mine [data-msgdel]').last().click(); ok(/한 번 더/.test(await pg.locator('.msg.mine [data-msgdel]').last().textContent()),'delete asks to confirm');
  await pg.locator('.msg.mine [data-msgdel]').last().click(); await pg.waitForTimeout(400);
  ok((await pg.$$eval('.msg',e=>e.length))===before-1,'own message deleted');
  // big text
  await pg.click('[data-bigtext]'); ok(await pg.evaluate(()=>document.documentElement.classList.contains('big')),'big text on');
  await pg.reload(); await pg.waitForSelector('#chat'); ok(await pg.evaluate(()=>document.documentElement.classList.contains('big')),'big text remembered');
  let hs=await pg.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]); ok(hs[0]<=hs[1]+1,'no hscroll in big text '+hs);
  await pg.screenshot({path:'test/v15-big.png'}); await pg.click('[data-bigtext]');
  // SOS
  await pg.goto('http://localhost:8765/_test_live.html#talk'); await pg.waitForSelector('.sos'); ok(/911/.test(await pg.$eval('.sos',e=>e.innerText)),'SOS card on 회화 tab');
  await pg.click('[data-sos]'); ok(/Please help us/.test(await pg.$eval('#driver',e=>e.innerText)),'SOS phrase fullscreen'); await pg.click('[data-closedriver]');
  await pg.screenshot({path:'test/v15-talk.png'});
  // meal picker likes first
  await pg.goto('http://localhost:8765/_test_live.html#course'); await pg.waitForSelector('[data-pickmeal]'); await pg.click('[data-pickmeal="d2-lunch"]'); await pg.waitForSelector('#pm-list button');
  const first=await pg.$eval('#pm-list button',e=>e.innerText); ok(/Subo/.test(first)&&/가족 3/.test(first),'meal picker shows family-liked first: '+first.split('\n')[0]);
  console.log('errors',JSON.stringify(errs)); await b.close();
})();

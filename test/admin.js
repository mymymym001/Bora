const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m); const errs=[];
  // owner
  let pg = await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage(); pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('#pin .pin-notice'); await pg.waitForTimeout(300);
  ok(await pg.isVisible('[data-noticeedit]'),'owner sees empty notice block with 공지 쓰기');
  ok(await pg.isVisible('#noticeToggle'),'owner has 공지 toggle in chat');
  await pg.click('[data-noticeedit]'); await pg.fill('#nt-text','내일 07:30 로비 집합! 여권 챙기기'); await pg.click('[data-noticesave]'); await pg.waitForTimeout(400);
  ok((await pg.$eval('#pin',e=>e.innerText)).includes('07:30 로비 집합'),'notice pinned above chat');
  await pg.click('[data-schedpick]'); await pg.waitForSelector('[data-schedset]'); const n=await pg.$$eval('[data-schedset]',e=>e.length); ok(n>15,'schedule entries to choose: '+n);
  await pg.locator('[data-schedset]').filter({hasText:'4U'}).first().click(); await pg.waitForTimeout(400);
  const pin=await pg.$eval('#pin',e=>e.innerText); ok(/다음 일정/.test(pin)&&/4U/.test(pin),'next schedule pinned: '+pin.replace(/\n+/g,' | ').slice(0,120));
  await pg.click('#noticeToggle'); await pg.fill('#chatIn','저녁 6시 디몰 입구'); await pg.click('.chatform .send'); await pg.waitForTimeout(400);
  ok((await pg.$eval('#pin .nt',e=>e.textContent)).includes('디몰 입구'),'공지 toggle message replaces pinned text');
  ok((await pg.$$eval('.msg .badge.ok',e=>e.length))>0,'admin badge on owner messages');
  const top=await pg.evaluate(()=>{const p=document.querySelector('#pin').getBoundingClientRect().top, c=document.querySelector('#chat').getBoundingClientRect().top; return p<c;}); ok(top,'pin is above chat');
  await pg.screenshot({path:'test/a-owner.png'});
  // guest
  const ctx=await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 }); await ctx.addInitScript(()=>{window.__guest=true;});
  pg=await ctx.newPage(); pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('#pin .pin-notice'); await pg.waitForTimeout(300);
  const g=await pg.$eval('#pin',e=>e.innerText); ok(/🚨공지🚨/.test(g)&&/07:30 로비 집합/.test(g)&&/Smoke Resto/.test(g),'guest sees pinned notice + next schedule');
  ok(!(await pg.isVisible('[data-noticeedit]'))&&!(await pg.isVisible('#noticeToggle')),'guest cannot edit notice or use 공지 toggle');
  await pg.screenshot({path:'test/a-guest.png'});
  console.log('errors', JSON.stringify(errs)); await b.close();
})();

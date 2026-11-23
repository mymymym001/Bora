const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m); const errs=[];
  const pg=await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage(); pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('#likeRank .plist'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>document.documentElement.classList.contains('dark')),'default theme is dark');
  const rank=await pg.$eval('#likeRank',e=>e.innerText); ok(/^1\s*Subo/m.test(rank.replace(/\n/g,' ').trim())||rank.indexOf('Subo')<rank.indexOf('Aria'),'home family ranking: '+rank.replace(/\n+/g,' | ').slice(0,120));
  const tabs=await pg.$$eval('.nav a',e=>e.map(x=>x.textContent.replace(/[0-9+]/g,'').trim())); ok(tabs.length===7&&tabs[6]==='회화','7 tabs incl. 회화: '+tabs.join(','));
  await pg.screenshot({path:'test/l-home.png'});
  await pg.click('.nav a[data-tab="eat"]'); await pg.waitForSelector('#vlist .vc');
  // like Subo -> 4 likes = majority
  await pg.fill('#q','Subo'); await pg.waitForTimeout(200);
  await pg.click('#vlist [data-like="subo"]'); await pg.waitForTimeout(300);
  const lb=await pg.$eval('#vlist [data-likebox="subo"]',e=>e.innerText); ok(/4/.test(lb)&&/가족 다수 찜/.test(lb),'like toggles, majority badge: '+lb.replace(/\n/g,' '));
  await pg.fill('#q',''); await pg.waitForTimeout(150);
  await pg.click('[data-efil="mine"]'); await pg.waitForTimeout(150); ok((await pg.$$eval('#vlist .vc',e=>e.length))===1,'내 찜 filter shows only mine');
  await pg.click('[data-efil="mine"]'); await pg.click('[data-efil="fam"]'); await pg.click('[data-sort="likes"]'); await pg.waitForTimeout(150);
  const fam=await pg.$$eval('#vlist .vc h3',e=>e.map(x=>x.textContent)); ok(fam.length===2&&/Subo/.test(fam[0]),'가족 찜 + 찜 많은 순: '+fam.join(' / '));
  await pg.click('[data-efil="fam"]'); await pg.click('[data-sort="rating"]');
  await pg.evaluate(()=>window.scrollTo(0,1500)); await pg.waitForTimeout(200);
  const st=await pg.$eval('.sortbar',e=>e.getBoundingClientRect().top); ok(st<40,'sort bar stays at top when scrolling ('+Math.round(st)+'px)');
  await pg.screenshot({path:'test/l-eat.png'});
  const covers=await pg.$$eval('#vlist .vc .th',e=>e.length), cards=await pg.$$eval('#vlist .vc',e=>e.length); ok(covers===cards,'every card has a cover area ('+covers+'/'+cards+')');
  // unlike
  await pg.goto('http://localhost:8765/_test_live.html#p-subo'); await pg.waitForSelector('#sheet [data-like]'); await pg.click('#sheet [data-like]'); await pg.waitForTimeout(300);
  ok(/3/.test(await pg.$eval('#sheet [data-likebox]',e=>e.innerText)),'unlike from detail');
  // talk tab
  await pg.goto('http://localhost:8765/_test_live.html#talk'); await pg.waitForSelector('[data-phrase]'); ok((await pg.$$eval('[data-phrase]',e=>e.length))>=34,'회화 tab phrases');
  await pg.screenshot({path:'test/l-talk.png'});
  // theme switch to light and persisted
  await pg.click('[data-themetoggle]'); await pg.reload(); await pg.waitForSelector('[data-phrase]'); ok(!(await pg.evaluate(()=>document.documentElement.classList.contains('dark'))),'light choice remembered');
  const hs=await pg.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]); ok(hs[0]<=hs[1],'no hscroll');
  console.log('errors',JSON.stringify(errs)); await b.close();
})();

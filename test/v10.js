const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m); const errs=[];
  // fresh visitor: onboarding
  let ctx=await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 }); await ctx.addInitScript(()=>{window.__fresh=true; window.__guest=true;});
  let pg=await ctx.newPage(); pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('#nick',{timeout:8000});
  ok((await pg.$eval('#sheet',e=>e.innerText)).includes('먼저 이름과 캐릭터'),'first visit asks name + avatar');
  await pg.fill('#nick','하숙'); await pg.click('[data-char="🐬"]'); await pg.click('[data-saveprofile]'); await pg.waitForTimeout(300);
  ok((await pg.$eval('[data-profile]',e=>e.textContent)).includes('하숙'),'profile saved');
  // guest can write notice
  ok(await pg.isVisible('[data-noticeedit]'),'non-owner family can edit notice');
  await pg.click('[data-noticeedit]'); await pg.fill('#nt-text','저녁 7시 로비'); await pg.click('[data-noticesave]'); await pg.waitForTimeout(400);
  ok((await pg.$eval('#pin',e=>e.innerText)).includes('하숙'),'notice shows writer name');
  const order=await pg.evaluate(()=>{const p=document.querySelector('#pin').getBoundingClientRect().top, g=document.querySelector('#scenic').getBoundingClientRect().top, c=document.querySelector('#chat').getBoundingClientRect().top; return g<p&&p<c;}); ok(order,'sea photo above notice, notice above chat');
  await pg.screenshot({path:'test/v-home.png'});
  // theme
  await pg.click('[data-themetoggle]'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor)==='rgb(243, 246, 245)','toggle from default dark to light'); await pg.screenshot({path:'test/v-dark.png'});
  await pg.reload(); await pg.waitForSelector('#chat'); ok(!(await pg.evaluate(()=>document.documentElement.classList.contains('dark'))),'light choice remembered');
  await pg.click('[data-themetoggle]'); ok(await pg.evaluate(()=>document.documentElement.classList.contains('dark')),'back to dark');
  // nav
  const tabs=await pg.$$eval('.nav a',e=>e.map(x=>x.textContent.replace(/[0-9+]/g,'').trim())); ok(tabs.join(',')==='홈,환율,지출·예약,맛집,지도,코스,회화','nav: '+tabs.join(','));
  // phrases pronunciation
  await pg.click('[data-phrases]'); await pg.waitForSelector('[data-phrase]'); ok((await pg.evaluate(()=>document.body.innerText)).includes('하우 머치 이즈 잇?'),'phrase pronunciation shown');
  await pg.click('[data-phrase="1-1"]'); const ph=await pg.$eval('#driver',e=>e.innerText); ok(/페소스/.test(ph)&&/보증금은 카드로/.test(ph),'hotel phrase: pesos + card deposit'); await pg.click('[data-closedriver]');
  // expenses
  await pg.goto('http://localhost:8765/_test_live.html#ledger'); await pg.waitForSelector('[data-expadd]');
  await pg.click('[data-expadd]'); await pg.fill('#ex-what','망고 쉐이크'); await pg.fill('#ex-amt','520'); await pg.fill('#ex-qty','2'); await pg.selectOption('#ex-menu',{label:'망고 쉐이크'}); await pg.waitForTimeout(100);
  ok(/조금 비쌈/.test(await pg.$eval('#ex-conv',e=>e.innerText)),'live judge in form (₱260 each > ₱250 → '+(await pg.$eval('#ex-conv',e=>e.innerText))+')'); await pg.click('[data-expsave]'); await pg.waitForTimeout(400);
  await pg.click('[data-expadd]'); await pg.fill('#ex-what','시시그'); await pg.fill('#ex-amt','900'); await pg.selectOption('#ex-menu',{label:'시시그'}); await pg.click('[data-expsave]'); await pg.waitForTimeout(400);
  await pg.click('[data-expadd]'); await pg.fill('#ex-what','기념품 자석'); await pg.fill('#ex-amt','5'); await pg.click('[data-cur="USD"]'); await pg.selectOption('#ex-cat','쇼핑·기념품'); await pg.click('[data-expsave]'); await pg.waitForTimeout(400);
  const tbl=await pg.$eval('#lbody',e=>e.innerText); console.log('  table:', tbl.replace(/\n+/g,' | ').slice(0,420));
  ok((await pg.$$eval('table.xt tbody tr',e=>e.length))===3,'3 rows in table');
  ok(/비쌈/.test(tbl)&&/조금 비쌈|적정/.test(tbl),'judgements shown');
  await pg.screenshot({path:'test/v-exp.png'});
  // bookings
  await pg.click('[data-ltab="book"]'); ok((await pg.$eval('#lbody',e=>e.innerText)).includes('TW-125')&&(await pg.$eval('#lbody',e=>e.innerText)).includes('₱4,928'),'fixed bookings listed');
  await pg.click('[data-bookadd]'); await pg.fill('#bk-name','Subo 저녁'); await pg.selectOption('#bk-d','11/25'); await pg.fill('#bk-t','19:00'); await pg.fill('#bk-m','예약자 수복'); await pg.click('[data-booksave]'); await pg.waitForTimeout(400);
  await pg.click('[data-ltab="book"]'); ok((await pg.$eval('#lbody',e=>e.innerText)).includes('Subo 저녁'),'custom booking added'); await pg.screenshot({path:'test/v-book.png'});
  // info: exchange plan, no seafood market
  await pg.goto('http://localhost:8765/_test_live.html#info'); await pg.waitForSelector('.pg-row',{state:'attached'}); const inf=await pg.evaluate(()=>document.body.textContent);
  ok(/예산 · 환전 계획/.test(inf)&&/₱4,928/.test(inf),'exchange plan'); ok(!/디탈리파파\)/.test(inf)&&!/해산물 kg당/.test(inf),'seafood market panel removed');
   await pg.screenshot({path:'test/v-fx.png'});
  // course tips, no talipapa in eat
  await pg.goto('http://localhost:8765/_test_live.html#course'); await pg.waitForSelector('.slot.tip'); ok((await pg.$$eval('.slot.tip',e=>e.length))>=8,'schedule tips: '+(await pg.$$eval('.slot.tip',e=>e.length)));
  await pg.goto('http://localhost:8765/_test_live.html#eat'); await pg.waitForSelector('#vlist .vc'); ok(!(await pg.$$eval('#vlist .vc h3',e=>e.some(x=>/Talipapa Seafood|^\d+D'Talipapa$|Talipapa Bukid/.test(x.textContent)))),'seafood market removed from recommendations');
  const hs=await pg.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]); ok(hs[0]<=hs[1],'no hscroll');
  console.log('errors',JSON.stringify(errs)); await b.close();
})();

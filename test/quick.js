const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m); const errs=[];
  const pg=await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage(); pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8765/_test_live.html#ledger'); await pg.waitForSelector('#ql'); await pg.waitForTimeout(300);
  const t0=await pg.$eval('#lbody',e=>e.innerText); ok(!/아빠|보관|\$4,000|\$2,800|남음|예산 항목/.test(t0),'no holder / $4,000 / 남음 wording');
  ok(/가져온 \$1,200/.test(t0),'$1,200 brought shown');
  const cases=[['200달러 12,400페소 환전','환전'],['점심 지보스 2,350페소','식사'],['망고쉐이크 2개 460페소','간식·음료'],['트라이크 2대 300페소','교통'],['기념품 말린망고 10달러','쇼핑'],['저녁 subo 4,800 자유경비로','자유경비']];
  for(const [txt,exp] of cases){ await pg.fill('#ql',txt); await pg.waitForTimeout(80); const pv=await pg.$eval('[data-qprev="ql"]',e=>e.innerText); ok(pv.includes(exp),'preview "'+txt+'" → '+pv); await pg.click('[data-quicksave="ql"]'); await pg.waitForTimeout(350); }
  const t=await pg.$eval('#lbody',e=>e.innerText);
  console.log('  wallet:', t.split('\n').slice(4,14).join(' | '));
  ok(/남은 페소\s*₱8,651/.test(t),'남은 페소 = 12,400 − 2,350 − 460 − 300 − 639 = ₱8,651: '+(t.match(/남은 페소\s*(\S+)/)||[])[1]);
  ok(/\$1,000/.test(t),'남은 달러 $1,000');
  ok(/망고쉐이크/.test(t)&&/×2/.test(t)&&/적정/.test(t),'mango shake row ×2 judged 적정 (₱230 each)');
  ok((await pg.$$eval('table.xt tbody tr',e=>e.length))===5,'5 expense rows in table');
  await pg.screenshot({path:'test/q-ledger.png',fullPage:true});
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('#qh'); ok(await pg.isVisible('#qh'),'quick entry on home');
  await pg.locator('#expPanel').scrollIntoViewIfNeeded(); await pg.screenshot({path:'test/q-home.png'});
  console.log('errors',JSON.stringify(errs)); await b.close();
})();

const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m); const errs=[];
  const pg=await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage(); pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8765/_test_live.html#ledger'); await pg.waitForSelector('[data-fxadd]'); await pg.waitForTimeout(300);
  const t0=await pg.$eval('#lbody',e=>e.innerText); ok(/가져온 \$1,200/.test(t0)&&!/\$4,000/.test(t0),'$1,200 brought, no $4,000');
  // exchange $200 -> 12,400
  await pg.click('[data-fxadd]'); await pg.fill('#fx-u','200'); await pg.fill('#fx-p','12400'); await pg.fill('#fx-w','칼리보 공항'); await pg.waitForTimeout(80);
  ok(/₱62.00/.test(await pg.$eval('#fx-r',e=>e.textContent)),'rate computed ₱62.00/$'); await pg.click('[data-fxsave]'); await pg.waitForTimeout(400);
  // common expense: extra guest fee 4,928
  await pg.click('[data-expadd]'); await pg.fill('#ex-what','1인 추가비 4박'); await pg.fill('#ex-amt','4928'); await pg.selectOption('#ex-cat','숙소 추가비'); await pg.fill('#ex-payer','아빠'); await pg.click('[data-expsave]'); await pg.waitForTimeout(400);
  // personal free-money purchase: mango shake 230
  await pg.click('[data-expadd]'); await pg.fill('#ex-what','망고 쉐이크'); await pg.fill('#ex-amt','230'); await pg.selectOption('#ex-cat','디저트·음료'); await pg.selectOption('#ex-menu',{label:'망고 쉐이크'}); await pg.click('[data-src="자유경비"]'); await pg.fill('#ex-payer','사랑'); await pg.click('[data-expsave]'); await pg.waitForTimeout(400);
  const t=await pg.$eval('#lbody',e=>e.innerText);
  ok(/환전한 페소\s*₱12,400/.test(t)&&/쓴 돈 \(공금\)\s*₱4,928/.test(t)&&/남은 페소\s*₱7,472/.test(t),'wallet: exchanged ₱12,400, spent ₱4,928, left ₱7,472 (free-money purchase not deducted)');
  ok(/환전 안 한 달러 \$1,000/.test(t),'dollars not exchanged $1,000');
  ok(/\$200 환전/.test(t),'exchange line shown');
  ok(/숙소 추가비|호텔 1인 추가비/.test(t),'category table shows hotel fee row');
  ok(/사랑\s*₱0\s*₱230/.test(t),'who spent table: 사랑 free money ₱230');
  ok(/적정/.test(t),'mango shake judged 적정 (₱230)');
  console.log('  wallet:', t.split('\n').slice(1,9).join(' | '));
  await pg.screenshot({path:'test/b-ledger.png'});
  await pg.click('[data-ltab="book"]'); ok((await pg.$eval('#lbody',e=>e.innerText)).includes('공항세 ₱900 × 7명 = ₱6,300'),'airport tax in bookings');
  await pg.goto('http://localhost:8765/_test_live.html#info'); await pg.waitForSelector('.pg-row',{state:'attached'}); const inf=await pg.evaluate(()=>document.body.textContent);
  ok(/가져온 돈 \$1,200/.test(inf)&&!/\$2,800/.test(inf)&&/칼리보 공항세/.test(inf)&&/4U 포함/.test(inf),'info plan: $1,200 brought, airport tax, port 4U');
  await pg.locator('h3:has-text("예산 · 환전 계획")').scrollIntoViewIfNeeded(); await pg.screenshot({path:'test/b-plan.png'});
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('#expPanel'); ok(/₱7,472/.test(await pg.$eval('#expPanel',e=>e.innerText)),'home wallet panel');
  await pg.goto('http://localhost:8765/_test_live.html#course'); await pg.waitForSelector('.slot.tip'); const c=await pg.evaluate(()=>document.body.innerText); ok(/1차 약 \$300/.test(c)&&/₱6,300/.test(c),'course tips updated');
  console.log('errors',JSON.stringify(errs)); await b.close();
})();

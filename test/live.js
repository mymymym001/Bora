const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor:1 })).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
  const t0=Date.now(); await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('.vc'); console.log('load+route ms', Date.now()-t0);
  await pg.waitForSelector('.msg'); await pg.waitForTimeout(300);
  await pg.screenshot({path:'test/live-1.png'}); await pg.screenshot({path:'test/live-1full.png',fullPage:true});
  ok(await pg.isVisible('.ppl button'), 'family location list on home');
  ok((await pg.$$eval('.msg',e=>e.length))===2, 'chat shows seeded msgs');
  ok(await pg.isVisible('.notice'), 'pinned notice');
  // profile + send message
  await pg.fill('#chatIn','안녕하세요 테스트'); await pg.click('.chatform .send'); await pg.waitForTimeout(300);
  ok((await pg.$$eval('.msg',e=>e.length))===3, 'message sent appears');
  await pg.click('#noticeToggle'); await pg.fill('#chatIn','8시 로비 집합'); await pg.click('.chatform .send'); await pg.waitForTimeout(300);
  ok((await pg.$eval('.notice',e=>e.textContent)).includes('8시 로비'), 'notice pinned updates');
  // share location via pick
  await pg.click('.chatbar [data-pick]'); await pg.waitForSelector('.pickbar'); await pg.waitForTimeout(700);
  const box=await pg.locator('#mapbox').boundingBox(); await pg.mouse.click(box.x+box.width*0.35, box.y+box.height*0.75); await pg.waitForTimeout(150);
  ok(await pg.isVisible('[data-pickok]'), 'pick shows confirm: '+await pg.$eval('.pickbar div',e=>e.textContent));
  await pg.screenshot({path:'test/live-2pick.png'});
  await pg.click('[data-pickok]'); await pg.waitForTimeout(400);
  ok((await pg.$$eval('.ava',e=>e.length))===2, 'my avatar added');
  ok((await pg.evaluate(()=>[...window.__mockStore.entries()].filter(([k,v])=>k.startsWith('chat/')&&v.kind==='loc').length))===2, 'location chat message posted');
  // follow mom
  await pg.locator('.ava:not(.me)').click(); await pg.waitForSelector('[data-follow]');
  ok((await pg.$eval('[data-follow]',e=>e.textContent)).includes('엄마'), 'follow button names person');
  await pg.click('[data-follow]'); await pg.waitForTimeout(500);
  const ft=await pg.$eval('.follow',e=>e.innerText); ok(/분/.test(ft), 'follow shows route time');
  console.log('  ', ft.replace(/\n+/g,' | ').slice(0,220));
  await pg.screenshot({path:'test/live-3follow.png'});
  // mom moves → route updates
  const before=await pg.$eval('.follow .mode b',e=>e.textContent);
  await pg.evaluate(()=>{const s=window.__mockStore; const v=Object.assign({},s.get('people/u_mom'),{x:300,y:600,label:'Ondus 근처',at:Date.now()}); window.claude.use('db').then(db=>db.doc('people/u_mom').set(v));});
  await pg.waitForTimeout(500); const after=await pg.$eval('.follow .mode b',e=>e.textContent);
  ok(before!==after, `route updates when target moves: ${before} → ${after}`);
  await pg.click('[data-stopfollow]'); ok(true,'stop follow');
  // loc msg click flies map
  await pg.click('.nav a[data-tab="home"]'); await pg.waitForSelector('.msg.loc'); await pg.click('.msg.loc button >> nth=0'); ok(true,'loc message click');
  // course tab lists all food
  await pg.click('.nav a[data-tab="course"]'); await pg.waitForTimeout(300);
  const n=await pg.$$eval('.plist button',e=>e.length); ok(n>200, 'course lists all food places: '+n);
  await pg.screenshot({path:'test/live-4course.png'});
  await pg.locator('.plist button >> nth=5').click(); await pg.waitForTimeout(300); ok(await pg.isVisible('#sheet'),'osm place opens: '+await pg.$eval('#sheet .t',e=>e.textContent));
  await pg.screenshot({path:'test/live-5osm.png'});
  await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForSelector('.msg'); await pg.waitForTimeout(300); const hs=await pg.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]); ok(hs[0]<=hs[1],'no horizontal scroll '+hs); await pg.screenshot({path:'test/live-6.png'}); console.log('errors', JSON.stringify(errs)); await b.close();
})();

const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [dev,tag] of [['iPhone 13','13'],['iPhone SE','se']]) {
    const pg=await (await b.newContext({ ...devices[dev], deviceScaleFactor:1 })).newPage();
    for (const t of ['home','info','ledger','eat','map','course','talk']) {
      await pg.goto('http://localhost:8765/_test_live.html#'+t); await pg.waitForTimeout(800);
      await pg.screenshot({path:`test/rv-${tag}-${t}.png`});
    }
    if(tag==='13'){
      await pg.goto('http://localhost:8765/_test_live.html#p-cyma'); await pg.waitForTimeout(1200); await pg.screenshot({path:'test/rv-13-detail.png'});
      await pg.evaluate(()=>{const m=document.querySelector('#menuBox'); if(m) m.scrollIntoView();}); await pg.waitForTimeout(300); await pg.screenshot({path:'test/rv-13-menu.png'});
      await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForTimeout(800); await pg.click('[data-expadd2]'); await pg.waitForTimeout(300); await pg.screenshot({path:'test/rv-13-expform.png'});
      await pg.goto('http://localhost:8765/_test_live.html#ledger'); await pg.waitForTimeout(600); await pg.evaluate(()=>window.scrollTo(0,600)); await pg.screenshot({path:'test/rv-13-ledger2.png'});
    }
  }
  await b.close();
})();

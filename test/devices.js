const { chromium } = require('playwright');
const DEV=[["아이폰 14 Plus",428,926,3,true],["갤럭시 S26급",384,832,3,true],["갤럭시 울트라급",412,915,3.5,true],["Z폴드 접음",344,882,2.6,true],["Z폴드 펼침",690,829,2.6,true]];
(async () => {
  const b = await chromium.launch();
  for (const [n,w,h,d,m] of DEV) {
    const pg=await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:m,hasTouch:true})).newPage();
    const res=[];
    for (const t of ['home','info','ledger','eat','map','course','talk']) { await pg.goto('http://localhost:8765/_test_live.html#'+t); await pg.waitForTimeout(500); const r=await pg.evaluate(()=>[window.innerWidth,document.documentElement.scrollWidth]); res.push(t+(r[1]>r[0]?'✗'+r[1]:'✓')); }
    await pg.goto('http://localhost:8765/_test_live.html#home'); await pg.waitForTimeout(700); await pg.screenshot({path:`test/dv-${w}-home.png`});
    await pg.goto('http://localhost:8765/_test_live.html#eat'); await pg.waitForTimeout(700); await pg.screenshot({path:`test/dv-${w}-eat.png`});
    console.log(n,w+'x'+h,res.join(' '));
  }
  await b.close();
})();

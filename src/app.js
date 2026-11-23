(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ICON={
  restaurant:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3c-2 1-3 3.5-3 7h3v11"/></svg>',
  cafe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zM16 10h2a2.5 2.5 0 0 1 0 5h-2M8 3v3M12 3v3"/></svg>',
  convenience:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12H6L5 8zM9 8a3 3 0 0 1 6 0"/></svg>',
  pharmacy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  pub:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12l-6 8-6-8zM12 12v8M8 20h8"/></svg>',
  hotel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5"/></svg>',
  person:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z"/></svg>'
};
const CATS=[{id:"all",label:"전체"},{id:"restaurant",label:"음식점"},{id:"cafe",label:"카페"},{id:"convenience",label:"편의점"},{id:"h24",label:"24시간"},{id:"pharmacy",label:"약국·병원"},{id:"pub",label:"펍"}];
const CATLABEL={restaurant:"음식점",cafe:"카페",convenience:"편의점",pharmacy:"약국",pub:"펍"};
const KINDLABEL={restaurant:"음식점",fast_food:"패스트푸드",cafe:"카페",ice_cream:"아이스크림",bar:"바",pub:"펍"};
const TRIKE={cap:5,specialLo:100,specialHi:150,shared:25};
const CHARS=["🐢","🐬","🦀","🐙","🐠","🦩","🐳","🦜","🌴","🥥","🍍","🐚"];
const WALK_MPM=67, TRIKE_MPM=250, STALE_MS=2*3600e3;

let D=null, MAP=null, G=null, ALL=[], BYID={};
const S={n:7,cat:"all",sel:null,mode:"walk",all:false,follow:null,person:null,pick:null};
try{const v=JSON.parse(localStorage.getItem("bora-state")||"{}"); if(v.n>=1&&v.n<=7)S.n=v.n; if(CATS.some(c=>c.id===v.cat))S.cat=v.cat; S.all=!!v.all;}catch(e){}
function save(){try{localStorage.setItem("bora-state",JSON.stringify({n:S.n,cat:S.cat,all:S.all}))}catch(e){}}

/* ================= routing graph ================= */
function buildGraph(g){
  const xy=g.xy, N=xy.length/2, e=g.e, deg=new Int32Array(N+1);
  for(let i=0;i<e.length;i+=3){deg[e[i]]++;deg[e[i+1]]++;}
  const start=new Int32Array(N+1); for(let i=0;i<N;i++) start[i+1]=start[i]+deg[i];
  const fill=start.slice(0,N), to=new Int32Array(start[N]), w=new Float32Array(start[N]), tk=new Uint8Array(start[N]), tnode=new Uint8Array(N);
  for(let i=0;i<e.length;i+=3){const a=e[i],b=e[i+1],t=e[i+2],d=Math.hypot(xy[2*a]-xy[2*b],xy[2*a+1]-xy[2*b+1]);
    to[fill[a]]=b;w[fill[a]]=d;tk[fill[a]++]=t; to[fill[b]]=a;w[fill[b]]=d;tk[fill[b]++]=t; if(t){tnode[a]=1;tnode[b]=1;}}
  return {N,xy,start,to,w,tk,tnode,entry:g.entry};
}
function dijkstra(src,trike){
  const {N,start,to,w,tk}=G, dist=new Float64Array(N).fill(Infinity), prev=new Int32Array(N).fill(-1);
  const hk=[],hv=[]; const push=(k,v)=>{let i=hk.length;hk.push(k);hv.push(v);while(i>0){const p=(i-1)>>1;if(hk[p]<=hk[i])break;[hk[p],hk[i]]=[hk[i],hk[p]];[hv[p],hv[i]]=[hv[i],hv[p]];i=p;}};
  const pop=()=>{const v=hv[0],k=hk[0],lk=hk.pop(),lv=hv.pop();if(hk.length){hk[0]=lk;hv[0]=lv;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<hk.length&&hk[l]<hk[m])m=l;if(r<hk.length&&hk[r]<hk[m])m=r;if(m===i)break;[hk[m],hk[i]]=[hk[i],hk[m]];[hv[m],hv[i]]=[hv[i],hv[m]];i=m;}}return [k,v]};
  dist[src]=0; push(0,src);
  while(hk.length){const [d,u]=pop(); if(d>dist[u]) continue;
    for(let j=start[u];j<start[u+1];j++){ if(trike&&!tk[j]) continue; const v=to[j],nd=d+w[j]; if(nd<dist[v]){dist[v]=nd;prev[v]=u;push(nd,v);} } }
  return {dist,prev};
}
function nearest(x,y,trike){
  const {N,xy,tnode}=G; let best=-1,bd=Infinity;
  for(let i=0;i<N;i++){ if(trike&&!tnode[i]) continue; const d=(xy[2*i]-x)**2+(xy[2*i+1]-y)**2; if(d<bd){bd=d;best=i;} }
  return [best,Math.sqrt(bd)];
}
function pathPts(prev,from,x0,y0,x1,y1){ // from node back to tree root
  const pts=[x0,y0]; let u=from; let guard=0; while(u!==-1&&guard++<1e5){pts.push(G.xy[2*u],G.xy[2*u+1]); u=prev[u];} if(x1!=null) pts.push(x1,y1); return pts;
}
let HW=null, HT=null;
function routeToHotel(x,y){
  const r={air:Math.round(Math.hypot(x,y))};
  for(const [k,tree,trike,mpm,minM] of [["walk",HW,false,WALK_MPM,1],["trike",HT,true,TRIKE_MPM,2]]){
    const [n,off]=nearest(x,y,trike); const L=tree.dist[n]+off;
    r[k]={m:Math.round(L),min:Math.max(minM,Math.round(L/mpm)),p:pathPts(tree.prev,n,x,y)};
  }
  return r;
}
function routeBetween(a,b){ // a → b
  const out={};
  for(const [k,trike,mpm,minM] of [["walk",false,WALK_MPM,1],["trike",true,TRIKE_MPM,2]]){
    const [nb,ob]=nearest(b.x,b.y,trike), [na,oa]=nearest(a.x,a.y,trike);
    const t=dijkstra(nb,trike); const L=t.dist[na]+oa+ob;
    if(!isFinite(L)){out[k]=null;continue}
    out[k]={m:Math.round(L),min:Math.max(minM,Math.round(L/mpm)),p:pathPts(t.prev,na,a.x,a.y,b.x,b.y)};
  }
  return out;
}

/* ================= money ================= */
const php=v=>"₱"+Math.round(v).toLocaleString("en-US");
const krw=v=>"₩"+(Math.round(v*D.fx.krw_per_php/100)*100).toLocaleString("ko-KR");
function rng(a,b,f){return a===b?f(a):f(a)+"–"+f(b).replace(/^[₱₩]/,"")}
function priceOf(m){return m==null?null:Array.isArray(m)?m:[m,m]}
function groupCost(p,n){ if(!p.pp) return null; const k=n*(p.sc?1+p.sc:1); return [p.pp[0]*k,p.pp[1]*k]; }
function trikes(n){return Math.ceil(n/TRIKE.cap)}
function chargeNote(p){
  const v=p.vat===true?"VAT 포함":p.vat===false?"VAT 별도":"VAT 표기 미확인";
  const s=p.sc?"서비스차지 "+Math.round(p.sc*100)+"% 별도(합계에 반영)":p.sc===0?"서비스차지 없음":"서비스차지 미확인";
  return v+" · "+s;
}
function nearLabel(x,y){
  let best=null,bd=1e9;
  D.landmarks.concat(D.places).forEach(p=>{const d=Math.hypot(p.x-x,p.y-y); if(d<bd){bd=d;best=p;}});
  if(Math.hypot(x,y)<90) return "헤난 가든";
  if(best&&bd<150) return (best.ko||best.name).replace(/ \(.+\)$/,"")+" 근처";
  return "호텔에서 "+Math.round(Math.hypot(x,y)/10)*10+"m";
}
function ago(ms){const m=Math.round((Date.now()-ms)/60000); if(m<1) return "방금"; if(m<60) return m+"분 전"; const h=Math.floor(m/60); if(h<24) return h+"시간 전"; return Math.floor(h/24)+"일 전";}
function hhmm(ms){try{return new Date(ms).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Manila"})}catch(e){return ""}}

/* ================= ranking ================= */
function matches(p,cat){return cat==="all"||(cat==="h24"?!!p.h24:p.cat===cat)}
const isFood=p=>p.cat==="restaurant"||p.cat==="cafe"||p.cat==="pub";
function score(p,n){ const w=p.route.walk.min, fit=p.groupFit||2; const pen=!isFood(p)?0:n>=5?(3-fit)*6:n>=3?(3-fit)*2:0; return w+pen+(p.osm?4:0); }
function ranked(){return ALL.filter(p=>(!p.osm||S.all)&&matches(p,S.cat)).sort((a,b)=>score(a,S.n)-score(b,S.n))}
function fitBadge(p){
  if(!isFood(p)||p.osm) return "";
  if(S.n>=5&&p.groupFit===3) return '<span class="badge ok">'+S.n+'명 자리 OK</span>';
  if(S.n>=5&&p.groupFit===1) return '<span class="badge warn">'+S.n+'명엔 좁음</span>';
  return "";
}
const catText=p=>p.osm?(KINDLABEL[p.kind]||CATLABEL[p.cat]):p.sub==="hospital"?"병원":CATLABEL[p.cat];

/* ================= live: people + chat (db) ================= */
const LIVE={db:null,user:null,assets:null,uid:null,canWrite:null,status:"loading",people:{},chat:[],me:{nick:"",char:"🐢"},unsub:[]};
try{const m=JSON.parse(localStorage.getItem("bora-me")||"null"); if(m&&m.char) LIVE.me=m;}catch(e){}
function saveMe(){try{localStorage.setItem("bora-me",JSON.stringify(LIVE.me))}catch(e){}}
async function initLive(){
  const c=window.claude;
  if(!c||!c.use){LIVE.status="off";renderChat();return}
  const timer=setTimeout(()=>{if(LIVE.status==="loading"){LIVE.status="slow";renderChat();}},10000);
  try{
    const [db,user,assets]=await Promise.all([c.use("db"),c.use("user"),c.use("assets")]);
    LIVE.db=db; LIVE.user=user; LIVE.assets=assets;
    if(!db){clearTimeout(timer);LIVE.status="off";renderChat();return}
    if(user){LIVE.uid=await user.id(); LIVE.canWrite=await user.can("data.write");
      if(!LIVE.me.nick){const me=await user.me(); if(me.name){LIVE.me.nick=me.name.split(" ")[0].slice(0,10); saveMe();}}}
    LIVE.unsub.push(db.collection("people").onSnapshot(snap=>{
      const o={}; snap.docs.forEach(d=>{const v=d.data(); if(v&&typeof v.x==="number"&&typeof v.y==="number") o[d.id]=v;}); LIVE.people=o;
      if(LIVE.status!=="live"){LIVE.status="live";clearTimeout(timer);renderChat();}
      if(MAP) MAP.setPeople(); renderFollow();
    },err=>{LIVE.status="err";clearTimeout(timer);renderChat();}));
    LIVE.unsub.push(db.collection("chat").orderBy("at","desc").limit(120).onSnapshot(snap=>{
      LIVE.chat=snap.docs.map(d=>Object.assign({id:d.id},d.data())).reverse();
      if(LIVE.status!=="live"&&!snap.metadata.fromCache){LIVE.status="live";clearTimeout(timer);}
      renderChat(true);
    },err=>{LIVE.status="err";clearTimeout(timer);renderChat();}));
  }catch(e){clearTimeout(timer);LIVE.status="err";renderChat();}
}
const canPost=()=>LIVE.db&&LIVE.uid&&LIVE.canWrite!==false;
async function postChat(kind,text,extra){
  if(!canPost()) return false;
  try{ await LIVE.db.collection("chat").add(Object.assign({by:LIVE.uid,nick:LIVE.me.nick||"가족",char:LIVE.me.char,kind,text:String(text).slice(0,500),at:Date.now()},extra||{})); return true; }
  catch(e){ chatError(e); return false; }
}
function chatError(e){ const m=$("#chatMsg"); if(!m) return;
  m.textContent=e&&e.code==="invalid_argument"?"보기 전용 권한이라 글을 쓸 수 없어요. 소유자에게 편집자 초대를 요청하세요.":e&&e.code==="quota_exceeded"?"저장 공간이 가득 찼어요.":"전송하지 못했어요. 잠시 뒤 다시 시도하세요."; m.hidden=false; if(e&&e.code==="invalid_argument"){LIVE.canWrite=false;renderChat();} }
async function shareLocation(x,y){
  if(!canPost()) return;
  const label=nearLabel(x,y);
  const doc={nick:LIVE.me.nick||"가족",char:LIVE.me.char,x:Math.round(x),y:Math.round(y),label,at:Date.now()};
  try{ await LIVE.db.doc("people/"+LIVE.uid).set(doc); LIVE.people[LIVE.uid]=doc; if(MAP) MAP.setPeople();
    await postChat("loc",label+"에 있어요",{x:doc.x,y:doc.y,label}); }
  catch(e){ chatError(e); }
}
async function stopSharing(){ if(!canPost()) return; try{ await LIVE.db.doc("people/"+LIVE.uid).delete(); delete LIVE.people[LIVE.uid]; if(MAP) MAP.setPeople(); }catch(e){chatError(e)} }
function myLoc(){const p=LIVE.uid&&LIVE.people[LIVE.uid]; return p&&Date.now()-p.at<STALE_MS?p:null;}

/* ================= views: map tab ================= */
function partyHTML(){
  let b=""; for(let i=1;i<=7;i++) b+='<button type="button" aria-pressed="'+(i===S.n)+'" data-n="'+i+'" aria-label="'+i+'명">'+i+'</button>';
  return '<div class="party"><label>인원</label><div class="seg" role="group" aria-label="인원 선택">'+b+'</div></div>';
}
function catCount(id){return ALL.filter(p=>matches(p,id)).length}
function chipsHTML(){
  return '<div class="chips" role="group" aria-label="카테고리">'+CATS.map(c=>{
    const col=CATLABEL[c.id]?'<i style="background:var(--c-'+c.id+')"></i>':"";
    return '<button type="button" class="chip" data-cat="'+c.id+'" aria-pressed="'+(S.cat===c.id)+'">'+col+c.label+' <span class="n">'+catCount(c.id)+'</span></button>';
  }).join("")+'</div>';
}
function renderMapTab(){
  $("#app").innerHTML=
   '<div class="top"><div class="brand"><h1>보라카이 가족 가이드</h1><small>11.24–28 · 헤난 가든</small></div>'+partyHTML()+chipsHTML()+'</div>'+
   '<div class="mapbox" id="mapbox"><canvas id="cv" aria-label="헤난 가든 주변 지도"></canvas><div class="pins" id="pins"></div>'+
   '<div class="mapctl"><button type="button" id="zin" aria-label="확대">+</button><button type="button" id="zout" aria-label="축소">−</button>'+
   '<button type="button" id="zhome" aria-label="호텔로 이동">'+ICON.hotel+'</button><button type="button" id="zme" aria-label="내 위치 알리기">'+ICON.person+'</button></div>'+
   '<div id="pickbar"></div><div class="attrib">© OpenStreetMap 기여자</div></div>'+
   '<div id="follow"></div>'+
   '<section class="chat" id="chat" aria-label="가족 채팅"></section>'+
   '<div class="sec-h"><h2 id="railTitle">가까운 추천</h2><span id="railNote"></span></div><div class="rail" id="rail"></div>'+
   '<label class="toggle"><input type="checkbox" id="allToggle"'+(S.all?" checked":"")+'> 조사 안 된 주변 식당·카페 '+D.others.length+'곳도 카드로 보기 (지도에는 작은 점으로 항상 표시)</label>'+
   '<div class="sec-h"><h2>호텔 복귀</h2><span>지도 기반 추정</span></div><div id="ret"></div>';
  MAP=makeMap($("#mapbox"),$("#cv"),$("#pins"));
  bindTop(); renderChat(); refresh(true); MAP.setPeople(); renderFollow();
}
function bindTop(){
  $(".seg").addEventListener("click",e=>{const b=e.target.closest("button[data-n]"); if(!b)return; S.n=+b.dataset.n; save();
    document.querySelectorAll(".seg button").forEach(x=>x.setAttribute("aria-pressed",x===b)); refresh(false);});
  $(".chips").addEventListener("click",e=>{const b=e.target.closest(".chip"); if(!b)return; S.cat=b.dataset.cat; save();
    document.querySelectorAll(".chip").forEach(x=>x.setAttribute("aria-pressed",x===b));
    const list=ranked(); if(!list.some(p=>p.id===S.sel)) S.sel=list[0]?list[0].id:null; refresh(true);});
  $("#allToggle").addEventListener("change",e=>{S.all=e.target.checked; save(); refresh(false);});
}
function refresh(fit){
  const list=ranked();
  if(!S.sel||!BYID[S.sel]) S.sel=list[0]?list[0].id:null;
  const cat=CATS.find(c=>c.id===S.cat);
  $("#railTitle").textContent=(S.cat==="all"?"가까운 추천":cat.label+" 추천");
  $("#railNote").textContent=S.n+"명 기준 · "+list.length+"곳";
  const shown=list.slice(0,60);
  $("#rail").innerHTML=shown.length?shown.map(cardHTML).join(""):'<div class="empty">이 조건에 맞는 장소가 없어요.</div>';
  MAP.setPins(p=>matches(p,S.cat),S.sel);
  if(fit) MAP.fitTo(list.filter(p=>!p.osm).length?list.filter(p=>!p.osm):list);
  renderReturn(); markCards();
}
function cardHTML(p){
  const gc=groupCost(p,S.n), t=trikes(S.n);
  const cost=gc?'<div class="cost num">'+rng(gc[0],gc[1],php)+' <small>'+S.n+'명 · '+rng(gc[0],gc[1],krw)+'</small></div>'
    :'<div class="cost num" style="font-weight:500;font-size:14px">'+esc(p.osm?(p.cuisine||"메뉴 정보 없음")+(p.hours?" · "+p.hours:""):(p.hours||"영업시간 미확인"))+'</div>';
  return '<article class="card" data-id="'+p.id+'" style="--pc:var(--c-'+p.cat+')" tabindex="0">'+
    '<div class="k"><span class="dot"></span>'+esc(catText(p))+(p.h24?' · <b>24시간</b>':'')+(p.osm?' <span class="badge">조사 전</span>':'')+' '+fitBadge(p)+'</div>'+
    '<h3>'+esc(p.name)+'</h3>'+(p.ko?'<div class="ko">'+esc(p.ko)+'</div>':'')+cost+
    '<div class="row"><span class="num"><span style="color:var(--sun)">⌂</span> 도보 <b>'+p.route.walk.min+'분</b> · 트라이크 '+php(TRIKE.specialLo*t)+'–'+(TRIKE.specialHi*t)+'</span>'+
    '<button type="button" class="more" data-open="'+p.id+'">자세히</button></div></article>';
}
function markCards(){document.querySelectorAll(".card").forEach(c=>c.setAttribute("aria-current",c.dataset.id===S.sel));}
function select(id,opts={}){
  S.sel=id; S.follow=null; renderFollow(); MAP.setPins(p=>matches(p,S.cat),S.sel); markCards(); renderReturn();
  const p=BYID[id]; if(opts.pan&&p) MAP.showPts(p.route[S.mode].p);
  if(opts.scroll){const c=document.querySelector('.card[data-id="'+CSS.escape(id)+'"]'); if(c) c.scrollIntoView({behavior:"smooth",inline:"start",block:"nearest"});}
}
function renderReturn(){
  const el=$("#ret"); if(!el) return;
  const p=BYID[S.sel];
  if(!p){el.innerHTML='<div class="empty">장소를 선택하세요.</div>';return}
  el.innerHTML=returnHTML(p,true);
  if(!S.follow) MAP.setRoute(p.route[S.mode].p,S.mode);
}
function returnHTML(p,interactive){
  const r=p.route, t=trikes(S.n);
  const recTxt=r.walk.m<=800?"걸어가는 걸 추천해요. 도보 "+r.walk.min+"분 거리예요.":"거리가 있어 e-트라이크를 추천해요.";
  return '<div class="ret"><h3>'+esc(p.name)+' <span class="arrow">→</span> 헤난 가든</h3>'+
   '<div class="modes" role="group" aria-label="이동 수단">'+
   '<button type="button" class="mode" data-mode="walk" aria-pressed="'+(S.mode==="walk")+'"><span>도보</span><b class="num">'+r.walk.min+'분</b><span class="num">'+r.walk.m.toLocaleString()+'m</span></button>'+
   '<button type="button" class="mode" data-mode="trike" aria-pressed="'+(S.mode==="trike")+'"><span>e-트라이크</span><b class="num">약 '+r.trike.min+'분</b><span class="num">'+r.trike.m.toLocaleString()+'m · '+t+'대</span></button></div>'+
   '<div class="rec">'+recTxt+'</div>'+fareHTML()+
   '<div class="btns"><button type="button" class="btn" data-driver="1">기사님께 보여주기</button>'+
   (interactive?'<button type="button" class="btn alt" data-open="'+p.id+'">장소 자세히</button>':'')+'</div>'+
   '<p class="fine">경로·시간은 OpenStreetMap 도로망 최단거리로 계산한 추정치(도보 시속 4km, 트라이크 시속 15km, 대기 제외)이며 실시간 경로가 아니에요. 트라이크는 해변 산책로로 못 다녀서 메인로드로 돌아가요. 요금은 2024–26 여행 블로그 기준 참고가이고, 1대 '+TRIKE.cap+'명 기준으로 대수를 계산했어요. 보라카이에서는 Grab 차량 호출이 안 돼요.</p></div>';
}
function fareHTML(){
  const t=trikes(S.n);
  return '<div class="fare num"><div><span class="lbl">공식 운임</span><span>공식 요금표 원문 확인 못 함</span></div>'+
   '<div><span class="lbl">전세(스페셜) 참고가</span><b>'+php(TRIKE.specialLo*t)+'–'+(TRIKE.specialHi*t).toLocaleString()+' · '+t+'대</b></div>'+
   '<div><span class="lbl">합승 참고가</span><span>1인 약 ₱'+TRIKE.shared+' · '+S.n+'명 '+php(TRIKE.shared*S.n)+'</span></div>'+
   '<div><span class="lbl">원화</span><span>전세 '+krw(TRIKE.specialLo*t)+'–'+krw(TRIKE.specialHi*t).slice(1)+'</span></div></div>';
}

/* ---------- chat panel ---------- */
let chatBig=false, noticeOn=false;
function renderChat(scroll){
  const el=$("#chat"); if(!el) return;
  const st=LIVE.status, writable=canPost();
  const stTxt={loading:"연결 중…",slow:"연결이 늦어요",live:"실시간",off:"사용 불가",err:"연결 끊김"}[st];
  const latestNotice=[...LIVE.chat].reverse().find(m=>m.kind==="notice");
  const me=LIVE.me;
  let body;
  if(st==="off") body='<p class="chatmsg">채팅과 위치 공유는 claude.ai에 로그인하고 이 페이지에 <b>편집자로 초대받은</b> 가족만 쓸 수 있어요. 지금 보는 화면에서는 꺼져 있어요.</p>';
  else body='<ol class="msgs" id="msgs" aria-live="polite">'+(LIVE.chat.length?LIVE.chat.map(msgHTML).join(""):'<li class="chatempty">'+(st==="live"?"아직 메시지가 없어요. 첫 인사를 남겨 보세요.":"메시지를 불러오는 중…")+'</li>')+'</ol>'+
    (writable?'<form class="chatform" id="chatForm"><button type="button" class="nt" id="noticeToggle" aria-pressed="'+noticeOn+'" title="모두에게 공지">공지</button><label for="chatIn" class="sr" hidden>메시지</label><input id="chatIn" maxlength="500" autocomplete="off" placeholder="'+(noticeOn?"공지 내용 (모두에게 강조 표시)":"메시지 입력")+'"><button class="send" type="submit">보내기</button></form>'+
      '<div class="chatbar"><button type="button" class="btn loc" data-pick>'+(myLoc()?"내 위치 다시 알리기":"내 위치 알리기")+'</button><button type="button" class="btn alt" data-profile>'+esc(me.char)+' '+esc(me.nick||"이름 정하기")+'</button></div>'
     :(st==="live"||st==="slow"?'<p class="chatmsg">'+(LIVE.uid?"보기 전용이에요. 글쓰기와 위치 공유는 편집자로 초대받은 가족만 할 수 있어요.":"로그인하면 글을 쓸 수 있어요.")+'</p>':''));
  const keep=document.activeElement&&document.activeElement.id==="chatIn"; const val=keep?$("#chatIn").value:"";
  el.className="chat"+(chatBig?" big":"");
  el.innerHTML='<header><h2>가족 채팅</h2><span class="live'+(st==="live"?" on":"")+'"><i></i>'+stTxt+'</span>'+(st!=="off"?'<button type="button" class="tiny" data-chatsize>'+(chatBig?"작게":"크게")+'</button>':'')+'</header>'+
    (latestNotice?'<div class="notice"><b>공지</b>'+esc(latestNotice.char||"")+' '+esc(latestNotice.nick)+': '+esc(latestNotice.text)+'</div>':'')+body+'<p class="chatmsg" id="chatMsg" hidden></p>';
  if(keep){const i=$("#chatIn"); i.value=val; i.focus();}
  const ms=$("#msgs"); if(ms) ms.scrollTop=ms.scrollHeight;
  const f=$("#chatForm"); if(f) f.addEventListener("submit",async ev=>{ev.preventDefault(); const i=$("#chatIn"); const t=i.value.trim(); if(!t) return;
    if(!LIVE.me.nick){openProfile(); return;}
    i.value=""; const ok=await postChat(noticeOn?"notice":"msg",t); if(!ok) i.value=t; else if(noticeOn){noticeOn=false;renderChat();}});
}
function msgHTML(m){
  const mine=m.by&&m.by===LIVE.uid;
  let t=esc(m.text);
  if(m.kind==="loc"&&typeof m.x==="number") t='<button type="button" data-locx="'+m.x+'" data-locy="'+m.y+'">'+esc(m.label||"위치")+'에 있어요 · 지도에서 보기</button>';
  return '<li class="msg'+(m.kind==="notice"?" notice-m":"")+(m.kind==="loc"?" loc":"")+(mine?" mine":"")+'"><span class="c">'+esc(m.char||"🙂")+'</span><div><div class="h"><b>'+esc(m.nick||"가족")+'</b>'+(m.kind==="notice"?'<span class="badge sun">공지</span> ':'')+hhmm(m.at)+'</div><div class="t">'+t+'</div></div></li>';
}

/* ---------- follow ---------- */
function renderFollow(){
  const el=$("#follow"); if(!el) return;
  const uid=S.person; const p=uid&&LIVE.people[uid];
  if(!p){el.innerHTML="";return}
  const isMe=uid===LIVE.uid, nick=p.nick||"가족";
  let inner='<div class="follow"><h3><span class="f">'+esc(p.char)+'</span>'+esc(nick)+(isMe?" (나)":"")+'</h3><div class="fine num">'+esc(p.label||"")+' · '+ago(p.at)+' 알림'+(Date.now()-p.at>STALE_MS?" — 오래된 위치예요":"")+'</div>';
  if(isMe) inner+='<div class="btns"><button type="button" class="btn" data-pick>위치 다시 알리기</button><button type="button" class="btn alt" data-stopshare>위치 공유 끄기</button><button type="button" class="btn alt" data-closeperson>닫기</button></div>';
  else if(S.follow===uid){
    const from=myLoc()||{x:0,y:0}, r=routeBetween(from,p);
    S._followRoute=r;
    inner+='<div class="modes"><button type="button" class="mode" data-fmode="walk" aria-pressed="'+(S.mode==="walk")+'"><span>도보</span><b class="num">'+(r.walk?r.walk.min+"분":"–")+'</b><span class="num">'+(r.walk?r.walk.m.toLocaleString()+"m":"")+'</span></button>'+
      '<button type="button" class="mode" data-fmode="trike" aria-pressed="'+(S.mode==="trike")+'"><span>e-트라이크</span><b class="num">'+(r.trike?"약 "+r.trike.min+"분":"–")+'</b><span class="num">'+(r.trike?r.trike.m.toLocaleString()+"m · "+trikes(S.n)+"대":"")+'</span></button></div>'+
      '<div class="fine">출발: '+(myLoc()?"내가 알린 위치 ("+esc(myLoc().label)+", "+ago(myLoc().at)+")":"헤난 가든 — 내 위치를 먼저 알리면 더 정확해요")+'. '+esc(nick)+'님이 위치를 다시 알리면 길이 자동으로 바뀌어요. OpenStreetMap 도로망 기준 추정치예요.</div>'+
      '<div class="btns"><button type="button" class="btn alt" data-stopfollow>그만 따라가기</button>'+(myLoc()?'':'<button type="button" class="btn alt" data-pick>내 위치 알리기</button>')+'</div>';
    const rr=r[S.mode]||r.walk; if(MAP&&rr){MAP.setRoute(rr.p,"follow");}
  } else inner+='<div class="btns"><button type="button" class="btn" data-follow="'+esc(uid)+'">‘'+esc(nick)+'’ 따라가기</button><button type="button" class="btn alt" data-closeperson>닫기</button></div>';
  el.innerHTML=inner+'</div>';
}
function openPerson(uid){ S.person=uid; if(S.follow&&S.follow!==uid) S.follow=null; renderFollow(); const el=$("#follow"); if(el) el.scrollIntoView({block:"nearest",behavior:"smooth"}); }
function startFollow(uid){ S.follow=uid; S.person=uid; renderFollow(); const r=S._followRoute&&(S._followRoute[S.mode]||S._followRoute.walk); if(r) MAP.showPts(r.p); }
function stopFollow(){ S.follow=null; renderFollow(); renderReturn(); }

/* ---------- pick my location ---------- */
function startPick(){
  if(!canPost()){ location.hash="map"; return; }
  if(!LIVE.me.nick){ openProfile(()=>startPick()); return; }
  if(!$("#cv")){ location.hash="map"; setTimeout(startPick,80); return; }
  S.pick={x:null,y:null}; renderPick(); $("#mapbox").scrollIntoView({block:"center",behavior:"smooth"});
}
function renderPick(){
  const el=$("#pickbar"); if(!el) return;
  if(!S.pick){el.innerHTML="";MAP.setTemp(null);return}
  const has=S.pick.x!=null;
  el.innerHTML='<div class="pickbar" role="dialog" aria-label="내 위치 알리기"><div>'+(has?"<b>"+esc(nearLabel(S.pick.x,S.pick.y))+"</b> — 여기로 알릴까요?":"지도에서 <b>지금 있는 곳</b>을 누르세요.")+'</div>'+
   '<div class="btns">'+(has?'<button type="button" class="btn go" data-pickok>여기로 알리기</button>':'<button type="button" class="btn go" data-pickhotel>호텔에 있어요</button>')+'<button type="button" class="btn" data-pickcancel>취소</button></div></div>';
  MAP.setTemp(has?S.pick:null);
}

/* ---------- profile ---------- */
function openProfile(after){
  const s=$("#sheet"); const me=LIVE.me;
  s.innerHTML='<div class="wrap"><div class="bar"><button type="button" data-close aria-label="닫기">✕</button><div class="t">내 캐릭터</div></div><div class="page" style="padding-top:0">'+
   '<p class="lead">지도와 채팅에 이 캐릭터와 이름으로 보여요.</p><div class="field"><label for="nick">이름 (가족이 알아볼 수 있게)</label><input id="nick" maxlength="10" value="'+esc(me.nick)+'" placeholder="예: 엄마, 수복"></div>'+
   '<div class="chars" role="group" aria-label="캐릭터">'+CHARS.map(c=>'<button type="button" data-char="'+c+'" aria-pressed="'+(c===me.char)+'">'+c+'</button>').join("")+'</div>'+
   '<button type="button" class="btn" data-saveprofile>저장</button><p class="fine">위치는 직접 알릴 때만 공유돼요. 휴대폰 GPS는 이 페이지에서 쓸 수 없어서 지도를 눌러 알리는 방식이에요.</p></div></div>';
  s.hidden=false; document.body.style.overflow="hidden"; S._afterProfile=after||null;
}
async function saveProfile(){
  const nick=($("#nick").value||"").trim().slice(0,10); if(!nick){$("#nick").focus();return}
  const ch=(document.querySelector(".chars [aria-pressed=true]")||{}).dataset; LIVE.me={nick,char:(ch&&ch.char)||LIVE.me.char}; saveMe();
  const mine=LIVE.uid&&LIVE.people[LIVE.uid];
  if(mine&&canPost()){ try{ await LIVE.db.doc("people/"+LIVE.uid).update({nick:LIVE.me.nick,char:LIVE.me.char}); }catch(e){} }
  closeSheet(); renderChat(); const a=S._afterProfile; S._afterProfile=null; if(a) a();
}

/* ================= detail sheet ================= */
let photoUnsub=null, VIEW={list:[],i:0};
function photosOf(p){ return (p.photos||[]).map(x=>({src:x.src,cap:"사진: "+x.author+" · "+x.license+(x.generic?" · 대표 이미지(이 매장 사진 아님)":""),page:x.page})); }
function renderGallery(p,family){
  const el=$("#gal"); if(!el) return;
  const list=photosOf(p).concat(family);
  VIEW.list=list;
  el.innerHTML=list.length?'<div class="gal">'+list.map((x,i)=>'<button type="button" data-view="'+i+'" aria-label="사진 크게 보기"><img src="'+esc(x.src)+'" alt="'+esc(p.name)+' 사진" loading="lazy"><span class="cap">'+esc(x.cap)+'</span></button>').join("")+'</div>'
    :'<div class="photo"><div><b>아직 사진이 없어요</b>여행 중 찍은 사진을 올리면 가족 모두가 볼 수 있어요.<br><a href="'+esc(gmapsOf(p))+'" target="_blank" rel="noopener">구글 지도에서 실제 사진 보기 ↗</a></div></div>';
}
const gmapsOf=p=>p.links&&p.links.gmaps?p.links.gmaps:"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(p.name+" Boracay");
function openPlace(id){
  const p=BYID[id]; if(!p) return;
  S.sel=id;
  const gc=groupCost(p,S.n);
  const menu=(p.menu||[]).length?'<div class="panel"><h3>메뉴판</h3>'+menuTable(p)+'<p class="fine">'+esc(chargeNote(p))+'. 메뉴판 가격이 이 표와 다르면 메뉴판이 맞아요 — 날짜가 오래된 가격은 올랐을 가능성이 커요.</p></div>':"";
  const cost=gc?'<div class="panel"><h3>'+S.n+'명 예상 식사비</h3><dl class="kv num"><dt>1인</dt><dd>'+rng(p.pp[0],p.pp[1],php)+' ('+rng(p.pp[0],p.pp[1],krw)+')</dd>'+
    '<dt>'+S.n+'명 합계</dt><dd><b>'+rng(gc[0],gc[1],php)+'</b> ('+rng(gc[0],gc[1],krw)+')</dd></dl><p class="fine">'+esc(chargeNote(p))+'. 1인 금액은 조사 자료의 추정 범위로, 음료 포함 정도에 따라 달라져요.</p>'+
    (p.fair?'<div class="callout ok"><b>적정 가격</b>'+esc(p.fair)+'</div>':'')+(p.pricey&&p.pricey!=="-"?'<div class="callout warn"><b>비싼 편 기준</b>'+esc(p.pricey)+'</div>':'')+
    (p.premium&&p.premium!=="-"?'<div class="callout"><b>가격이 높은 정당한 이유</b>'+esc(p.premium)+'</div>':'')+'</div>':"";
  const rating=p.osm?'':p.rating?'<span class="badge sun">'+esc(p.rating.site)+' ★'+p.rating.score+' ('+p.rating.count.toLocaleString()+')</span>':'<span class="badge">구글 별점 미확인</span>';
  const info=p.osm?'<div class="panel"><dl class="kv"><dt>종류</dt><dd>'+esc(KINDLABEL[p.kind]||"")+(p.cuisine?" · "+esc(p.cuisine):"")+'</dd><dt>영업시간</dt><dd>'+esc(p.hours||"정보 없음")+'</dd><dt>호텔에서</dt><dd class="num">직선 '+p.route.air+'m · 도보 약 '+p.route.walk.min+'분</dd></dl>'+
      '<div class="callout"><b>아직 조사하지 않은 곳</b>OpenStreetMap에 등록된 위치·이름만 있어요. 메뉴·가격·최신 영업 여부는 구글 지도에서 확인하세요.</div></div>'
    :'<div class="panel"><dl class="kv"><dt>주소</dt><dd>'+esc(p.addr)+'</dd><dt>영업시간</dt><dd>'+esc(p.hours||"미확인")+'</dd><dt>영업 확인</dt><dd>'+esc(p.status||"–")+'</dd>'+
      (isFood(p)?'<dt>가족 단체</dt><dd>'+esc(p.groupNote||"정보 없음")+'</dd>':'')+'<dt>호텔에서</dt><dd class="num">직선 '+p.route.air+'m · 도보 약 '+p.route.walk.min+'분</dd></dl>'+
      (p.tips?'<div class="callout"><b>알아두기</b>'+esc(p.tips)+'</div>':'')+'</div>';
  const canUpload=LIVE.assets&&canPost();
  const s=$("#sheet");
  s.innerHTML='<div class="wrap"><div class="bar"><button type="button" data-close aria-label="닫기"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button><div class="t">'+esc(p.name)+'</div></div>'+
   '<div class="page" style="padding-top:0"><div id="gal"></div>'+
   (canUpload?'<div class="upl"><label class="btn alt" for="upfile">사진 올리기</label><input type="file" id="upfile" accept="image/*" hidden><span class="fine" id="upmsg">직접 찍은 사진만 올려 주세요. 가족 모두에게 보여요.</span></div>':'')+
   '<div class="dhead"><div class="tags"><span class="badge" style="color:var(--c-'+p.cat+')">'+esc(catText(p))+'</span>'+(p.h24?'<span class="badge">24시간</span>':'')+rating+fitBadge(p)+'</div>'+
   '<h2>'+esc(p.name)+'</h2>'+(p.ko?'<div style="color:var(--muted)">'+esc(p.ko)+'</div>':'')+(p.desc?'<p style="margin:4px 0 0">'+esc(p.desc)+'</p>':'')+'</div>'+
   info+cost+menu+
   '<div class="sec-h" style="margin-bottom:0"><h2>호텔 복귀</h2><span>지도 기반 추정</span></div>'+returnHTML(p,false)+
   '<div class="btns"><button type="button" class="btn alt" data-onmap="'+p.id+'">지도에서 경로 보기</button>'+
   '<a class="btn alt" style="text-decoration:none" href="'+esc(gmapsOf(p))+'" target="_blank" rel="noopener">구글 지도 ↗</a>'+
   (p.links&&p.links.official?'<a class="btn alt" style="text-decoration:none" href="'+esc(p.links.official)+'" target="_blank" rel="noopener">공식 사이트 ↗</a>':'')+'</div>'+
   '<p class="src">좌표: '+esc(p.osm?"OSM "+p.osm:p.coordSrc)+(p.coordConf?' (신뢰도 '+esc(p.coordConf)+')':'')+' · 조사일 2026-11-23</p></div></div>';
  s.hidden=false; s.scrollTop=0; document.body.style.overflow="hidden";
  renderGallery(p,[]);
  if(photoUnsub){photoUnsub();photoUnsub=null;}
  if(LIVE.db){ try{ photoUnsub=LIVE.db.collection("photos").where("place","==",p.id).onSnapshot(snap=>{
      const fam=snap.docs.map(d=>d.data()).filter(v=>v&&typeof v.asset==="string"&&/^[A-Za-z0-9_-]+$/.test(v.asset)).sort((a,b)=>b.at-a.at)
        .map(v=>({src:"/_blob/"+v.asset,cap:(v.char||"")+" "+(v.nick||"가족")+"님이 올린 사진 · "+ago(v.at)}));
      renderGallery(p,fam); },()=>{}); }catch(e){} }
  const up=$("#upfile"); if(up) up.addEventListener("change",()=>uploadPhoto(p,up.files[0]));
}
function menuTable(p){
  return '<div class="tbl"><table><thead><tr><th>메뉴</th><th class="r">PHP</th><th class="r">KRW</th></tr></thead><tbody>'+
    p.menu.map(m=>{const pr=priceOf(m.php);return '<tr><td><b>'+esc(m.n)+'</b><br><span style="color:var(--muted);font-size:13px">'+esc(m.ko)+'</span><br><span class="src">'+esc(m.src)+' · '+esc(m.yr)+(m.note?' · '+esc(m.note):'')+'</span></td>'+
      '<td class="r num">'+(pr?rng(pr[0],pr[1],php):"미확인")+'</td><td class="r num">'+(pr?rng(pr[0],pr[1],krw):"–")+'</td></tr>'}).join("")+'</tbody></table></div>';
}
async function uploadPhoto(p,file){
  const msg=$("#upmsg"); if(!file) return;
  if(!/^image\//.test(file.type)){msg.textContent="사진 파일만 올릴 수 있어요."; return;}
  msg.textContent="올리는 중…";
  try{
    const blob=await shrink(file,1600);
    const a=await LIVE.assets.upload(blob);
    await LIVE.db.collection("photos").add({place:p.id,asset:a.id,by:LIVE.uid,nick:LIVE.me.nick||"가족",char:LIVE.me.char,at:Date.now()});
    msg.textContent="올렸어요. 가족 모두에게 보여요.";
  }catch(e){ msg.textContent=e&&e.code==="quota_exceeded"?"저장 공간이 가득 찼어요.":"올리지 못했어요. 편집자 권한이 있는지 확인하세요."; }
}
function shrink(file,max){
  return new Promise((res,rej)=>{ const img=new Image(); const u=URL.createObjectURL(file);
    img.onload=()=>{ const k=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement("canvas"); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(u); c.toBlob(b=>b?res(b):rej(new Error("encode")),"image/jpeg",0.85); };
    img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error("decode"))}; img.src=u; });
}
function openViewer(i){
  VIEW.i=i; const v=$("#viewer"); const x=VIEW.list[i]; if(!x) return;
  v.innerHTML='<div class="vt"><span class="num">'+(i+1)+' / '+VIEW.list.length+'</span><button type="button" data-vclose>닫기</button></div><div class="vi"><img src="'+esc(x.src)+'" alt=""></div>'+
    '<div class="nav2"><button type="button" data-vprev aria-label="이전"'+(i===0?" disabled":"")+'>‹</button><span>'+esc(x.cap)+(x.page?' · <a style="color:#fff" href="'+esc(x.page)+'" target="_blank" rel="noopener">출처</a>':'')+'</span><button type="button" data-vnext aria-label="다음"'+(i===VIEW.list.length-1?" disabled":"")+'>›</button></div>';
  v.hidden=false;
}
function closeSheet(){const s=$("#sheet"); if(photoUnsub){photoUnsub();photoUnsub=null;} if(s.hidden) return; s.hidden=true; document.body.style.overflow="";}
function showDriver(){
  const t=trikes(S.n), d=$("#driver");
  d.innerHTML='<p class="mid">Please take us to</p><p class="big">Henann Garden Resort<br>Station 2</p>'+
   '<p class="mid">'+S.n+' persons'+(t>1?' · '+t+' e-trikes':'')+'<br>How much in total, for the whole trike?</p>'+
   '<p class="ko2">헤난 가든 리조트(스테이션 2)로 가 주세요. '+S.n+'명'+(t>1?', '+t+'대':'')+'. 트라이크 1대 전체 요금이 얼마인가요?<br>탑승 전에 총액을 확인하고, 1대당인지 1인당인지 꼭 물어보세요.</p>'+
   '<button type="button" data-closedriver>닫기</button>';
  d.hidden=false;
}

/* ================= other pages ================= */
function plink(id,label){return '<button type="button" class="plink" data-open="'+esc(id)+'">'+esc(label)+'</button>'}
function renderCourse(){
  const w=id=>'도보 '+BYID[id].route.walk.min+'분';
  const days=[
    ["11.24","화","도착일",[["09:20","인천 T1 출발 (티웨이 TW-125)"],["12:55","칼리보 공항 도착 → 4U 단독 픽업. 밴 약 2시간 + 카티클란 항에서 보트 → 카그반 항 → 호텔 (총 2.5~3시간 예상)"],
      ["16:00경","헤난 가든 체크인 (15:00부터). <b>1명 추가 등록</b> — 그랜드룸은 최대 3명, 3번째 인원 1박 ₱1,232(조식 포함, 호텔 예약 페이지 기준)"],["17:25","화이트비치 일몰 (11/25 기준 약 17:25)"],
      ["18:30",plink("gerrys","Gerry's Grill")+" — 첫날은 가까운 곳에서 ("+w("gerrys")+")"],["밤",plink("seven-remedios","7-Eleven")+"이나 "+plink("budgetmart","Budget Mart")+"에서 물·간식"]]],
    ["11.25","수","해변·시장",[["오전","리조트 수영장 (08:00–22:00) · 화이트비치 산책"],["12:00",plink("talipapa","D'Talipapa")+" 해산물 파루토 — 7명 단체 체험 식사. kg당 가격부터 확정"],
      ["15:00","디몰 구경 → "+plink("halomango","HaloMango")+" 망고 빙수 (패밀리 사이즈)"],["19:00",plink("subo","Subo")+" 저녁 + 전통춤 공연 (예약 권장, "+w("subo")+")"]]],
    ["11.26","목","액티비티 선택일",[["오전","아일랜드 호핑·헬멧다이빙 등 (원하면 현지 예약 — 가격 가이드 탭 참고가 확인)"],["점심",plink("manginasal","Mang Inasal")+" 또는 "+plink("smoke","Smoke")+" — 저렴하고 빠르게"],
      ["오후","리조트 휴식"],["19:00",plink("aria","Aria")+" 해변 이탈리안 (예약 권장, 서비스차지 10% 별도)"]]],
    ["11.27","금","여유·쇼핑",[["08:30",plink("nonies","Nonie's")+" 브런치 — 해변 따라 남쪽으로 산책 ("+w("nonies")+")"],["오후",plink("realcoffee","Real Coffee")+" 깔라만시 머핀(선물용 6개 ₱360) · "+plink("budgetmart","Budget Mart")+" 말린 망고"],
      ["18:30",plink("dosmestizos","Dos Mestizos")+" 대형 파에야 — 30~45분 걸리니 미리 주문"],["밤","짐 정리 · 4U 픽업 시간 재확인"]]],
    ["11.28","토","귀국일",[["06:30","조식 (보통 06:00–10:00, 현장 확인)"],["07:30–08:00","호텔 출발 권장 — 국제선 3시간 전 공항 도착 기준 계산값. <b>최종 시간은 4U 안내를 따르세요</b>"],["13:55","칼리보 출발 (TW-126) → 19:05 인천 T1 도착"]]]
  ];
  const withMenu=D.places.filter(p=>(p.menu||[]).length).sort((a,b)=>a.route.walk.m-b.route.walk.m);
  const groups=[["restaurant","음식점"],["cafe","카페·디저트"],["pub","바·펍"]];
  const food=ALL.filter(isFood).sort((a,b)=>a.route.walk.m-b.route.walk.m);
  $("#app").innerHTML='<div class="page"><h2>추천 코스</h2><p class="lead">예약된 일정이 아니라 헤난 가든 기준 동선으로 짠 추천안이에요. 장소 이름을 누르면 상세 정보와 호텔 복귀 길이 열려요.</p>'+
   days.map(d=>'<section class="day"><header><b class="num">'+d[0]+' ('+d[1]+')</b><span>'+d[2]+'</span></header>'+d[3].map(s=>'<div class="slot"><time>'+s[0]+'</time><div>'+s[1]+'</div></div>').join("")+'</section>').join("")+
   '<h2 id="menus">메뉴판 모음</h2><p class="lead">조사한 '+withMenu.length+'곳의 대표 메뉴를 페소·원화로 정리했어요. 호텔에서 가까운 순서예요.</p>'+
   '<div class="panel">'+withMenu.map(p=>'<details class="menu"><summary>'+esc(p.name)+' <span class="num">도보 '+p.route.walk.min+'분 · '+(p.pp?rng(p.pp[0],p.pp[1],php)+'/1인':'')+'</span></summary>'+menuTable(p)+
     '<p class="fine">'+esc(chargeNote(p))+' · '+plink(p.id,"상세 보기")+'</p></details>').join("")+'</div>'+
   '<h2 id="allfood">주변 식당·카페 전체</h2><p class="lead">OpenStreetMap에 등록된 스테이션 1~3 음식점·카페·바 '+food.length+'곳이에요(조사한 곳 포함). 구글 지도 데이터는 이 사이트로 가져올 수 없어서, 각 상세 화면의 ‘구글 지도’ 버튼으로 최신 정보·사진을 확인하세요.</p>'+
   groups.map(([c,l])=>{const arr=food.filter(p=>p.cat===c); return '<div class="panel"><h3>'+l+' <span class="fine">'+arr.length+'곳 · 가까운 순</span></h3><div class="plist">'+
     arr.map(p=>'<button type="button" data-open="'+esc(p.id)+'" style="--pc:var(--c-'+p.cat+')"><span class="dot"></span><span><span class="nm">'+esc(p.name)+'</span>'+(p.osm?'':' <span class="badge ok">조사함</span>')+'<br><span class="sub">'+esc(p.osm?[KINDLABEL[p.kind],p.cuisine,p.hours].filter(Boolean).join(" · "):(p.ko+" · "+(p.hours||"")))+'</span></span><span class="w num">도보 '+p.route.walk.min+'분</span></button>').join("")+'</div></div>';}).join("")+'</div>';
}
function renderPrices(){
  const fx=D.fx, n=S.n;
  const rows=D.places.filter(p=>p.pp&&isFood(p)).map(p=>({p,g:groupCost(p,n)})).sort((a,b)=>a.g[0]-b.g[0]);
  $("#app").innerHTML='<div class="page"><h2>가격 가이드</h2><p class="lead">비싸다고 무조건 바가지는 아니에요. 가격을 <b>미리 확인했는지</b>가 핵심이에요.</p>'+
  '<div class="panel"><h3>환율 계산기</h3><p class="fine">기준: 1 USD = ₱'+fx.php_per_usd.toFixed(2)+' · ₱1 = ₩'+fx.krw_per_php.toFixed(2)+' ('+esc(fx.src)+', '+esc(fx.at)+'). 시장 환율이라 환전소에서 받는 금액은 이보다 조금 적어요.</p>'+
   '<div class="fx"><label for="fx-usd">달러 (USD)<input id="fx-usd" inputmode="decimal" value="100"></label><label for="fx-php">페소 (PHP)<input id="fx-php" inputmode="decimal"></label><label for="fx-krw">원 (KRW)<input id="fx-krw" inputmode="decimal"></label></div></div>'+
  '<div class="panel"><h3>계산서 읽는 법</h3><ul class="clean"><li><b>VAT 12%</b>: 메뉴판 아래 "VAT inclusive"(포함) / "exclusive"(별도) 표기를 확인해요.</li><li><b>서비스차지 10%</b>: 필리핀에서 흔하고 정상이에요(의무는 아님). 붙어 있으면 팁은 따로 안 줘도 돼요.</li><li>예) Aria는 메뉴에 "VAT 포함, 서비스차지 10% 별도" — 음식 ₱5,000이면 계산서 ₱5,500이 정상이에요.</li><li>서비스차지가 없으면 팁은 10% 안팎이면 충분해요.</li></ul></div>'+
  '<div class="panel"><h3>'+n+'명 식사 적정 총액</h3><p class="fine">조사 자료의 1인 추정 범위 × '+n+'명, 서비스차지가 확인된 곳은 10% 반영. 지도 탭의 인원 선택에 따라 바뀌어요.</p><div class="tbl"><table><thead><tr><th>장소</th><th class="r">'+n+'명 PHP</th><th class="r">KRW</th></tr></thead><tbody>'+
   rows.map(({p,g})=>'<tr><td>'+plink(p.id,p.name)+'<br><span class="src">'+esc(chargeNote(p))+'</span></td><td class="r num">'+rng(g[0],g[1],php)+'</td><td class="r num">'+rng(g[0],g[1],krw)+'</td></tr>').join("")+'</tbody></table></div></div>'+
  '<div class="panel"><h3>e-트라이크 타기 전에</h3><ul class="clean"><li>보라카이엔 미터 택시도 Grab 차량 호출도 없어요. 이동은 걷기 아니면 e-트라이크예요.</li><li>타기 전에 <b>"How much in total?"</b> — 1대 전체 요금인지, 1인당인지 확인해요.</li><li>합승(shared)이면 1인 약 ₱15–30, 전세(special)면 가까운 거리 1대 약 ₱100–150.</li><li>7명이면 2대가 편해요 (1대 약 6명까지, 편하게는 4~5명).</li><li>공식 요금표(말레이 조례)가 있지만 원문은 확인 못 했어요 — 아래는 블로그 기준 참고가예요.</li></ul>'+
   '<div class="tbl"><table><thead><tr><th>구간 (전세 1대)</th><th class="r">참고가</th></tr></thead><tbody>'+
   [["스테이션 2 → 스테이션 1","약 ₱150 (추정)"],["→ 카그반 항","약 ₱150"],["→ 디니위드 비치","약 ₱250"],["→ 푸카 비치","약 ₱300–350"],["시간제 투어 (최대 4명)","₱500 / 시간"]].map(r=>'<tr><td>'+r[0]+'</td><td class="r num">'+r[1]+'</td></tr>').join("")+
   '</tbody></table></div><button type="button" class="btn" data-driver="1">기사님께 보여주기 (영어)</button></div>'+
  '<div class="panel"><h3>해산물 kg당 가격 (디탈리파파)</h3><div class="tbl"><table><thead><tr><th>품목</th><th class="r">1kg</th><th class="r">KRW</th></tr></thead><tbody>'+
   [["새우",250,500],["게",400,400],["랍스터",600,800],["조리비 (kg당)",100,250]].map(r=>'<tr><td>'+r[0]+'</td><td class="r num">'+rng(r[1],r[2],php)+'</td><td class="r num">'+rng(r[1],r[2],krw)+'</td></tr>').join("")+
   '</tbody></table></div><ul class="clean"><li>사기 전에 <b>kg당 가격</b>을 먼저 정해요.</li><li>눈앞에서 물을 빼고 무게를 달게 해요.</li><li>조리비가 kg당인지 요리 1개당인지 확인해요.</li><li>호객꾼을 따라가지 말고 직접 골라요. 현금만 받는 곳이 많아요.</li><li>랍스터·라푸라푸는 원래 비싸요. 가격을 확인했다면 바가지가 아니에요.</li></ul><p class="fine">가격 출처는 날짜가 불분명하거나 오래된 블로그예요. 시즌과 흥정에 따라 달라요.</p></div>'+
  '<div class="panel"><h3>투어 참고가 (온라인 예약 사이트)</h3><div class="tbl"><table><tbody>'+
   [["아일랜드 호핑 + 헬멧다이빙 + 점심","약 US$58–61 / 1인"],["헬멧다이빙만 (20분)","약 US$21 / 1인"],["아일랜드 호핑 + 패러세일링","약 US$41–72 / 1인"],["섬 입장료 (보통 불포함)","₱100–300 / 1인"]].map(r=>'<tr><td>'+r[0]+'</td><td class="r num">'+r[1]+'</td></tr>').join("")+
   '</tbody></table></div><p class="fine">포함 항목(점심·픽업·입장료)이 다르니 비교해서 고르세요. 해변 현장 가격은 확인 못 했어요. 공인(DOT 인증) 업체를 이용하세요.</p></div>'+
  '<div class="panel"><h3>환전 · ATM</h3><ul class="clean"><li>구김·낙서 없는 새 달러를 준비해요. 손상된 지폐는 거절되거나 낮게 쳐줘요.</li><li>창구 앞에서 바로 세어 보고 떠나요. "No commission" 문구만 믿지 말고 환율을 비교해요.</li><li>디몰에 M Lhuillier 등 환전소가 있어요. 호텔 프런트도 되지만 조금 불리해요.</li><li>BDO ATM은 해외카드 1회 ₱250 수수료가 붙어요.</li><li>노점·트라이크·시장은 현금, 큰 식당·리조트는 카드 가능.</li></ul></div></div>';
  const u=$("#fx-usd"),p=$("#fx-php"),k=$("#fx-krw");
  const num=v=>parseFloat(String(v).replace(/,/g,""))||0, f=(v,d)=>v?v.toLocaleString("en-US",{maximumFractionDigits:d}):"";
  function from(src){const x=num(src.value);
    if(src===u){p.value=f(x*fx.php_per_usd,0);k.value=f(x*fx.php_per_usd*fx.krw_per_php,0)}
    if(src===p){u.value=f(x/fx.php_per_usd,2);k.value=f(x*fx.krw_per_php,0)}
    if(src===k){p.value=f(x/fx.krw_per_php,0);u.value=f(x/fx.krw_per_php/fx.php_per_usd,2)}}
  [u,p,k].forEach(i=>i.addEventListener("input",()=>from(i))); from(u);
}
function renderInfo(){
  const extra=1232*4;
  $("#app").innerHTML='<div class="page"><h2>여행 정보</h2>'+
  '<div class="panel"><h3>항공 (티웨이 · 일반석)</h3><dl class="kv num"><dt>가는 편</dt><dd>11/24(화) TW-125 · 인천 T1 09:20 → 칼리보 12:55</dd><dt>오는 편</dt><dd>11/28(토) TW-126 · 칼리보 13:55 → 인천 T1 19:05</dd><dt>수하물</dt><dd>1인 기내 10kg + 위탁 15kg</dd><dt>체크인</dt><dd>출발 최소 90분 전, e-티켓과 여권 제시</dd></dl><p class="fine">시간은 모두 현지 공항 시간이에요. 필리핀은 한국보다 1시간 느려요.</p></div>'+
  '<div class="panel"><h3>4U 단독 픽업 — 미리 확인할 것</h3><ul class="clean"><li>칼리보 → 카티클란 항 밴 약 2시간, 총 2.5~3시간</li><li>항구 요금(외국인 1인): 터미널피 ₱150 + 환경세 ₱300 + 보트 약 ₱50 → 약 ₱500, 7명이면 약 '+php(3500)+' ('+krw(3500)+')</li><li>위 요금이 4U 패키지에 포함인지, 카그반 항 → 호텔 구간 포함인지 4U에 확인</li><li>귀국일 호텔 픽업 시간 확인 (계산상 07:30–08:00 출발 권장)</li></ul></div>'+
  '<div class="panel"><h3>숙소 — 헤난 가든 리조트</h3><dl class="kv num"><dt>객실</dt><dd>그랜드룸 3개 (방당 기본 2명, 최대 3명)</dd><dt>체크인/아웃</dt><dd>15:00 / 12:00</dd><dt>추가 1명</dt><dd>1박 ₱1,232 (조식 포함) × 4박 = <b>'+php(extra)+'</b> ('+krw(extra)+')</dd><dt>수영장</dt><dd>야외 4개 + 키즈풀, 08:00–22:00</dd><dt>위치</dt><dd>스테이션 2, 화이트비치에서 한 블록 안쪽</dd></dl>'+
   '<div class="callout warn"><b>체크인 때 1명 추가 등록</b>예약 시 인원을 추가하지 못했으니, 체크인할 때 3명이 쓰는 방에 1명을 추가해요. 요금은 헤난 예약 페이지 문구 기준이니 현장에서 다시 확인하세요.</div></div>'+
  '<div class="panel"><h3>환전 준비</h3><p>달러 현금을 가져가요. 오늘 기준 <b class="num">$100 ≈ '+php(100*D.fx.php_per_usd)+' ≈ '+krw(100*D.fx.php_per_usd)+'</b> (시장 환율). <a href="#prices">환율 계산기 →</a></p></div>'+
  '<div class="panel"><h3>채팅·위치 공유 쓰는 법</h3><ul class="clean"><li>이 페이지 소유자가 공유 메뉴에서 가족을 <b>이메일로 편집자 초대</b>해야 글쓰기·위치 공유가 돼요. 링크만 받은 사람은 볼 수만 있어요.</li><li>처음에 이름과 캐릭터를 정하고, ‘내 위치 알리기’ → 지도에서 있는 곳을 누르면 가족 지도에 캐릭터가 떠요.</li><li>휴대폰 GPS는 이 페이지에서 쓸 수 없어서 자동으로 따라가지 않아요. 움직이면 다시 알려 주세요.</li><li>가족 캐릭터를 누르고 ‘따라가기’를 누르면 그 사람까지 가는 길과 시간이 나와요.</li></ul></div>'+
  '<div class="panel"><h3>날씨 · 시간</h3><ul class="clean"><li>11월 말은 북동풍(아미한) 시작 — 화이트비치(서쪽)는 잔잔, 불라복 비치(동쪽)는 바람이 세요.</li><li>일몰 약 17:25.</li><li>필리핀 = 한국 − 1시간.</li></ul></div>'+
  '<div class="panel"><h3>긴급 연락처</h3><dl class="kv num"><dt>국가 긴급번호</dt><dd>911</dd><dt>티롤 병원 (24시간 응급실)</dt><dd>(036) 288-3041 · '+plink("tirol","지도")+'</dd><dt>주필리핀 대사관 (긴급)</dt><dd>+63-917-817-5703</dd><dt>대사관 대표</dt><dd>+63-2-8856-9210</dd><dt>영사콜센터 (24시간)</dt><dd>+82-2-3210-0404</dd></dl><p class="fine">전화 링크는 앱 안에서 작동하지 않을 수 있어 번호를 글자로 적었어요. 티롤 병원은 간단한 응급만 가능하고 중증은 칼리보로 이송돼요.</p></div>'+
  '<div class="panel"><h3>지도에 표시하지 않은 곳</h3>'+D.unplaced.map(u=>'<p><b>'+esc(u.name)+' ('+esc(u.ko)+')</b> — '+esc(u.note)+' <a href="'+esc(u.gmaps)+'" target="_blank" rel="noopener">구글 지도 ↗</a></p>').join("")+'</div>'+
  '<div class="panel"><h3>데이터 출처와 한계</h3><ul class="clean"><li>지도·좌표·영업시간 일부: © OpenStreetMap 기여자 (ODbL), 2026-11-23 수집</li><li>메뉴·가격·영업 확인: 공식 사이트, Philippine Primer, Booky, Tripadvisor 등 웹 조사 (2026-11-23). 각 항목에 출처와 연도를 표시했어요.</li><li>구글 지도의 식당 목록·별점·사진은 이 사이트로 가져올 수 없어요(접근 불가·이용약관). 대신 각 장소에 구글 지도 버튼을 달았어요.</li><li>경로·시간은 실시간이 아닌 지도 기반 추정이에요.</li><li>환율: '+esc(D.fx.src)+' ('+esc(D.fx.at)+')</li></ul></div></div>';
}

/* ================= routing (hash) ================= */
function route(){
  const h=decodeURIComponent((location.hash||"#map").slice(1));
  if(h.startsWith("p-")){ if(!$("#cv")) renderMapTab(); openPlace(h.slice(2)); setNav("map"); return; }
  closeSheet();
  const tab=["map","course","prices","info"].includes(h)?h:"map";
  if(tab==="map"){ if(!$("#cv")) renderMapTab(); else MAP.resize(); }
  else { MAP=null; S.pick=null; ({course:renderCourse,prices:renderPrices,info:renderInfo})[tab](); window.scrollTo(0,0); }
  setNav(tab);
}
function setNav(t){document.querySelectorAll(".nav a").forEach(a=>{if(a.dataset.tab===t)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")})}

document.addEventListener("click",e=>{
  const T=s=>e.target.closest(s);
  let el;
  if(el=T("[data-open]")){ e.preventDefault(); location.hash="p-"+el.dataset.open; return; }
  if(T("[data-close]")){ if(!$("#sheet").hidden&&!location.hash.startsWith("#p-")){closeSheet();return} history.length>1&&location.hash.startsWith("#p-")?history.back():(location.hash="map"); return; }
  if(el=T("[data-onmap]")){ const id=el.dataset.onmap; location.hash="map"; setTimeout(()=>{ if(MAP){ if(!matches(BYID[id],S.cat)){S.cat="all";renderMapTab();} if(BYID[id].osm&&!S.all){} select(id,{pan:true,scroll:true}); $("#mapbox").scrollIntoView({block:"center"}); } },60); return; }
  if(T("[data-driver]")){ showDriver(); return; }
  if(T("[data-closedriver]")){ $("#driver").hidden=true; return; }
  if(el=T("[data-view]")){ openViewer(+el.dataset.view); return; }
  if(T("[data-vclose]")){ $("#viewer").hidden=true; return; }
  if(T("[data-vprev]")){ openViewer(Math.max(0,VIEW.i-1)); return; }
  if(T("[data-vnext]")){ openViewer(Math.min(VIEW.list.length-1,VIEW.i+1)); return; }
  if(el=T(".mode[data-mode]")){ S.mode=el.dataset.mode; if($("#ret")&&!el.closest(".sheet")) renderReturn(); else el.parentElement.querySelectorAll(".mode").forEach(b=>b.setAttribute("aria-pressed",b===el)); return; }
  if(el=T(".mode[data-fmode]")){ S.mode=el.dataset.fmode; renderFollow(); return; }
  if(T("[data-pick]")){ startPick(); return; }
  if(T("[data-pickcancel]")){ S.pick=null; renderPick(); return; }
  if(T("[data-pickhotel]")){ S.pick=null; renderPick(); shareLocation(0,0); return; }
  if(T("[data-pickok]")){ const p=S.pick; S.pick=null; renderPick(); shareLocation(p.x,p.y); return; }
  if(T("[data-profile]")){ openProfile(); return; }
  if(el=T("[data-char]")){ document.querySelectorAll(".chars button").forEach(b=>b.setAttribute("aria-pressed",b===el)); return; }
  if(T("[data-saveprofile]")){ saveProfile(); return; }
  if(T("[data-stopshare]")){ stopSharing(); S.person=null; renderFollow(); return; }
  if(T("[data-closeperson]")){ S.person=null; S.follow=null; renderFollow(); renderReturn(); return; }
  if(el=T("[data-follow]")){ startFollow(el.dataset.follow); return; }
  if(T("[data-stopfollow]")){ stopFollow(); return; }
  if(T("[data-chatsize]")){ chatBig=!chatBig; renderChat(); return; }
  if(T("#noticeToggle")){ noticeOn=!noticeOn; renderChat(); const i=$("#chatIn"); if(i) i.focus(); return; }
  if(el=T("[data-locx]")){ const x=+el.dataset.locx,y=+el.dataset.locy; if(MAP){ MAP.flyTo(x,y); $("#mapbox").scrollIntoView({block:"center",behavior:"smooth"}); } return; }
  if(el=T(".card")){ if(T("button")) return; select(el.dataset.id,{pan:true}); return; }
});
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ if(!$("#viewer").hidden) $("#viewer").hidden=true; else if(!$("#driver").hidden) $("#driver").hidden=true; else if(!$("#sheet").hidden) location.hash="map"; }
  if(e.key==="Enter"&&e.target.classList&&e.target.classList.contains("card")) select(e.target.dataset.id,{pan:true}); });
window.addEventListener("hashchange",route);

/* ================= map ================= */
function makeMap(box,cv,pinsEl){
  const ctx=cv.getContext("2d");
  const st={cx:-40,cy:-120,scale:0.5,w:0,h:0,dpr:1,route:null,mode:"walk",anim:0,temp:null};
  let colors={};
  function readColors(){const cs=getComputedStyle(document.documentElement);
    ["sea","land","sand","green","pool","road","casing","path","label","halo","accent","sun","ink","surface","follow"].forEach(k=>colors[k]=cs.getPropertyValue("--"+k).trim());}
  readColors();
  const mq=window.matchMedia("(prefers-color-scheme: dark)"); if(mq.addEventListener) mq.addEventListener("change",()=>{readColors();draw()});
  new MutationObserver(()=>{readColors();draw()}).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  const L=D.map, pinMap={}, avaMap={};
  function resize(){const r=box.getBoundingClientRect(); st.w=r.width; st.h=r.height; st.dpr=Math.min(window.devicePixelRatio||1,3);
    cv.width=Math.round(st.w*st.dpr); cv.height=Math.round(st.h*st.dpr); draw();}
  const sx=x=>(x-st.cx)*st.scale+st.w/2, sy=y=>(y-st.cy)*st.scale+st.h/2;
  const wx=X=>(X-st.w/2)/st.scale+st.cx, wy=Y=>(Y-st.h/2)/st.scale+st.cy;
  function path(a,close){ctx.moveTo(sx(a[0]),sy(a[1])); for(let i=2;i<a.length;i+=2) ctx.lineTo(sx(a[i]),sy(a[i+1])); if(close) ctx.closePath();}
  function fillLayer(arr,col){ctx.beginPath(); arr.forEach(a=>path(a,true)); ctx.fillStyle=col; ctx.fill("evenodd");}
  function draw(){
    if(!st.w) return;
    ctx.setTransform(st.dpr,0,0,st.dpr,0,0);
    ctx.fillStyle=colors.sea; ctx.fillRect(0,0,st.w,st.h);
    fillLayer(L.land,colors.land); fillLayer(L.green,colors.green); fillLayer(L.beach,colors.sand); fillLayer(L.water,colors.pool);
    ctx.lineCap="round"; ctx.lineJoin="round";
    const W={1:9,2:7,3:5.5,4:4,5:2.2};
    ctx.beginPath(); L.roads.forEach(r=>{if(r.c===5) path(r.p)}); ctx.strokeStyle=colors.path; ctx.setLineDash([Math.max(2,6*st.scale),Math.max(2,4*st.scale)]); ctx.lineWidth=Math.max(1,W[5]*st.scale); ctx.stroke(); ctx.setLineDash([]);
    for(const pass of ["casing","fill"]) for(const c of [4,3,2,1]){
      ctx.beginPath(); L.roads.forEach(r=>{if(r.c===c) path(r.p)});
      const w=Math.max(c<=2?2.2:1.4,W[c]*st.scale); ctx.strokeStyle=pass==="casing"?colors.casing:colors.road; ctx.lineWidth=pass==="casing"?w+2:w; ctx.stroke();
    }
    if(st.route){
      ctx.beginPath(); path(st.route); ctx.strokeStyle=colors.surface; ctx.lineWidth=8; ctx.stroke();
      ctx.beginPath(); path(st.route); ctx.strokeStyle=st.mode==="walk"?colors.accent:st.mode==="follow"?colors.follow:colors.sun; ctx.lineWidth=4.5;
      if(st.mode==="walk") ctx.setLineDash([7,6]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.font="600 12px "+getComputedStyle(document.body).fontFamily; ctx.textAlign="center"; ctx.textBaseline="middle";
    D.landmarks.forEach(l=>{const x=sx(l.x),y=sy(l.y); if(x<-50||x>st.w+50||y<-20||y>st.h+20) return;
      ctx.lineWidth=3.5; ctx.strokeStyle=colors.halo; ctx.strokeText(l.ko,x,y); ctx.fillStyle=colors.label; ctx.fillText(l.ko,x,y);});
    placePins();
  }
  function placeEl(el,x,y,anchor){ el.style.transform="translate("+x.toFixed(1)+"px,"+y.toFixed(1)+"px) "+anchor; el.style.visibility=(x<-30||x>st.w+30||y<-10||y>st.h+50)?"hidden":"visible"; }
  function placePins(){
    for(const id in pinMap){const {el,p}=pinMap[id]; placeEl(el,sx(p.x),sy(p.y),p.osm?"translate(-50%,-50%)":"translate(-50%,-100%)");}
    for(const id in avaMap){const {el,p}=avaMap[id]; placeEl(el,sx(p.x),sy(p.y),"translate(-50%,-22px)");}
    hotel.style.transform="translate("+sx(0).toFixed(1)+"px,"+sy(0).toFixed(1)+"px) translate(-50%,-50%)";
    if(tempEl){ if(st.temp){tempEl.hidden=false; tempEl.style.transform="translate("+sx(st.temp.x).toFixed(1)+"px,"+sy(st.temp.y).toFixed(1)+"px) translate(-50%,-50%)";} else tempEl.hidden=true; }
  }
  const hotel=document.createElement("button"); hotel.type="button"; hotel.className="hotelpin"; hotel.setAttribute("aria-label","헤난 가든 리조트");
  hotel.innerHTML='<span class="b">'+ICON.hotel+'헤난 가든</span>'; pinsEl.appendChild(hotel);
  hotel.addEventListener("click",()=>{ if(S.pick){ S.pick={x:0,y:0}; renderPick(); return; } animateTo(0,0,Math.max(st.scale,0.9))});
  const tempEl=document.createElement("div"); tempEl.className="tmp"; tempEl.hidden=true; pinsEl.appendChild(tempEl);
  function setPins(on,sel){
    ALL.forEach(p=>{
      let o=pinMap[p.id];
      if(!o){const el=document.createElement("button"); el.type="button"; el.style.setProperty("--pc","var(--c-"+p.cat+")"); el.setAttribute("aria-label",p.name);
        if(p.osm){el.className="dp";} else {el.className="pin"; el.innerHTML='<span class="b">'+ICON[p.cat]+'</span><span class="t"></span>'; el.querySelector(".t").textContent=p.name;}
        el.addEventListener("click",ev=>{ev.stopPropagation(); if(S.pick){ S.pick={x:p.x,y:p.y}; renderPick(); return; } if(p.osm&&!S.all){ S.sel=p.id; setPins(on,p.id); renderReturn(); location.hash="p-"+p.id; return;} select(p.id,{scroll:true});});
        pinsEl.insertBefore(el,hotel); o=pinMap[p.id]={el,p};}
      const active=on(p);
      o.el.classList.toggle("dim",!active); o.el.classList.toggle("sel",p.id===sel); if(!p.osm) o.el.classList.toggle("h24",!!p.h24);
      o.el.style.zIndex=p.id===sel?3:active?(p.osm?1:2):0;
    });
    placePins();
  }
  function setPeople(){
    const ppl=LIVE.people; const ids=Object.keys(ppl);
    for(const id in avaMap) if(!ppl[id]){avaMap[id].el.remove(); delete avaMap[id];}
    ids.forEach(id=>{ const p=ppl[id]; let o=avaMap[id];
      if(!o){const el=document.createElement("button"); el.type="button"; el.className="ava"; el.innerHTML='<span class="f"></span><span class="n"></span>';
        el.addEventListener("click",ev=>{ev.stopPropagation(); if(S.pick){ S.pick={x:o.p.x,y:o.p.y}; renderPick(); return; } openPerson(id);}); pinsEl.appendChild(el); o=avaMap[id]={el,p};}
      o.p=p; o.el.querySelector(".f").textContent=p.char||"🙂";
      const n=o.el.querySelector(".n"); n.textContent=(p.nick||"가족")+(id===LIVE.uid?" (나)":"")+" "; const sm=document.createElement("small"); sm.textContent=ago(p.at); n.appendChild(sm);
      o.el.classList.toggle("me",id===LIVE.uid); o.el.classList.toggle("old",Date.now()-p.at>STALE_MS);
      o.el.setAttribute("aria-label",(p.nick||"가족")+" 위치, "+ago(p.at));
    });
    placePins();
  }
  function setRoute(pk,mode){st.route=pk; st.mode=mode; draw();}
  function setTemp(t){st.temp=t; placePins();}
  function fitPts(pts,maxScale){
    let a=1e9,b=1e9,c=-1e9,d=-1e9; pts.concat([[0,0]]).forEach(([x,y])=>{a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y)});
    const pad=48, s=Math.min((st.w-pad*2)/Math.max(c-a,60),(st.h-pad*2-30)/Math.max(d-b,60));
    const sc=Math.min(maxScale||1.6,Math.max(0.12,s)); animateTo((a+c)/2,(b+d)/2+10/sc,sc);
  }
  function fitTo(list){ fitPts(list.slice(0,8).map(p=>[p.x,p.y]),1.4); }
  function showPts(flat){ const pts=[]; for(let i=0;i<flat.length;i+=2) pts.push([flat[i],flat[i+1]]); fitPts(pts,1.8); }
  function flyTo(x,y){ animateTo(x,y,Math.max(st.scale,1.1)); }
  function animateTo(cx,cy,sc){
    const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const f={cx:st.cx,cy:st.cy,s:st.scale}, t0=performance.now(), dur=reduce?0:320; cancelAnimationFrame(st.anim);
    (function step(t){const k=dur?Math.min(1,(t-t0)/dur):1, e=1-Math.pow(1-k,3);
      st.cx=f.cx+(cx-f.cx)*e; st.cy=f.cy+(cy-f.cy)*e; st.scale=f.s*Math.pow(sc/f.s,e); draw(); if(k<1) st.anim=requestAnimationFrame(step);})(t0);
  }
  function zoomAt(mx,my,k){ const ns=Math.min(4,Math.max(0.08,st.scale*k)); const X=wx(mx),Y=wy(my); st.scale=ns; st.cx=X-(mx-st.w/2)/st.scale; st.cy=Y-(my-st.h/2)/st.scale; draw(); }
  const pts=new Map(); let last=null, lastTap=0, moved=0;
  box.addEventListener("pointerdown",e=>{ if(e.target.closest(".mapctl,.pickbar,.pin,.dp,.ava,.hotelpin")) return; box.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); moved=0; cancelAnimationFrame(st.anim); last=null; });
  box.addEventListener("pointermove",e=>{ if(!pts.has(e.pointerId)) return; const prev=pts.get(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); const r=box.getBoundingClientRect();
    if(pts.size===1){ const dx=e.clientX-prev.x, dy=e.clientY-prev.y; moved+=Math.abs(dx)+Math.abs(dy); st.cx-=dx/st.scale; st.cy-=dy/st.scale; draw(); }
    else if(pts.size===2){ const [a,b]=[...pts.values()], d=Math.hypot(a.x-b.x,a.y-b.y), mx=(a.x+b.x)/2-r.left, my=(a.y+b.y)/2-r.top;
      if(last){ zoomAt(mx,my,d/last.d); st.cx-=(mx-last.mx)/st.scale; st.cy-=(my-last.my)/st.scale; draw(); } last={d,mx,my}; moved+=10; } });
  const up=e=>{ if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId); last=null;
    if(pts.size===0&&moved<6&&e.type==="pointerup"){ const r=box.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
      if(S.pick){ S.pick={x:Math.round(wx(mx)),y:Math.round(wy(my))}; renderPick(); return; }
      const now=Date.now(); if(now-lastTap<300){ zoomAt(mx,my,1.8); lastTap=0;} else lastTap=now; } };
  box.addEventListener("pointerup",up); box.addEventListener("pointercancel",up);
  box.addEventListener("wheel",e=>{ e.preventDefault(); const r=box.getBoundingClientRect(); zoomAt(e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*0.0018)); },{passive:false});
  box.querySelector("#zin").addEventListener("click",()=>animateTo(st.cx,st.cy,Math.min(4,st.scale*1.6)));
  box.querySelector("#zout").addEventListener("click",()=>animateTo(st.cx,st.cy,Math.max(0.08,st.scale/1.6)));
  box.querySelector("#zhome").addEventListener("click",()=>animateTo(0,-60,0.75));
  box.querySelector("#zme").addEventListener("click",()=>{ const m=myLoc(); if(m&&!S.pick) flyTo(m.x,m.y); startPick(); });
  if(window.ResizeObserver) new ResizeObserver(resize).observe(box); else window.addEventListener("resize",resize);
  resize();
  return {setPins,setPeople,setRoute,setTemp,fitTo,showPts,flyTo,resize,draw,_st:st};
}

/* ================= boot ================= */
Promise.all([fetch("data.json").then(r=>r.json()),fetch("map.json").then(r=>r.json())]).then(([d,m])=>{
  D=d; D.map=m; G=buildGraph(m.graph);
  HW=dijkstra(G.entry,false); HT=dijkstra(G.entry,true);
  const others=(d.others||[]).map(o=>Object.assign({},o,{osm:o.osm}));
  ALL=d.places.concat(others); ALL.forEach(p=>{p.route=routeToHotel(p.x,p.y); BYID[p.id]=p;});
  route(); initLive();
  setInterval(()=>{ if(MAP&&Object.keys(LIVE.people).length) MAP.setPeople(); },60000);
}).catch(err=>{ $("#app").innerHTML='<div class="loading">데이터를 불러오지 못했어요. 새로고침해 주세요.<br><small>'+esc(err.message)+'</small></div>'; });
})();

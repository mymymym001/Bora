// 로컬 테스트용 window.claude 모의 구현 (db·user). 실제 아티팩트에서는 플랫폼이 제공.
(function(){
  if(!window.__fresh){ try{ if(!localStorage.getItem('bora-me')) localStorage.setItem('bora-me',JSON.stringify({nick:'수복',char:'🐢',reg:true})); }catch(e){} }
  const store=new Map(); const subs=new Set();
  const snapDoc=(id,data)=>({id,exists:data!==undefined,data:()=>data,metadata:{fromCache:false,hasPendingWrites:false}});
  function runQuery(q){ let docs=[...store.entries()].filter(([p])=>{const s=p.split("/");return s.slice(0,-1).join("/")===q.path}).map(([p,v])=>snapDoc(p.split("/").pop(),v));
    q.f.forEach(([k,op,v])=>{docs=docs.filter(d=>op==="=="?d.data()[k]===v:true)});
    if(q.o) docs.sort((a,b)=>(a.data()[q.o[0]]-b.data()[q.o[0]])*(q.o[1]==="desc"?-1:1));
    if(q.l) docs=docs.slice(0,q.l); return {docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}}; }
  const notify=()=>setTimeout(()=>subs.forEach(s=>s()),0);
  function query(path,f=[],o=null,l=0){ const q={path,f,o,l}; return {
    where:(k,op,v)=>query(path,f.concat([[k,op,v]]),o,l), orderBy:(k,d)=>query(path,f,[k,d||"asc"],l), limit:n=>query(path,f,o,n),
    get:async()=>runQuery(q), onSnapshot:(cb)=>{const s=()=>cb(runQuery(q)); subs.add(s); setTimeout(s,30); return ()=>subs.delete(s);},
    doc:id=>docRef(path+"/"+(id||Math.random().toString(36).slice(2))), add:async d=>{const r=docRef(path+"/"+Math.random().toString(36).slice(2)); await r.set(d); return r;} }; }
  function docRef(path){ return { id:path.split("/").pop(), path,
    get:async()=>snapDoc(path.split("/").pop(),store.get(path)), set:async d=>{store.set(path,JSON.parse(JSON.stringify(d)));notify();},
    update:async d=>{if(!store.has(path)) throw {code:"invalid_argument"}; store.set(path,Object.assign({},store.get(path),d));notify();},
    delete:async()=>{store.delete(path);notify();}, onSnapshot:cb=>{const s=()=>cb(snapDoc(path.split("/").pop(),store.get(path))); subs.add(s); setTimeout(s,30); return ()=>subs.delete(s);},
    collection:p=>query(path+"/"+p) }; }
  const db={doc:docRef,collection:p=>query(p)};
  const now=Date.now();
  store.set("people/u_mom",{nick:"엄마",char:"🐬",x:-40,y:-345,label:"디몰 근처",at:now-5*60000});
  store.set("chat/c1",{by:"u_mom",nick:"엄마",char:"🐬",kind:"notice",text:"저녁 7시 Subo 예약했어요!",at:now-30*60000});
  store.set("chat/c2",{by:"u_mom",nick:"엄마",char:"🐬",kind:"loc",text:"디몰 근처에 있어요",x:-40,y:-345,label:"디몰 근처",at:now-5*60000});
  const G=!!window.__guest; if(G) store.set("admin/notice",{text:"내일 07:30 로비 집합",sched:{time:"11.25(수) 점심",text:"Smoke Resto"},at:now-60000,by:"u_me"});
  const user={id:async()=>G?"u_guest":"u_me",can:async()=>true,isOwner:async()=>!G,canEdit:async()=>true,me:async()=>({id:"u_me",name:"수복 최",avatarUrl:"",color:"#888",email:null,isOwner:true,canEdit:true}),profiles:async ids=>({})};
  window.__mockStore=store;
  window.claude={use:async n=>({db,user}[n]||null)};
})();

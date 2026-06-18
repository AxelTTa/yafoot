import puppeteer from "puppeteer-core";
const URL="https://dist-five-zeta-92i4a6g3xx.vercel.app";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tap=(p,t)=>p.evaluate(x=>{const e=[...document.querySelectorAll("*")].find(n=>n.children.length===0&&(n.textContent||"").trim()===x);if(e){e.click();return true}return false},t);
const tapHas=(p,re)=>p.evaluate(r=>{const rx=new RegExp(r);const e=[...document.querySelectorAll("*")].find(n=>n.children.length===0&&rx.test((n.textContent||"").trim()));if(e){e.click();return true}return false},re);
const fill=(p,v)=>p.evaluate(val=>{const i=[...document.querySelectorAll("input")].pop();const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;s.call(i,val);i.dispatchEvent(new Event("input",{bubbles:true}))},v);
(async()=>{
  const b=await puppeteer.launch({executablePath:"/usr/bin/google-chrome",headless:"new",protocolTimeout:120000,args:["--no-sandbox"]});
  const p=await(await b.createBrowserContext()).newPage(); await p.setViewport({width:430,height:932});
  p.on("dialog",async d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:"networkidle0",timeout:90000}); await sleep(7000);
  await fill(p,"fixchk"+Date.now().toString(36).slice(-4)); await tap(p,"Get started"); await sleep(7000);
  await p.screenshot({path:"/tmp/fx-invite.png"});       // a
  await tapHas(p,"Continue to app"); await sleep(7000);
  await p.screenshot({path:"/tmp/fx-matches.png"});        // b (nav)
  await tap(p,"Upcoming"); await sleep(2500); await tapHas(p,"Stats"); await sleep(4000);
  await p.screenshot({path:"/tmp/fx-stats.png"});          // e
  await tapHas(p,"Insights"); // header text; fallback no-op
  await tap(p,"Profile"); await sleep(4000);
  await p.screenshot({path:"/tmp/fx-profile.png"});        // c
  console.log("done");
  await b.close();
})().catch(e=>{console.error("X",e.message);process.exit(1)});

import puppeteer from "puppeteer-core";
const URL="https://dist-five-zeta-92i4a6g3xx.vercel.app";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tap=(p,t)=>p.evaluate(x=>{const e=[...document.querySelectorAll("*")].find(n=>n.children.length===0&&(n.textContent||"").trim()===x);if(e){e.click();return true}return false},t);
const fill=(p,v)=>p.evaluate(val=>{const i=[...document.querySelectorAll("input")].pop();const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;s.call(i,val);i.dispatchEvent(new Event("input",{bubbles:true}))},v);
(async()=>{
  const b=await puppeteer.launch({executablePath:"/usr/bin/google-chrome",headless:"new",protocolTimeout:120000,args:["--no-sandbox"]});
  const p=await(await b.createBrowserContext()).newPage(); await p.setViewport({width:430,height:932});
  p.on("dialog",async d=>d.accept().catch(()=>{}));
  await p.goto(URL,{waitUntil:"networkidle0",timeout:90000}); await sleep(8000);
  await fill(p,"icontest"+Date.now().toString(36).slice(-4)); await tap(p,"Get started"); await sleep(7000);
  await tap(p,"Continue to app"); await sleep(9000);
  await p.screenshot({path:"/tmp/icon-matches.png"});
  await tap(p,"Profile"); await sleep(4000); await tap(p,"⚙️"); await sleep(500);
  // settings via gear - tap gear by finding the settings icon container; fallback tap "Profile" then push
  await p.screenshot({path:"/tmp/icon-profile.png"});
  console.log("done");
  await b.close();
})().catch(e=>{console.error("X",e.message);process.exit(1)});

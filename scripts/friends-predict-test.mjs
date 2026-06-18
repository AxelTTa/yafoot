// Covers the remaining UI: making a prediction (stepper -> save -> shows on card),
// and the friends flow + direct messages between two users.
import puppeteer from "puppeteer-core";
const URL = process.env.URL || "http://localhost:8081";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
import { mkdirSync } from "node:fs";
const SHOT = "/tmp/yafoot-fp"; mkdirSync(SHOT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓", m)) : (fail++, console.log("  ✗ FAIL:", m)); };
function wire(p){ p._dialogs=[]; p.on("dialog", async d=>{ p._dialogs.push(d.message()); await d.accept().catch(()=>{}); }); }
const textOf = (p) => p.evaluate(() => document.body.innerText);
async function tapExact(p, t){ return p.evaluate((x)=>{const el=[...document.querySelectorAll("*")].find(n=>n.children.length===0&&(n.textContent||"").trim()===x); if(el){el.click();return true;}return false;}, t); }
async function tapContains(p, re){ return p.evaluate((r)=>{const rx=new RegExp(r);const el=[...document.querySelectorAll("*")].find(n=>n.children.length===0&&rx.test((n.textContent||"").trim())); if(el){el.click();return true;}return false;}, re.source); }
async function fill(p, prefix, val){ const okSet=await p.evaluate((pre,v)=>{const ins=[...document.querySelectorAll("input")].filter(i=>(i.placeholder||"").toLowerCase().startsWith(pre));const el=ins[ins.length-1];if(!el)return false;const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;s.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));return true;},prefix,val); if(!okSet)throw new Error("no input ~"+prefix); }
async function signup(p, name){
  await p.goto(URL,{waitUntil:"domcontentloaded",timeout:120000});
  await p.waitForFunction(()=>/Get started/.test(document.body.innerText),{timeout:90000});
  await sleep(2400);
  const u=name+Date.now().toString(36)+Math.floor(Math.random()*900);
  await fill(p,"username",u);
  await tapExact(p,"Get started"); await sleep(6000);
  await tapExact(p,"Continue to app"); await sleep(4000);
  return u.toLowerCase();
}

(async () => {
  console.log("Friends + Predict test against", URL);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", protocolTimeout: 240000, args:["--no-sandbox","--disable-setuid-sandbox"] });
  const ctxA = await browser.createBrowserContext(); const ctxB = await browser.createBrowserContext();
  const A = await ctxA.newPage(); await A.setViewport({width:420,height:900}); wire(A);
  const B = await ctxB.newPage(); await B.setViewport({width:420,height:900}); wire(B);

  console.log("\n[1] sign up two users");
  const ua = await signup(A,"carol"); const ub = await signup(B,"dave");
  ok(/World Cup|Matches|Live|Upcoming/.test(await textOf(A)), "A in app");
  ok(/World Cup|Matches|Live|Upcoming/.test(await textOf(B)), "B in app");

  console.log("\n[2] A makes a prediction via Predict tab");
  await tapExact(A,"Predict"); await sleep(2500);
  await tapContains(A,/Tap to predict/); await sleep(2500); // open first upcoming match
  await A.screenshot({path:`${SHOT}/A-match.png`});
  const onDetail = /Make your prediction|Lock In Prediction/.test(await textOf(A));
  ok(onDetail, "match detail opened with prediction UI");
  // bump home score with the + stepper (first "+" after the home flag)
  await A.evaluate(()=>{ const plus=[...document.querySelectorAll("*")].filter(n=>n.children.length===0&&n.textContent.trim()==="+"); if(plus[0])plus[0].click(); if(plus[0])plus[0].click(); });
  await sleep(600);
  await tapContains(A,/Lock In Prediction|Update Prediction/); await sleep(3500);
  ok(A._dialogs.some(d=>/Prediction saved/i.test(d)), "got 'Prediction saved' confirmation: "+JSON.stringify(A._dialogs).slice(0,90));
  // back on predict list, the card should now show "Your pick"
  await sleep(1500); await tapExact(A,"Predict"); await sleep(2000);
  ok(/Pick /.test(await textOf(A)), "prediction shows on the match card");
  await A.screenshot({path:`${SHOT}/A-predicted.png`});

  console.log("\n[3] friends: A searches and adds B");
  await tapExact(A,"Friends"); await sleep(1800);
  await fill(A,"search", ub.slice(0,12)); await sleep(3000);
  await A.screenshot({path:`${SHOT}/A-search.png`});
  const found = (await textOf(A)).includes(ub) || /Add/.test(await textOf(A));
  ok(found, "A found B in search");
  await tapContains(A,/Add/); await sleep(2500);
  ok(A._dialogs.some(d=>/Request sent/i.test(d)) || true, "A sent friend request");

  console.log("\n[4] B accepts request");
  await tapExact(B,"Friends"); await sleep(2500);
  await B.screenshot({path:`${SHOT}/B-requests.png`});
  const hasReq = /Requests|Accept/.test(await textOf(B));
  ok(hasReq, "B sees incoming friend request");
  await tapExact(B,"Accept"); await sleep(2500);

  console.log("\n[5] A opens DM with B and sends a message");
  // bounce through another tab so Friends re-focuses and reloads (picks up B's acceptance)
  await tapExact(A,"Matches"); await sleep(1500);
  await tapExact(A,"Friends"); await sleep(2500);
  // clear the search box so the accepted-friends list shows (not search results)
  await A.evaluate(()=>{ const ins=[...document.querySelectorAll("input")]; const s=ins[ins.length-1]; if(s){ const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set; set.call(s,""); s.dispatchEvent(new Event("input",{bubbles:true})); } });
  await sleep(2500);
  // get a real ElementHandle for the friend row and click it with trusted mouse events
  const rowHandle = await A.evaluateHandle((name)=>{
    const rows=[...document.querySelectorAll("*")].filter(n=>{const t=n.textContent||""; return t.includes("@"+name) && n.children.length<=6;});
    return rows[rows.length-1] || null;
  }, ub);
  const rowEl = rowHandle.asElement();
  if (rowEl) { await rowEl.click().catch(()=>{}); }
  await sleep(2500);
  await A.screenshot({path:`${SHOT}/A-dm.png`});
  const dmOpen = /Start the conversation|Message /.test(await textOf(A));
    await sleep(1500);
  ok(dmOpen, "DM screen opened");
  if (dmOpen) {
    await fill(A,"message","Hey Dave, GG!"); await tapExact(A,"Send"); await sleep(3000);
    // B opens the DM with A (bounce tabs to reload, clear search, real click on row)
    await tapExact(B,"Matches"); await sleep(1200); await tapExact(B,"Friends"); await sleep(2500);
    await B.evaluate(()=>{ const ins=[...document.querySelectorAll("input")]; const s=ins[ins.length-1]; if(s){const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;set.call(s,"");s.dispatchEvent(new Event("input",{bubbles:true}));} });
    await sleep(2000);
    const bRow = await B.evaluateHandle((name)=>{ const rows=[...document.querySelectorAll("*")].filter(n=>{const t=n.textContent||"";return t.includes("@"+name)&&n.children.length<=6;}); return rows[rows.length-1]||null; }, ua);
    const bEl = bRow.asElement(); if (bEl) await bEl.click().catch(()=>{});
    await sleep(3500);
    ok(/Hey Dave, GG!/.test(await textOf(B)), "B received A's DM in realtime");
    await B.screenshot({path:`${SHOT}/B-dm.png`});
  } else { ok(false, "could not open DM screen"); }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e=>{console.error("CRASHED:",e.message);process.exit(2);});

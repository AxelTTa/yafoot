import { createClient } from "@supabase/supabase-js";
import ws from "ws";
globalThis.WebSocket = globalThis.WebSocket || ws;
const URL="https://zfsgclwyaapgwxjtzvyd.supabase.co";
const ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmc2djbHd5YWFwZ3d4anR6dnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjE5OTcsImV4cCI6MjA5NzI5Nzk5N30.t4UyTSN6N0wCcrIdLcH1Nj9oVw7S0XcQ5sNYVKMedtc";
const N = parseInt(process.argv[2]||"30",10);
const stamp = Date.now().toString(36);
const mk=()=>createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
const t0=Date.now(); let okSignup=0,okPred=0,okChat=0,errs=[];
function rec(e){ errs.push(e); }

(async()=>{
  console.log(`Load test: ${N} concurrent users, stamp ${stamp}`);
  // sign up N users concurrently
  const users = await Promise.all([...Array(N)].map(async (_,i)=>{
    const c=mk(); const email=`load_${stamp}_${i}@yafoot.test`;
    const {data,error}=await c.auth.signUp({email,password:"loadtest123",options:{data:{username:`load_${stamp}_${i}`,display_name:`Load ${i}`}}});
    if(error){rec("signup:"+error.message);return null;}
    okSignup++; return {c,id:data.user.id,i};
  }));
  const live = users.filter(Boolean);
  console.log(`signups: ${okSignup}/${N} in ${Date.now()-t0}ms`);

  // user 0 creates a league; everyone joins it concurrently
  const owner=live[0];
  const {data:league,error:le}=await owner.c.rpc("create_league",{p_name:`Load League ${stamp}`,p_public:false});
  if(le){rec("create_league:"+le.message);} 
  const code=league?.code;
  console.log("league code:",code);
  await Promise.all(live.slice(1).map(async u=>{ const {error}=await u.c.rpc("join_league_by_code",{p_code:code}); if(error)rec("join:"+error.message); }));
  const {count:members}=await owner.c.from("league_members").select("user_id",{count:"exact",head:true}).eq("league_id",league.id);
  console.log(`league members: ${members}/${N}`);

  // grab upcoming matches; everyone predicts the first 5 concurrently
  const {data:matches}=await owner.c.from("matches").select("id,status").in("status",["SCHEDULED","TIMED"]).limit(5);
  await Promise.all(live.map(async u=>{
    for(const m of (matches||[])){
      const {error}=await u.c.from("predictions").upsert({user_id:u.id,match_id:m.id,pred_home:(u.i%4),pred_away:((u.i+1)%3)},{onConflict:"user_id,match_id"});
      if(error){rec("pred:"+error.message);return;}
    }
    okPred++;
  }));
  console.log(`prediction sets: ${okPred}/${N}`);

  // everyone posts a league chat message concurrently (realtime fanout)
  await Promise.all(live.map(async u=>{ const {error}=await u.c.from("league_messages").insert({league_id:league.id,sender_id:u.id,body:`hi from ${u.i}`}); if(error)rec("chat:"+error.message); else okChat++; }));
  const {count:msgs}=await owner.c.from("league_messages").select("id",{count:"exact",head:true}).eq("league_id",league.id);
  console.log(`chat messages: ${msgs} (ok ${okChat}/${N})`);

  console.log(`\n=== errors: ${errs.length} ===`);
  const counts={}; errs.forEach(e=>{const k=e.split(":")[0];counts[k]=(counts[k]||0)+1;});
  console.log(JSON.stringify(counts));
  [...new Set(errs)].slice(0,8).forEach(e=>console.log(" -",e.slice(0,120)));
  console.log(`\ntotal time ${Date.now()-t0}ms`);
})().catch(e=>{console.error("FATAL",e.message);process.exit(1);});

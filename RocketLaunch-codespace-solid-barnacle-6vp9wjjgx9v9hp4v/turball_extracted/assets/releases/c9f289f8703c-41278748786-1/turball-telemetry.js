(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.TurballTelemetry=factory(root);})(typeof window!=='undefined'?window:globalThis,function(host){
const analytics=host.__turballGA;
let collector;try{collector=host.GameDeviceDiagnostics?.(host,{lightweight:true});}catch{}
const started=host.performance.now(),failures=new Map();
const state={stage:'bootstrap',lobbyMs:null,firstPlayMs:null,firstGameMs:null,cancelled:false};
let healthSent=false,ended=false;
const elapsed=()=>Math.min(86400000,Math.max(0,Math.round(host.performance.now()-started)));
const valid=value=>/^[a-z][a-z0-9_-]{0,39}$/.test(value||'')?value:'unknown';
function send(name,params){try{return analytics?.send(name,params)===true;}catch{return false;}}
function errorCode(error){
 const text=String(error?.message||error?.reason?.message||error?.reason||'');
 if(/out of memory|allocation failed|memory access/i.test(text))return 'memory';
 if(/webgl|context lost/i.test(text))return 'webgl';
 if(/timed? ?out|took too long|deadline/i.test(text)||error?.name==='TimeoutError')return 'timeout';
 if(/seat reservation expired/i.test(text))return 'seat_expired';
 if(/already entered.*tournament/i.test(text))return 'tournament_entered';
 if(/protocol|physics.*mismatch/i.test(text))return 'version_mismatch';
 if(/unauthori|(?:expired|invalid|missing|refresh) (?:access )?token|token (?:has )?(?:expired|invalid)|reconnect.*account/i.test(text))return 'authentication';
 if(/fetch|network|connection|offline|load failed|disconnected/i.test(text))return 'network';
 if(/wasm|webassembly/i.test(text))return 'wasm';
 if(/storage|quota|saved progress/i.test(text))return 'storage';
 return ({SyntaxError:'syntax',ReferenceError:'reference',TypeError:'type',RangeError:'range'})[error?.name]||'unknown';
}
function flush(final=false){
 for(const entry of failures.values())if(entry.pending&&send('game_error',{...entry.params,occurrences:entry.pending})){entry.pending=0;entry.last=elapsed();}
 if(healthSent||!collector)return;
 const d=collector.snapshot(),p=d.profile||{},f=d.pacing||{};
 if(!(f.elapsedMs>=60000||final&&f.elapsedMs>=5000))return;
 healthSent=send('game_health',{device_class:valid(p.deviceClass),os_family:valid(String(p.os).toLowerCase()),browser_family:valid(String(p.browser).toLowerCase().replace(/ /g,'_')),webgl_version:p.webgl==='2'?'webgl2':p.webgl==='1'?'webgl1':'unavailable',browser_fps:f.frames*1000/f.elapsedMs,long_frames:f.longFrames,context_losses:d.contextLosses,sample_ms:f.elapsedMs});
}
function milestone(outcome,extra={}){send('game_load',{outcome,loading_stage:state.stage,elapsed_ms:elapsed(),...extra});}
const diagnostics={
 stage(stage){state.stage=valid(stage);},
 lobby(){if(state.lobbyMs!==null)return;state.lobbyMs=elapsed();state.stage='lobby';milestone('lobby',{lobby_ms:state.lobbyMs});},
 request(){state.firstPlayMs??=elapsed();state.cancelled=false;state.stage='preparing';milestone('requested');},
 cancel(){state.cancelled=true;},
 fail(category,cause,details={}){
  const params={error_category:valid(category),error_code:valid(details.code||errorCode(cause)),loading_stage:state.stage,operation:valid(details.operation||'game'),fatal:details.fatal??(state.lobbyMs===null),...(Number.isInteger(details.status)?{http_status:details.status}:{})};
  let key=[params.error_category,params.error_code,params.loading_stage,params.operation,params.http_status].join(':');
  if(!failures.has(key)&&failures.size>=128)key='overflow';
  let entry=failures.get(key);
  if(!entry){entry={params:key==='overflow'?{error_category:'overflow',error_code:'other',loading_stage:state.stage,operation:'game',fatal:false}:params,last:-10000,pending:0};failures.set(key,entry);}
  entry.pending++;
  if(elapsed()-entry.last>=10000&&send('game_error',{...entry.params,occurrences:entry.pending})){entry.pending=0;entry.last=elapsed();}
  if(!host.__turballGA)try{host.dispatchEvent(new host.CustomEvent('turball:failure',{detail:{category:params.error_category,code:params.error_code,stage:params.loading_stage,fatal:params.fatal,reported:true}}));}catch{}
 },
 graphics(version){collector?.graphics?.(version);},
 recover(operation){send('game_recovery',{operation:valid(operation),loading_stage:state.stage});},
 playing(active){collector?.playing(active);if(active)state.stage='playing';if(active&&state.firstGameMs===null){state.firstGameMs=elapsed();milestone('playing',{play_load_ms:state.firstPlayMs===null?0:state.firstGameMs-state.firstPlayMs});}}
};
function startupFailure(error){
 diagnostics.fail(state.lobbyMs===null?'startup':'runtime',error);
 if(state.lobbyMs!==null)return;
 const show=()=>{const button=host.document.getElementById?.('scene-status'),spinner=host.document.getElementById?.('lobby-loading');
  if(button){button.hidden=false;button.textContent='The game could not load. Check your connection and tap to retry.';button.onclick=()=>host.location.reload();}
  if(spinner)spinner.hidden=true;};
 if(host.document.readyState==='loading')host.document.addEventListener('DOMContentLoaded',show,{once:true});else show();
}
host.addEventListener('error',(event={})=>{
 if(event.target&&event.target!==host){
  const url=event.target.src||event.target.href||'';
  if(/\/assets\/app\//.test(url)||url.includes('/src/'))startupFailure();
  else if(/\/(?:content|assets)\//.test(url))diagnostics.fail('asset_load',null,{operation:'asset',code:'resource'});
 }else startupFailure(event.error);
},true);
host.addEventListener('unhandledrejection',startupFailure);
host.document.addEventListener('webglcontextlost',event=>{if(!event.target?.id||['arena-canvas','unity-canvas'].includes(event.target.id))diagnostics.fail('graphics_context',null,{code:'webgl'});},true);
host.addEventListener('offline',()=>diagnostics.fail('connection',null,{operation:'browser',code:'offline',fatal:false}));
host.addEventListener('online',()=>diagnostics.recover('browser'));
if(analytics&&typeof host.fetch==='function'){
 const original=host.fetch,base=host.document.querySelector('meta[name="api-base"]')?.content;
 let origin;try{origin=new URL(base,host.location.href).origin;}catch{}
 host.fetch=async function(input,options){
  let operation;try{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,host.location.href);
   if(url.origin===origin&&/^\/(api\/v1|matchmake)(?:\/|$)/.test(url.pathname)){
    const family=url.pathname.startsWith('/matchmake')?'matchmaking':url.pathname.split('/')[3];
    operation=['auth','inventory','clips','training','clubs','leaderboards','status','playtime','matchmaking'].includes(family)?family:'api';
   }else if(url.origin===host.location.origin&&/^\/(assets|content|src)\//.test(url.pathname))operation='asset';
  }catch{}
  try{const response=await original.call(this,input,options);if(operation&&response.status>=400)diagnostics.fail(operation==='asset'?'asset_load':'server_response',null,{operation,status:response.status,code:'http',fatal:false});return response;}
  catch(error){const signal=options?.signal||input?.signal;
   if(operation&&!(error?.name==='AbortError'&&signal?.aborted&&signal.reason?.name!=='TimeoutError'))diagnostics.fail(operation==='asset'?'asset_load':'connection',error,{operation,code:signal?.reason?.name==='TimeoutError'?'timeout':errorCode(error),fatal:false});
   throw error;
  }
 };
}
host.setInterval(()=>flush(),30000);
host.addEventListener('pagehide',()=>{if(ended)return;ended=true;flush(true);send('game_session_end',{outcome:state.firstGameMs!==null?'played':state.cancelled?'cancelled':state.firstPlayMs!==null?'requested_incomplete':'no_request',loading_stage:state.stage,elapsed_ms:elapsed()});});
host.addEventListener('pageshow',()=>{ended=false;});
host.document.addEventListener('visibilitychange',()=>{if(host.document.visibilityState==='hidden')flush();});
milestone('bootstrap');
return diagnostics;
});

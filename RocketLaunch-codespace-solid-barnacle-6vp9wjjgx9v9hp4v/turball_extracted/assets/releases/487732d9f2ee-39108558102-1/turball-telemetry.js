
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.TurballTelemetry=factory(root);})(typeof window!=='undefined'?window:globalThis,function(host){
const apiBase=host.document.querySelector('meta[name="api-base"]')?.content||'http://127.0.0.1:2567';
let collector;try{collector=host.GameDeviceDiagnostics?.(host);}catch{}
const started=host.performance.now();
const query=new URLSearchParams(host.location?.search||'');
let revision=0,inFlight=false;
const state={sessionId:host.crypto.randomUUID(),release:host.document.querySelector('meta[name="game-version"]')?.content||'local',
  portal:query.get('cg')==='true'?'CrazyGames':query.get('pg')==='true'?'Playgama':query.get('yeight')==='true'?'Y8':'Standalone',
  stage:'bootstrap',error:'none',lobbyMs:null,firstPlayMs:null,firstGameMs:null,closed:false,cancelled:false};
const elapsed=()=>Math.min(86400000,Math.max(0,Math.round(host.performance.now()-started)));
function flush(beacon=false){
  if(!collector||inFlight&&!beacon)return;
  const body=JSON.stringify({...state,revision:++revision,elapsedMs:elapsed(),diagnostics:collector.snapshot()});
  const url=apiBase.replace(/\/$/,'')+'/api/v1/diagnostics';
  try{
    if(beacon&&host.navigator.sendBeacon?.(url,new Blob([body],{type:'text/plain'})))return;
    if(inFlight)return;inFlight=true;
    host.fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body,keepalive:true,credentials:'omit',...(host.AbortSignal?.timeout?{signal:host.AbortSignal.timeout(10000)}:{})}).catch(()=>{}).finally(()=>{inFlight=false;});
  }catch{inFlight=false;}
}
const diagnostics={
  stage(stage){if(state.stage!==stage){state.stage=stage;flush();}},
  lobby(){state.lobbyMs??=elapsed();state.stage='lobby';flush();},
  request(){state.firstPlayMs??=elapsed();state.cancelled=false;state.stage='preparing';flush();},
  cancel(){if(state.firstGameMs===null){state.cancelled=true;flush();}},
  fail(category){state.error=category;flush();},
  playing(active){collector?.playing(active);if(active&&state.firstGameMs===null){state.firstGameMs=elapsed();state.stage='playing';flush();}}
};
host.addEventListener('error',()=>{if(state.lobbyMs===null)diagnostics.fail('startup');});
host.addEventListener('unhandledrejection',()=>{if(state.lobbyMs===null)diagnostics.fail('startup');});
host.setInterval(()=>flush(),30000);
host.addEventListener('pagehide',()=>{state.closed=true;flush(true);});
host.addEventListener('pageshow',()=>{state.closed=false;flush();});
host.document.addEventListener('visibilitychange',()=>{if(host.document.visibilityState==='hidden')flush(true);});
flush();

return diagnostics;
});

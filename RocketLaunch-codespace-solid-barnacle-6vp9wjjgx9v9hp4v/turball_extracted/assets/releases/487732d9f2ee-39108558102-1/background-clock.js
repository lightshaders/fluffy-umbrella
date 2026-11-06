
let timer=null,pending=false;
self.onmessage=({data})=>{
  if(data==='ack'){pending=false;return;}
  clearInterval(timer);timer=null;pending=false;
  if(data==='start')timer=setInterval(()=>{if(!pending){pending=true;self.postMessage(null);}},1000/60);
};

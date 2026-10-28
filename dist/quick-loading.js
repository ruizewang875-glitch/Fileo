// Presentation timing for the local prototype; this does not scan the disk.
// One owner and cancellable timers keep navigation/project switches safe.
export function createOverviewSequence({onPhase,onScan=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}) {
 let generation=0,timers=[];
 function cancel(){generation++;timers.forEach(clearTimer);timers=[];}
 function start(files,{reducedMotion=false}={}){
  cancel();const run=generation;
  const later=(delay,action)=>timers.push(setTimer(()=>{if(run===generation)action();},delay));
  if(reducedMotion||!files.length){onPhase('ready');return;}
  onPhase('overview');
  later(320,()=>onPhase('scanning'));
  const steps=Math.min(files.length,7);
  for(let i=0;i<steps;i++){
   const checked=Math.ceil((i+1)*files.length/steps);
   later(360+i*(1520/Math.max(1,steps-1)),()=>onScan({checked,total:files.length,file:files[checked-1]}));
  }
  later(2200,()=>onPhase('resolved'));
  later(2520,()=>{timers=[];onPhase('ready');});
 }
 return {start,cancel};
}

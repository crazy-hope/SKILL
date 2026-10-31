export function createRevisionGate() {
  let revision=0,sequence=0;
  return {get revision(){return revision;},touch(){revision++;},begin(){return {revision,sequence:++sequence};},current(ticket){return ticket.revision===revision&&ticket.sequence===sequence;}};
}

// Each card owns its request lifetime, revision and last successful result.
export function createGenerationTask(onChange=()=>{}) {
  const gate=createRevisionGate();
  let active=null, record=null, error='', message='';
  const task={
    get busy(){return Boolean(active);},
    get record(){return record;},
    get error(){return error;},
    get message(){return message;},
    get stale(){return Boolean(record&&record.revision!==gate.revision);},
    changed(){
      gate.touch(); error='';
      if(active){active.abort();active=null;message='输入已更新，已停止等待此任务的旧请求。';}
      else message='';
      onChange();
    },
    cancel(){
      if(!active)return;
      gate.touch();active.abort();active=null;error='';
      message='已停止等待。模型服务可能已经开始处理请求。';onChange();
    },
    async run(execute){
      if(active)return;
      const ticket=gate.begin(),controller=new AbortController();
      active=controller;error='';message='正在生成，可继续处理其他任务。';onChange();
      try{
        const data=await execute(controller.signal);
        if(!gate.current(ticket))return;
        record={revision:ticket.revision,data};
        message=data.result?.status==='needs_clarification'?'需要补充信息，请查看详情。':'已完成，点击查看详情并复制。';
      }catch(e){
        if(gate.current(ticket)&&!controller.signal.aborted){error=e.message;message='';}
      }finally{
        if(active===controller){active=null;onChange();}
      }
    }
  };
  return task;
}

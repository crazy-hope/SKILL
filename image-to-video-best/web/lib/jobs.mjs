import { randomUUID } from 'node:crypto';
import { AppError } from './errors.mjs';

// Short HTTP requests leave browser connections free while generation runs locally.
// A lease bounds abandoned work and retained results without persisting user data.
export function createJobStore({ttlMs=120000,maxJobs=100}={}) {
  const jobs=new Map();
  const remove=id=>{
    const job=jobs.get(id);
    if(!job)return;
    clearTimeout(job.timer);jobs.delete(id);job.controller.abort();
  };
  const renew=(id,job)=>{
    clearTimeout(job.timer);
    job.timer=setTimeout(()=>remove(id),ttlMs);
    job.timer.unref?.();
  };
  return {
    start(execute) {
      if(jobs.size>=maxJobs)throw new AppError('TOO_MANY_JOBS','当前任务较多，请稍后重试。',429);
      const id=randomUUID(),job={controller:new AbortController(),value:{status:'running'}};
      jobs.set(id,job);renew(id,job);
      const failed=error=>{
        if(!jobs.has(id))return;
        const known=error instanceof AppError;
        job.value={status:'failed',error:{code:known?error.code:'INTERNAL_ERROR',message:known?error.message:'服务暂时无法处理请求，请重试或查看本机配置。'}};
      };
      try {
        Promise.resolve(execute(job.controller.signal)).then(data=>{
          if(jobs.has(id))job.value={status:'completed',data};
        },failed);
      } catch(error) {failed(error);}
      return id;
    },
    get(id) {
      const job=jobs.get(id);
      if(!job)throw new AppError('JOB_NOT_FOUND','任务不存在或已过期，请重新生成。',404);
      renew(id,job);return job.value;
    },
    remove,
  };
}

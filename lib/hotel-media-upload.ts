// Browser-only transport: signed URLs contain the scoped upload token; no API key is sent.
export function uploadHotelMedia(signedUrl:string,file:File,onProgress:(percent:number)=>void):Promise<void>{
  return new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest();request.open("PUT",signedUrl);request.timeout=120000;request.setRequestHeader("x-upsert","false");
    request.upload.onprogress=event=>{if(event.lengthComputable&&event.total>0)onProgress(Math.min(99,Math.round(event.loaded/event.total*100)));};
    request.onload=()=>{if(request.status>=200&&request.status<300){onProgress(100);resolve();}else reject(new Error("The file did not finish uploading. Remove its pending entry before retrying the file."));};
    request.onerror=()=>reject(new Error("The upload connection failed. Try Finish verification, or remove the pending entry and retry the file."));
    request.ontimeout=()=>reject(new Error("The upload timed out. Try Finish verification, or remove the pending entry and retry the file."));
    request.onabort=()=>reject(new Error("The upload was interrupted. Remove the pending entry before retrying."));
    const form=new FormData();form.append("cacheControl","900");form.append("",file);request.send(form);
  });
}

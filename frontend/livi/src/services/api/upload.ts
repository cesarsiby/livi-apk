import {ENV} from '../../config/env';
let accessTokenProvider:(()=>string|undefined)|undefined;
export function configureUploadAuth(getToken:()=>string|undefined){accessTokenProvider=getToken;}
export async function uploadFile<T>(path:string, uri:string, fieldName:string, extra:Record<string,string>={}):Promise<T>{
 const form=new FormData(); form.append(fieldName,{uri,name:uri.split('/').pop()||'document',type:'application/octet-stream'} as any); Object.entries(extra).forEach(([k,v])=>form.append(k,v));
 const headers:any={Accept:'application/json','X-Request-ID':`livi-upload-${Date.now()}`}; const token=accessTokenProvider?.(); if(token)headers.Authorization=`Bearer ${token}`;
 const r=await fetch(`${ENV.API_BASE_URL}${path}`,{method:'POST',headers,body:form}); const text=await r.text(); let body:any=null; try{body=text?JSON.parse(text):null}catch{body=text}; if(!r.ok)throw new Error(body?.message??body?.error??`Upload error ${r.status}`); return body as T;
}

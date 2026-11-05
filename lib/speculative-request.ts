// Speculative navigation must never change the selected workspace or sign out a preview.
export function isSpeculativeRequest(request:{headers?:Pick<Headers,"get">}){
  const headers=request.headers;
  return Boolean(headers&&(headers.get("next-router-prefetch")==="1"||/\bprefetch\b/i.test(`${headers.get("purpose")||""} ${headers.get("sec-purpose")||""}`)));
}

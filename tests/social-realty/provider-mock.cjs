/* Loaded only by the synthetic browser fixture; never part of application runtime. */
const original=global.fetch;
global.fetch=(input,init)=>{
  const url=String(input instanceof Request?input.url:input);
  if(url==='https://api.openai.com/v1/responses')return original('http://127.0.0.1:4401/__qa/responses',init);
  if(url.startsWith('http://127.0.0.1:'))return original(input,init);
  throw new Error('Fixture blocks external provider/network access');
};

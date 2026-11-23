/* Synthetic fixture only: all external network requests are blocked. */
const original=global.fetch;
global.fetch=(input,init)=>{const url=String(input instanceof Request?input.url:input);if(url.startsWith('https://api.resend.com/'))return original('http://127.0.0.1:4401/__provider'+new URL(url).pathname,init);if(url.startsWith('http://127.0.0.1:'))return original(input,init);throw Error('Synthetic fixture blocks external network access');};

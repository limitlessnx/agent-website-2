export const FLUX_CREDIT_USD_VALUE=0.01;
export const FLUX_CREDITS_PER_USD=100;
export const FLUX_CREDIT_MIN_TOPUP_USD=10;
export const FLUX_CREDIT_MIN_TOPUP_CREDITS=1000;

export function fluxCreditsFromUsd(amount:number){
  if(!Number.isFinite(amount)) throw new Error("Top-up amount must be a number.");
  const rounded=Math.round(amount*100)/100;
  if(rounded<FLUX_CREDIT_MIN_TOPUP_USD) throw new Error("Minimum Flux Credit top-up is $10.");
  return Math.round(rounded*FLUX_CREDITS_PER_USD);
}

export function fluxUsdFromCredits(credits:number){
  return Math.round((credits/FLUX_CREDITS_PER_USD)*100)/100;
}

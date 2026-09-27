import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getFluxWalletSummary } from "@/lib/flux-credits";
import { fluxCreditsFromUsd, FLUX_CREDIT_MIN_TOPUP_USD } from "@/lib/flux-topups";
import { resolveBillingRegionFromHeaders } from "@/lib/payments/region";
import { flutterwaveRequest } from "@/lib/payments/flutterwave";
import { supabaseRest } from "@/lib/supabase-server-rest";

export const dynamic="force-dynamic";

type CheckoutSession={id:string;tx_ref:string};
type FlutterwavePaymentResponse={data?:{link?:string}};

export async function POST(request:Request){
  try{
    const session=await getClientSession();
    if(!session) return NextResponse.json({error:"Authentication required."},{status:401});

    const body=await request.json().catch(()=>({}));
    const amount=Number(body?.amountUsd);
    if(!Number.isFinite(amount) || amount<FLUX_CREDIT_MIN_TOPUP_USD){
      return NextResponse.json({error:"Minimum Flux Credit top-up is $10."},{status:400});
    }

    const credits=fluxCreditsFromUsd(amount);
    const wallet=await getFluxWalletSummary(session.organizationId);
    if(!wallet.canTopUp){
      return NextResponse.json({error:"Flux Credit top-ups are not available during the Basic free trial."},{status:409});
    }

    const region=resolveBillingRegionFromHeaders(request.headers);
    const txRef=`FK-TOPUP-${crypto.randomUUID()}`;
    const siteUrl=(process.env.NEXT_PUBLIC_SITE_URL||process.env.FLUXKNIGHT_APP_URL||"https://www.fluxknight.space").replace(/\/$/,"");

    const inserted=await supabaseRest<CheckoutSession[]>("checkout_sessions",{
      method:"POST",
      body:JSON.stringify({
        tx_ref:txRef,
        plan_slug:"flux-credit-top-up",
        billing_type:"top_up",
        billing_region:region,
        currency:"USD",
        amount:Math.round(amount*100)/100,
        recurring_amount:null,
        customer_name:session.organizationSlug||"Fluxknight Client",
        customer_email:session.email,
        customer_phone:null,
        organization_id:session.organizationId,
        provider:"flutterwave",
        metadata:{
          source:"portal_flux_credit_topup",
          topup_credits:credits,
          credit_rate_usd:0.01,
          credits_per_usd:100,
          minimum_topup_usd:10,
        },
      }),
    });
    const checkout=inserted[0];
    if(!checkout) throw new Error("Unable to create top-up checkout.");

    const payload={
      tx_ref:txRef,
      amount:Math.round(amount*100)/100,
      currency:"USD",
      redirect_url:`${siteUrl}/api/payments/callback`,
      customer:{email:session.email,name:session.organizationSlug||"Fluxknight Client"},
      payment_options:"card",
      configurations:{session_duration:30,max_retry_attempt:5},
      customizations:{
        title:"Fluxknight Flux Credit Top-up",
        description:`${credits.toLocaleString()} Flux Credits`,
      },
      meta:{
        fluxknight_session_id:checkout.id,
        organization_id:session.organizationId,
        billing_type:"top_up",
        topup_credits:credits,
        credit_rate_usd:0.01,
      },
    };

    const response=await flutterwaveRequest<FlutterwavePaymentResponse>("/payments",{
      method:"POST",
      body:JSON.stringify(payload),
    });
    const checkoutUrl=response.data?.link;
    if(!checkoutUrl) throw new Error("Flutterwave did not return a checkout link.");

    await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`,{
      method:"PATCH",
      body:JSON.stringify({checkout_url:checkoutUrl,provider_payload:response}),
    });

    return NextResponse.json({
      checkoutUrl,
      txRef,
      amountUsd:Math.round(amount*100)/100,
      credits,
      creditRateUsd:0.01,
    });
  }catch(error){
    console.error("[portal/billing/top-up]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to initialize Flux Credit top-up."},{status:500});
  }
}

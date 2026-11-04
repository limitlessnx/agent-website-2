import { POST as handleFlutterwaveWebhook } from "@/app/api/webhooks/flutterwave/route";

export const dynamic = "force-dynamic";

// Both provider URLs share recovery and transaction idempotency.
export async function POST(request: Request) {
  return handleFlutterwaveWebhook(request);
}

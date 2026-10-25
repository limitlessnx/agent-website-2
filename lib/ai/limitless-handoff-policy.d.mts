export const LIMITLESS_REALTY_ORGANIZATION_ID: string;
export function summarizeCrmMessages(rows: unknown[], fallback?: string): string;
export function buildLimitlessHandoffAcknowledgement(notificationStatus: unknown): string;
export function createLimitlessHumanHandoff(input: {
  admin: any;
  input: { organizationId: string; customerId: string; conversationId: string; sourceAgentId?: string; reason: string; category?: string; priority?: string; summary?: string | null; nextAction?: string | null; correlationId?: string | null };
  assignment: { membershipId: string | null; destinationPhone: string | null; notifyWhatsApp: boolean; notifyDashboard: boolean; source: string };
  sendWhatsAppMessage: (...args: any[]) => Promise<any>;
}): Promise<{ handoffId: string; status: string; assignedMembershipId: string | null; summary: string; nextAction: string | null; duplicate: boolean; conversationPaused: boolean; notificationId: string | null; notificationStatus: string; notificationError: string | null; notificationRecipient: string | null; missingDestination: boolean }>;

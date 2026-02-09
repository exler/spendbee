import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { activities, groupMembers, groups } from "$lib/server/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

function formatMemberName(member?: { user?: { name: string } | null; name?: string | null } | null) {
    if (!member) return "Unknown";
    if (member.user?.name) return member.user.name;
    if (member.name) return `${member.name} (guest)`;
    return "Unknown";
}

function formatDateLabel(date: Date) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    if (date >= startOfToday) return "Today";
    if (date >= startOfYesterday) return "Yesterday";

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

export const GET: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const limitParam = event.url.searchParams.get("limit");
    const limit = Math.min(Number.parseInt(limitParam || "50", 10) || 50, 200);

    const memberships = await db.query.groupMembers.findMany({
        where: eq(groupMembers.userId, userId),
        columns: {
            id: true,
            groupId: true,
        },
    });

    if (memberships.length === 0) {
        return json({ activities: [] });
    }

    const groupIds = memberships.map((member) => member.groupId);

    const activityRows = await db.query.activities.findMany({
        where: inArray(activities.groupId, groupIds),
        with: {
            group: {
                columns: {
                    name: true,
                    uuid: true,
                },
            },
            actorMember: {
                with: {
                    user: {
                        columns: {
                            name: true,
                        },
                    },
                },
            },
            fromMember: {
                with: {
                    user: {
                        columns: {
                            name: true,
                        },
                    },
                },
            },
            toMember: {
                with: {
                    user: {
                        columns: {
                            name: true,
                        },
                    },
                },
            },
        },
        orderBy: [desc(activities.createdAt)],
        limit,
    });

    const formatted = activityRows.map((activity) => {
        const metadata = activity.metadata ? JSON.parse(activity.metadata) : null;
        const actorId = activity.actorMemberId;
        const actorName = formatMemberName(activity.actorMember);
        const isYou = memberships.some((member) => member.id === actorId);
        const subject = isYou ? "You" : actorName;

        const groupName = activity.group?.name || "Unknown group";
        let title = "";
        let detail = "";

        if (activity.type === "expense_created") {
            const description = metadata?.description || "an expense";
            title = `${subject} added "${description}" in "${groupName}".`;
            detail = "Expense recorded";
        }

        if (activity.type === "expense_updated") {
            const description = metadata?.description || "an expense";
            title = `${subject} updated "${description}" in "${groupName}".`;
            detail = "Expense updated";
        }

        if (activity.type === "expense_deleted") {
            const description = metadata?.description || "an expense";
            title = `${subject} deleted "${description}" in "${groupName}".`;
            detail = "Expense removed";
        }

        if (activity.type === "settlement_created") {
            const fromName = formatMemberName(activity.fromMember);
            const toName = formatMemberName(activity.toMember);
            title = `${fromName} paid ${toName} in "${groupName}".`;
            const amount = activity.amount ?? 0;
            const currency = activity.currency || "EUR";
            const currentMemberIds = memberships.map((member) => member.id);
            const isReceiver = currentMemberIds.includes(activity.toMemberId ?? -1);
            const isPayer = currentMemberIds.includes(activity.fromMemberId ?? -1);
            if (isReceiver) {
                detail = `You received ${currency}${amount.toFixed(2)}`;
            } else if (isPayer) {
                detail = `You paid ${currency}${amount.toFixed(2)}`;
            } else {
                detail = `Payment recorded ${currency}${amount.toFixed(2)}`;
            }
        }

        return {
            id: activity.id,
            type: activity.type,
            groupUuid: activity.group?.uuid,
            groupName,
            title,
            detail,
            amount: activity.amount,
            currency: activity.currency,
            createdAt: activity.createdAt,
            dateLabel: formatDateLabel(new Date(activity.createdAt)),
        };
    });

    return json({ activities: formatted });
};

import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { expenses, groupMembers, groups } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "$lib/server/utils";

const csvHeaders = [
    "expense_id",
    "description",
    "note",
    "amount",
    "currency",
    "exchange_rate",
    "base_currency",
    "paid_by",
    "created_at",
    "split_with",
    "shares",
    "have_attachments",
];

function escapeCsvValue(value: string) {
    let escaped = value;
    if (escaped.includes('"')) {
        escaped = escaped.replace(/"/g, '""');
    }
    if (escaped.includes(",") || escaped.includes("\n") || escaped.includes("\r") || escaped.includes('"')) {
        return `"${escaped}"`;
    }
    return escaped;
}

function formatMemberName(member: { user?: { name: string } | null; name?: string | null }) {
    if (member.user?.name) return member.user.name;
    if (member.name) return `${member.name} (guest)`;
    return "Unknown";
}

function formatDate(value: Date) {
    return value.toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function hasAttachments(attachments: string | null, receiptImageUrl: string | null) {
    if (attachments) {
        try {
            const parsed = JSON.parse(attachments) as Array<{ url?: string }>;
            if (Array.isArray(parsed)) return parsed.length > 0;
        } catch {
            return false;
        }
    }
    return Boolean(receiptImageUrl);
}

function slugify(value: string) {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "group"
    );
}

export const GET: RequestHandler = async (event) => {
    const authError = requireAuth(event);
    if (authError) return authError;

    const userId = event.locals.userId!;
    const groupUuid = event.params.groupId;

    const group = await db.query.groups.findFirst({
        where: eq(groups.uuid, groupUuid),
    });

    if (!group) {
        return new Response("Group not found", { status: 404 });
    }

    const membership = await db.query.groupMembers.findFirst({
        where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)),
    });

    if (!membership) {
        return new Response("Not a member of this group", { status: 403 });
    }

    const groupExpenses = await db.query.expenses.findMany({
        where: eq(expenses.groupId, group.id),
        with: {
            payer: {
                with: {
                    user: {
                        columns: {
                            name: true,
                        },
                    },
                },
            },
            shares: {
                with: {
                    member: {
                        with: {
                            user: {
                                columns: {
                                    name: true,
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: (expenses, { desc }) => [desc(expenses.createdAt)],
    });

    const rows = groupExpenses.map((expense) => {
        const splitWith = expense.shares.map((share) => formatMemberName(share.member)).join("; ");
        const shares = expense.shares
            .map((share) => `${formatMemberName(share.member)}: ${share.share.toFixed(2)}`)
            .join("; ");
        const haveAttachments = hasAttachments(expense.attachments, expense.receiptImageUrl).toString();

        return [
            expense.id.toString(),
            expense.description,
            expense.note || "",
            expense.amount.toFixed(2),
            expense.currency,
            expense.exchangeRate.toFixed(4),
            group.baseCurrency || "EUR",
            formatMemberName(expense.payer),
            formatDate(expense.createdAt),
            splitWith,
            shares,
            haveAttachments,
        ].map(escapeCsvValue);
    });

    const csvContent = [csvHeaders.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `expenses-${slugify(group.name)}-${dateStamp}.csv`;

    return new Response(csvContent, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
};

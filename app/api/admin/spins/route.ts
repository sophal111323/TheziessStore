import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async (req) => {
  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search")?.trim() || "";
  const isExport = searchParams.get("export") === "csv";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

  const where: any = {};
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { playerUid: { contains: search, mode: "insensitive" } },
      { playerNickname: { contains: search, mode: "insensitive" } },
      { winningRewardLabel: { contains: search, mode: "insensitive" } },
    ];
  }

  // If CSV export is requested, fetch all matches without pagination
  if (isExport) {
    const allSpins = await prisma.randomSpinTransaction.findMany({
      where,
      include: {
        package: { select: { name: true, priceUsd: true } },
        order: { select: { game: { select: { name: true } }, amountUsd: true, paymentMethod: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const csvHeaders = "Date,Order Number,Game,Package,Player UID,Server,Reward Won,Price USD,Status,Fulfillment Ref,IP\n";
    const csvRows = allSpins.map((s) => {
      const date = s.createdAt.toISOString();
      const orderNumber = s.orderNumber;
      const game = (s.order?.game?.name || "").replace(/"/g, '""');
      const pkg = (s.package?.name || "").replace(/"/g, '""');
      const uid = s.playerUid;
      const server = s.serverId || "";
      const reward = (s.winningRewardLabel || "").replace(/"/g, '""');
      const price = s.order?.amountUsd ?? s.package?.priceUsd ?? 0;
      const st = s.status;
      const ref = s.fulfillmentRef || "";
      const ip = s.clientIp || "";
      return `"${date}","${orderNumber}","${game}","${pkg}","${uid}","${server}","${reward}",${price},"${st}","${ref}","${ip}"`;
    }).join("\n");

    return new Response(csvHeaders + csvRows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lucky-spins-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // Regular paginated query + analytics metrics
  const [totalCount, spins, statusCounts, totalRevenueAgg, winStats] = await Promise.all([
    prisma.randomSpinTransaction.count({ where }),
    prisma.randomSpinTransaction.findMany({
      where,
      include: {
        package: { select: { id: true, name: true, priceUsd: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            amountUsd: true,
            paymentMethod: true,
            game: { select: { id: true, name: true, slug: true, imageUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.randomSpinTransaction.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: {
        isRandomSpin: true,
        status: { in: ["PAID", "PROCESSING", "DELIVERED"] },
      },
      _sum: { amountUsd: true },
      _count: { _all: true },
    }),
    prisma.randomSpinTransaction.groupBy({
      by: ["winningRewardLabel"],
      where: {
        winningRewardLabel: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const statusSummary: Record<string, number> = {
    PENDING: 0,
    SPUN: 0,
    COMPLETED: 0,
    FAILED: 0,
  };
  statusCounts.forEach((c) => {
    statusSummary[c.status] = c._count._all;
  });

  return NextResponse.json({
    spins,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
    analytics: {
      totalSpins: totalRevenueAgg._count._all || 0,
      totalRevenueUsd: totalRevenueAgg._sum.amountUsd || 0,
      statusSummary,
      winDistribution: winStats.map((w) => ({
        label: w.winningRewardLabel,
        count: w._count._all,
      })),
    },
  });
});


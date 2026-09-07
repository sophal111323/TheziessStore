"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUSES = ["ALL", "PENDING", "PAID", "PROCESSING", "DELIVERED", "FAILED", "REFUNDED", "CANCELLED"];

const PILL_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
  PAID: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  PROCESSING: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  DELIVERED: "bg-green-400/10 text-green-400 border-green-400/30",
  FAILED: "bg-red-400/10 text-red-400 border-red-400/30",
  REFUNDED: "bg-fox-muted/10 text-fox-muted border-fox-border",
  CANCELLED: "bg-fox-muted/10 text-fox-muted border-fox-border",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [callingOrder, setCallingOrder] = useState<string | null>(null);
  const [bulkCalling, setBulkCalling] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ status, page: String(page) });
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders);
    setTotalPages(data.totalPages);
    setLoading(false);

    // Always fetch count of orders that need fulfillment (PAID)
    try {
      const countRes = await fetch(`/api/admin/orders?status=PAID&page=1`);
      const countData = await countRes.json();
      setPendingCount(countData.total ?? countData.orders?.length ?? 0);
    } catch {
      /* ignore */
    }
  }

  async function handleCallApi(orderNumber: string, orderStatus: string) {
    if (orderStatus === "DELIVERED") {
      const ok = window.confirm(
        `Order #${orderNumber} is already DELIVERED.\n\nAre you sure you want to call the supplier API again? (May charge your supplier balance again)`
      );
      if (!ok) return;
    } else if (orderStatus === "PENDING") {
      const ok = window.confirm(
        `Order #${orderNumber} is PENDING (unpaid).\n\nDo you want to force-call the supplier API anyway?`
      );
      if (!ok) return;
    }

    setCallingOrder(orderNumber);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderNumber}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          force: orderStatus === "FAILED" || orderStatus === "DELIVERED" || orderStatus === "PENDING",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setFeedback({
          type: "success",
          text: `✅ Order #${orderNumber} API called successfully! Ref: ${data.transactionId || data.status || "Completed"}`,
        });
      } else {
        setFeedback({
          type: "error",
          text: `❌ Order #${orderNumber} API call failed: ${data.error || data.status || "Unknown error"}`,
        });
      }
      await load();
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: `❌ Network error calling API for #${orderNumber}: ${err?.message || "Error"}`,
      });
    } finally {
      setCallingOrder(null);
    }
  }

  async function handleCallAllReady() {
    if (pendingCount <= 0) return;
    const ok = window.confirm(`Call supplier top-up API for all ${pendingCount} ready (PAID) order(s)?`);
    if (!ok) return;

    setBulkCalling(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allPaid: true }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setFeedback({
          type: "success",
          text: `⚡ Bulk API Call Complete: ${data.succeeded} succeeded, ${data.failed} failed out of ${data.total} order(s).`,
        });
      } else {
        setFeedback({
          type: "error",
          text: `❌ Bulk API call failed: ${data.error || "Unknown error"}`,
        });
      }
      await load();
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: `❌ Error during bulk API call: ${err?.message || "Error"}`,
      });
    } finally {
      setBulkCalling(false);
    }
  }

  async function clearAllOrders() {
    const scope = status === "ALL" ? "ALL orders (every status)" : `all ${status} orders`;
    const typed = window.prompt(
      `This will PERMANENTLY DELETE ${scope} from the database.\n\nType DELETE to confirm.`
    );
    if (typed !== "DELETE") return;

    const res = await fetch("/api/admin/orders/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE", status }),
    });
    const data = await res.json();
    if (!res.ok) {
      window.alert(data.error || "Failed to delete orders.");
      return;
    }
    window.alert(`Deleted ${data.deleted} order(s).`);
    setPage(1);
    load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="font-display text-3xl font-bold">Orders</h1>
        <a
          href={`/api/admin/orders/export?${new URLSearchParams({ ...(status !== "ALL" && { status }), ...(q && { q }) }).toString()}`}
          className="btn-ghost text-xs"
        >
          ⬇ Export CSV
        </a>
      </div>
      <p className="text-fox-muted mb-6">All customer orders.</p>

      {/* Bulk action banner for orders waiting for fulfillment */}
      {pendingCount > 0 && (
        <div className="mb-6 flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-fox-primary/50 bg-fox-primary/10 p-4 transition-colors">
          <div
            onClick={() => { setStatus("PAID"); setPage(1); }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fox-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-fox-primary" />
            </span>
            <div>
              <div className="font-display text-base font-bold text-fox-text group-hover:text-fox-primary transition-colors">
                {pendingCount} order{pendingCount === 1 ? "" : "s"} waiting for fulfillment
              </div>
              <div className="text-xs text-fox-muted">Orders paid and ready to call supplier top-up API.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCallAllReady}
              disabled={bulkCalling}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/20 hover:from-amber-600 hover:to-orange-600 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
            >
              {bulkCalling ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Processing all…</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Call API for All Ready ({pendingCount})</span>
                </>
              )}
            </button>
            {status !== "PAID" && (
              <button
                onClick={() => { setStatus("PAID"); setPage(1); }}
                className="btn-ghost text-xs px-3 py-2"
              >
                Filter PAID →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action feedback toast */}
      {feedback && (
        <div
          className={`mb-6 flex items-center justify-between rounded-xl p-4 text-sm font-medium ${
            feedback.type === "success"
              ? "border border-green-500/40 bg-green-500/10 text-green-300"
              : "border border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="ml-3 text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      <div className="card p-4 mb-6 flex flex-wrap gap-3">
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors ${
                status === s ? "bg-fox-primary text-black" : "bg-fox-surface text-fox-muted hover:text-fox-text"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2 flex-1 min-w-[300px]"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load();
          }}
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order #, UID, or email"
            className="input text-sm flex-1"
          />
          <button type="submit" className="btn-ghost text-sm px-4 py-2">Search</button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-fox-surface text-fox-muted text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3">Order #</th>
                <th className="text-left px-5 py-3">Game</th>
                <th className="text-left px-5 py-3">Product</th>
                <th className="text-left px-5 py-3">UID</th>
                <th className="text-right px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Payment</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Created</th>
                <th className="text-right px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fox-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-fox-muted">
                    Loading...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <div className="text-4xl mb-3">📦</div>
                    <p className="text-fox-muted mb-1">No orders match these filters</p>
                    <p className="text-xs text-fox-muted/60">Try adjusting the status filter or check back later.</p>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className={`hover:bg-fox-surface/50 ${o.status === "PAID" ? "bg-fox-primary/5" : ""}`}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/orders/${o.orderNumber}`}
                        className="font-mono text-fox-primary hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{o.game.name}</td>
                    <td className="px-5 py-3 text-fox-muted">{o.product.name}</td>
                    <td className="px-5 py-3 font-mono text-xs">{o.playerUid}</td>
                    <td className="px-5 py-3 text-right font-mono">${o.amountUsd.toFixed(2)}</td>
                    <td className="px-5 py-3 text-xs text-fox-muted">{o.paymentMethod.replace("_", " ")}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${PILL_COLORS[o.status]}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-fox-muted text-xs">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCallApi(o.orderNumber, o.status);
                        }}
                        disabled={callingOrder === o.orderNumber}
                        title={
                          o.status === "DELIVERED"
                            ? "Re-call API (order is already delivered)"
                            : o.status === "FAILED"
                            ? "Retry supplier top-up API"
                            : "Call supplier API to fulfill order"
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                          callingOrder === o.orderNumber
                            ? "bg-fox-muted/20 text-fox-muted cursor-wait"
                            : o.status === "PAID"
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 hover:shadow-orange-500/30 hover:-translate-y-0.5 active:translate-y-0"
                            : o.status === "FAILED"
                            ? "bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 hover:shadow-red-500/30 hover:-translate-y-0.5 active:translate-y-0"
                            : o.status === "PROCESSING"
                            ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30"
                            : o.status === "DELIVERED"
                            ? "bg-fox-surface text-fox-muted hover:text-green-400 hover:border-green-500/40 border border-fox-border"
                            : "bg-fox-surface text-fox-muted hover:text-fox-text border border-fox-border"
                        }`}
                      >
                        {callingOrder === o.orderNumber ? (
                          <>
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            <span>Calling…</span>
                          </>
                        ) : (
                          <>
                            <span>⚡</span>
                            <span>
                              {o.status === "DELIVERED"
                                ? "Re-call API"
                                : o.status === "FAILED"
                                ? "Retry API"
                                : "Call API"}
                            </span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-fox-border flex justify-between items-center text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost disabled:opacity-40 text-xs py-1 px-3"
            >
              ← Prev
            </button>
            <span className="text-fox-muted">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-ghost disabled:opacity-40 text-xs py-1 px-3"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="mt-10 card border-red-500/40 bg-red-500/5 p-5">
        <h2 className="font-display text-lg font-bold text-red-400 mb-1">Danger zone</h2>
        <p className="text-xs text-fox-muted mb-4">
          Permanently delete orders from the database. This action is irreversible and is recorded in the audit log.
          The current filter ({status === "ALL" ? "ALL statuses" : status}) will be used.
        </p>
        <button
          onClick={clearAllOrders}
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
        >
          Delete {status === "ALL" ? "all orders" : `all ${status} orders`}
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Activity,
  Calendar,
  RefreshCw,
  AlertCircle,
  Award,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { DashboardSummary, DashboardRange } from "../../types/dashboard.js";
import { dashboardApi } from "../../lib/api.js";

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

function CustomChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1">
        <p className="font-semibold text-slate-300 flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-blue-400" />
          {label}
        </p>
        <p className="text-emerald-400 font-bold text-sm">
          ₹{Number(data.revenue).toLocaleString("en-IN")}
        </p>
        <p className="text-slate-400">
          {data.orders} {data.orders === 1 ? "order" : "orders"}
        </p>
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const [range, setRange] = useState<DashboardRange>("30d");
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await dashboardApi.getSummary(range);
      setData(summary);
    } catch (err: any) {
      console.error("Failed to load dashboard metrics:", err);
      setError(
        err.response?.data?.error?.message ||
          "Unable to load growth metrics. Please verify backend connection."
      );
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const hasPaidSales = data && data.paidOrders > 0;

  return (
    <div className="space-y-8">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Agentic Commerce Business Insights</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Growth & Sales Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-xl">
            Real-time, server-authoritative financial metrics, order breakdowns, and top product performances synthesized from PostgreSQL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* Time Range Filter Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  range === r
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>

          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-sm cursor-pointer"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-pulse space-y-3"
              >
                <div className="w-24 h-4 bg-slate-100 rounded" />
                <div className="w-32 h-8 bg-slate-200 rounded" />
                <div className="w-20 h-3 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-80 animate-pulse" />
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-rose-900">Failed to Load Dashboard</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Revenue */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Revenue
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-slate-900">
                  ₹{data.totalRevenue.toLocaleString("en-IN")}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Paid Orders Only</span>
                </div>
              </div>
            </div>

            {/* Card 2: Orders Lifecycle */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Orders
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-slate-900">
                  {data.totalOrders}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold">
                  <span className="text-emerald-700">{data.paidOrders} Paid</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-amber-700">{data.pendingOrders} Pend</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-rose-700">{data.failedOrders} Fail</span>
                </div>
              </div>
            </div>

            {/* Card 3: Average Order Value */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Avg Order Value
                </span>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-slate-900">
                  ₹{data.averageOrderValue.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] font-medium text-slate-500 mt-1">
                  Paid Revenue / Paid Orders
                </div>
              </div>
            </div>

            {/* Card 4: Total Items Sold */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-purple-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Items Sold
                </span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-slate-900">
                  {data.totalItemsSold}
                </div>
                <div className="text-[11px] font-medium text-slate-500 mt-1">
                  Product units fulfilled
                </div>
              </div>
            </div>
          </div>

          {/* Sales Trend Chart Section */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Daily Sales Trend
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological daily paid revenue (in INR) across the selected {range} window.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 self-start sm:self-auto">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                <span>Paid Order Revenue (₹)</span>
              </div>
            </div>

            <div className="h-72 w-full">
              {hasPaidSales ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.salesByDay}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => d.slice(5)}
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "#e2e8f0" }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val: number) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No paid orders yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    When customers complete checkouts, their daily revenue and volume trends will be graphed in real time.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Top Selling Products Section */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Top Selling Products
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ranked by total units purchased in paid orders.
                </p>
              </div>

              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Award className="w-4 h-4" />
              </div>
            </div>

            {data.topProducts.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                {data.topProducts.map((prod, idx) => (
                  <div
                    key={prod.productId}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {prod.productName}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          ID: {prod.productId.slice(0, 8)}...
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0 text-right">
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          {prod.quantitySold} {prod.quantitySold === 1 ? "unit" : "units"}
                        </div>
                        <div className="text-[10px] text-slate-400">Sold</div>
                      </div>

                      <div className="min-w-[5rem]">
                        <div className="text-sm font-black text-slate-900">
                          ₹{prod.revenue.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          Revenue
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Package className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No product sales yet</h4>
                <p className="text-xs text-slate-500">
                  Products purchased through confirmed orders will appear here ranked by volume.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

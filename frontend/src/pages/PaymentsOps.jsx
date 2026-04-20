import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

function safeParseSummary(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function PaymentsOps() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastRun, setLastRun] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);

  const [timeoutMinutes, setTimeoutMinutes] = useState(30);
  const [limit, setLimit] = useState(200);
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");

  const fetchRuns = async () => {
    try {
      setLoading(true);
      setError("");
      const meRes = await api.get("/auth/me/");
      const admin = (meRes.data.role || "").toLowerCase() === "admin";
      setIsAdmin(admin);

      if (!admin) {
        setError("Admin access required for Payments Ops.");
        setLastRun(null);
        setRecentRuns([]);
        return;
      }

      const runsRes = await api.get("/payments/reconcile/");
      setLastRun(runsRes.data.last_run || null);
      setRecentRuns(runsRes.data.recent_runs || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load reconciliation runs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const lastSummary = useMemo(() => safeParseSummary(lastRun?.summary_json), [lastRun]);

  const triggerReconcile = async () => {
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const response = await api.post("/payments/reconcile/", {
        timeout_minutes: Number(timeoutMinutes) || 30,
        limit: Number(limit) || 200,
        status_filter: statusFilter,
        provider_filter: providerFilter.trim(),
        payment_method_filter: paymentMethodFilter,
      });
      setMessage(response.data.detail || "Reconciliation completed.");
      await fetchRuns();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to run reconciliation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Payments Ops</h1>
        <p>Trigger reconciliation with filters and review recent run summaries.</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      {loading ? (
        <div className="info-message">Loading payments ops data...</div>
      ) : !isAdmin ? (
        <div className="empty-state">
          <div className="empty-icon">Admin</div>
          <h3>Access restricted</h3>
          <p>Only admin users can trigger reconciliation jobs.</p>
        </div>
      ) : (
        <>
          <section className="payments-ops-form card">
            <h3>Run Reconciliation</h3>
            <div className="payment-card-grid">
              <div>
                <label>Timeout Minutes</label>
                <input
                  type="number"
                  min="1"
                  value={timeoutMinutes}
                  onChange={(e) => setTimeoutMinutes(e.target.value)}
                />
              </div>
              <div>
                <label>Max Rows</label>
                <input
                  type="number"
                  min="1"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </div>
              <div>
                <label>Status Filter</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All (initiated + authorized)</option>
                  <option value="initiated">Initiated</option>
                  <option value="authorized">Authorized</option>
                </select>
              </div>
              <div>
                <label>Payment Method</label>
                <select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)}>
                  <option value="">All</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="cod">COD</option>
                </select>
              </div>
              <div>
                <label>Provider Filter</label>
                <input
                  type="text"
                  placeholder="mock_gateway / razorpay"
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 10 }}>
              <button type="button" className="btn-action btn-add-cart" onClick={triggerReconcile} disabled={busy}>
                {busy ? "Running..." : "Run Reconciliation"}
              </button>
              <button type="button" className="btn-action btn-secondary" onClick={fetchRuns} disabled={busy}>
                Refresh Summary
              </button>
            </div>
          </section>

          <section className="card" style={{ marginTop: 14 }}>
            <h3>Last Run Summary</h3>
            {!lastRun ? (
              <p>No reconciliation runs yet.</p>
            ) : (
              <div className="payment-card-grid">
                <p><strong>Run ID:</strong> {lastRun.id}</p>
                <p><strong>Triggered By:</strong> {lastRun.triggered_by_username || "System"}</p>
                <p><strong>Created:</strong> {new Date(lastRun.created_at).toLocaleString()}</p>
                <p><strong>Timeout:</strong> {lastRun.timeout_minutes} min</p>
                <p><strong>Limit:</strong> {lastRun.limit}</p>
                <p><strong>Status Filter:</strong> {lastRun.status_filter || "all"}</p>
                <p><strong>Provider:</strong> {lastRun.provider_filter || "all"}</p>
                <p><strong>Method:</strong> {lastRun.payment_method_filter || "all"}</p>
                <p><strong>Reconciled Count:</strong> {lastSummary?.reconciled_count ?? 0}</p>
                <p><strong>Failed Payments:</strong> {lastSummary?.failed_payments ?? 0}</p>
                <p><strong>Failed Orders:</strong> {lastSummary?.failed_orders ?? 0}</p>
              </div>
            )}
          </section>

          <section className="card" style={{ marginTop: 14 }}>
            <h3>Recent Runs</h3>
            {recentRuns.length === 0 ? (
              <p>No recent run history.</p>
            ) : (
              <div className="payments-list">
                {recentRuns.map((run) => {
                  const summary = safeParseSummary(run.summary_json);
                  return (
                    <article className="payment-card" key={run.id}>
                      <div className="payment-card-header">
                        <h3>Run #{run.id}</h3>
                        <span className="payment-status-badge authorized">{summary?.reconciled_count ?? 0} reconciled</span>
                      </div>
                      <div className="payment-card-grid">
                        <p><strong>Triggered:</strong> {new Date(run.created_at).toLocaleString()}</p>
                        <p><strong>By:</strong> {run.triggered_by_username || "System"}</p>
                        <p><strong>Status Filter:</strong> {run.status_filter || "all"}</p>
                        <p><strong>Provider:</strong> {run.provider_filter || "all"}</p>
                        <p><strong>Method:</strong> {run.payment_method_filter || "all"}</p>
                        <p><strong>Failed Orders:</strong> {summary?.failed_orders ?? 0}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

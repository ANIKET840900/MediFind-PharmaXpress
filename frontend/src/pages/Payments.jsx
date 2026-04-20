import { useEffect, useMemo, useState } from "react";
import { api, getAuthToken } from "../api";

const STATUS_LABELS = {
  initiated: "Initiated",
  authorized: "Authorized",
  captured: "Captured",
  failed: "Failed",
};

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activePayment, setActivePayment] = useState(null);
  const [paymentEvents, setPaymentEvents] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const counts = useMemo(() => {
    return payments.reduce(
      (acc, item) => {
        const key = (item.status || "initiated").toLowerCase();
        if (acc[key] !== undefined) {
          acc[key] += 1;
        }
        return acc;
      },
      { initiated: 0, authorized: 0, captured: 0, failed: 0 }
    );
  }, [payments]);

  const fetchPayments = async () => {
    if (!getAuthToken()) {
      setError("Please login to view payment status.");
      setPayments([]);
      setLoading(false);
      return;
    }

    try {
      setError("");
      setLoading(true);
      const response = await api.get("/payments/");
      setPayments(response.data.results || []);
    } catch (err) {
      setError("Unable to fetch payment transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const openPaymentDetails = async (paymentId) => {
    try {
      setError("");
      setDetailsLoading(true);
      const response = await api.get(`/payments/${paymentId}/history/`);
      setActivePayment(response.data.payment || null);
      setPaymentEvents(response.data.events || []);
    } catch (err) {
      setError("Unable to fetch payment details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeModal = () => {
    setActivePayment(null);
    setPaymentEvents([]);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Payment Status</h1>
        <p>Track initiated, authorized, captured, and failed transactions.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <section className="payments-summary-grid" aria-label="Payment status summary">
        <div className="payments-summary-card initiated">
          <strong>{counts.initiated}</strong>
          <span>Initiated</span>
        </div>
        <div className="payments-summary-card authorized">
          <strong>{counts.authorized}</strong>
          <span>Authorized</span>
        </div>
        <div className="payments-summary-card captured">
          <strong>{counts.captured}</strong>
          <span>Captured</span>
        </div>
        <div className="payments-summary-card failed">
          <strong>{counts.failed}</strong>
          <span>Failed</span>
        </div>
      </section>

      <div className="form-actions" style={{ marginBottom: 16 }}>
        <button type="button" className="btn-action" onClick={fetchPayments} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Payments"}
        </button>
      </div>

      {loading && <div className="info-message">Loading payment transactions...</div>}

      {!loading && payments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">No Payments</div>
          <h3>No payment transactions yet</h3>
          <p>Choose UPI or card during checkout to generate payment records.</p>
        </div>
      ) : (
        <div className="payments-list">
          {payments.map((payment) => (
            <article className="payment-card" key={payment.id}>
              <div className="payment-card-header">
                <h3>Transaction #{payment.id}</h3>
                <span className={`payment-status-badge ${(payment.status || "initiated").toLowerCase()}`}>
                  {STATUS_LABELS[(payment.status || "initiated").toLowerCase()] || payment.status}
                </span>
              </div>

              <div className="payment-card-grid">
                <p><strong>Method:</strong> {(payment.payment_method || "cod").toUpperCase()}</p>
                <p><strong>Amount:</strong> {payment.currency} {Number(payment.amount || 0).toFixed(2)}</p>
                <p><strong>Gateway Order:</strong> {payment.gateway_order_id || "-"}</p>
                <p><strong>Gateway Payment:</strong> {payment.gateway_payment_id || "-"}</p>
                <p><strong>Provider:</strong> {payment.provider || "mock_gateway"}</p>
                <p><strong>Updated:</strong> {new Date(payment.updated_at).toLocaleString()}</p>
              </div>
              <div className="form-actions" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-action btn-secondary"
                  onClick={() => openPaymentDetails(payment.id)}
                >
                  View Details
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {detailsLoading && <div className="info-message">Loading payment details...</div>}

      {activePayment && (
        <div className="payment-modal-backdrop" role="dialog" aria-modal="true" aria-label="Payment details">
          <div className="payment-modal">
            <div className="payment-modal-header">
              <h3>Payment #{activePayment.id} Details</h3>
              <button type="button" className="btn-action btn-delete" onClick={closeModal}>Close</button>
            </div>

            <div className="payment-card-grid">
              <p><strong>Status:</strong> {(activePayment.status || "initiated").toUpperCase()}</p>
              <p><strong>Method:</strong> {(activePayment.payment_method || "cod").toUpperCase()}</p>
              <p><strong>Gateway Order:</strong> {activePayment.gateway_order_id || "-"}</p>
              <p><strong>Gateway Payment:</strong> {activePayment.gateway_payment_id || "-"}</p>
            </div>

            <h4 className="payment-history-title">Webhook Payload History</h4>
            {paymentEvents.length === 0 ? (
              <p className="info-message">No webhook payloads recorded yet.</p>
            ) : (
              <div className="payment-history-list">
                {paymentEvents.map((event) => (
                  <div className="payment-history-card" key={event.id}>
                    <p><strong>Event:</strong> {event.event_name || "payment.updated"}</p>
                    <p><strong>Status:</strong> {(event.status || "unknown").toUpperCase()}</p>
                    <p><strong>Idempotency Key:</strong> {event.idempotency_key}</p>
                    <p><strong>Processed:</strong> {event.processed ? "Yes" : "No"}</p>
                    <p><strong>Replays:</strong> {event.replay_count}</p>
                    <pre className="payment-payload">{event.raw_payload || "{}"}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

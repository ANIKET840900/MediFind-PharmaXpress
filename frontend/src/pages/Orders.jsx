import { useEffect, useState } from "react";
import { api, getAuthToken } from "../api";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const orderSteps = ["Placed", "Packed", "Shipped", "Out for delivery", "Delivered"];

  const getActiveStep = (status = "placed") => {
    const normalized = status.replaceAll("_", " ");
    return orderSteps.findIndex((step) => step.toLowerCase() === normalized.toLowerCase());
  };

  useEffect(() => {
    const fetchOrders = async () => {
      if (!getAuthToken()) {
        setError("Please login to view orders.");
        return;
      }

      try {
        const res = await api.get("/orders/");
        setOrders(res.data.results || []);
      } catch (err) {
        setError("Unable to fetch orders.");
      }
    };

    fetchOrders();
  }, []);

  const refreshOrders = async () => {
    try {
      const res = await api.get("/orders/");
      setOrders(res.data.results || []);
    } catch (err) {
      setError("Unable to fetch orders.");
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      setError("");
      await api.post(`/orders/${orderId}/cancel/`, {});
      setMessage("Order cancelled successfully.");
      setTimeout(() => setMessage(""), 2500);
      refreshOrders();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to cancel order.");
    }
  };

  const requestReturn = async (orderId) => {
    const reason = window.prompt("Reason for return request:", "Damaged or not as expected");
    if (!reason) return;
    try {
      setError("");
      await api.post("/returns/", { order: orderId, reason });
      setMessage("Return request submitted.");
      setTimeout(() => setMessage(""), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to create return request.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>📦 Order History</h1>
        <p>Track and manage your purchases</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      <section className="orders-hero-banner">
        <div>
          <span className="market-kicker">Order tracking</span>
          <h2>Track every purchase from confirmation to delivery.</h2>
          <p>Keep an eye on status updates, cancellations, and return requests in one clean dashboard.</p>
        </div>
        <div className="orders-hero-flow">
          {orderSteps.map((step) => (
            <span key={step}>{step}</span>
          ))}
        </div>
      </section>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No orders yet</h3>
          <p>Start shopping to place your first order</p>
        </div>
      ) : (
        <div className="orders-container">
          {orders.map((order) => (
            <div className="order-card" key={order.id}>
              <div className="order-header">
                <div>
                  <div className="order-id">Order #{order.id}</div>
                  <div className="order-date">{new Date(order.created_at).toLocaleDateString()}</div>
                  <div className="order-date">Tracking: {order.tracking_id || "Pending"}</div>
                </div>
                <div className={`order-status order-status-${order.status || "placed"}`}>
                  {(order.status || "placed").replaceAll("_", " ")}
                </div>
              </div>

              <div className="tracking-rail" aria-label={`Tracking progress for order ${order.id}`}>
                {orderSteps.map((step, index) => {
                  const activeStep = getActiveStep(order.status || "placed");
                  const isActive = index <= (activeStep >= 0 ? activeStep : 0);
                  return (
                    <span key={step} className={`tracking-step ${isActive ? "is-active" : ""}`}>
                      {step}
                    </span>
                  );
                })}
              </div>
              
              <div className="order-items">
                <h4>Items:</h4>
                <ul>
                  {order.items_detail.map((item) => (
                    <li key={item.id}>
                      <span>{item.medicine_detail.name}</span>
                      <span className="qty">× {item.quantity}</span>
                      <span className="price">₹ {(item.quantity * item.medicine_detail.price).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="order-address">
                <h4>Delivery Address:</h4>
                <p>
                  {order.house_number || order.street || order.city || order.state || order.pincode
                    ? `${order.house_number || ""}${order.house_number ? ", " : ""}${order.street || ""}${order.street ? ", " : ""}${order.city || ""}${order.city ? ", " : ""}${order.state || ""}${order.state ? " - " : ""}${order.pincode || ""}`
                    : order.delivery_address || "No delivery address saved."}
                </p>
                <p><strong>Mobile:</strong> {order.mobile_number || "Not provided"}</p>
                <p><strong>Payment:</strong> {(order.payment_method || "cod").toUpperCase()}</p>
                <p><strong>Subtotal + charges:</strong> ₹ {Number(order.total_amount || 0).toFixed(2)}</p>
                <div className="form-actions" style={{ marginTop: 10 }}>
                  {order.status !== "cancelled" && order.status !== "delivered" && (
                    <button className="btn-action btn-delete" onClick={() => cancelOrder(order.id)}>
                      Cancel Order
                    </button>
                  )}
                  {order.status === "delivered" && (
                    <button className="btn-action btn-secondary" onClick={() => requestReturn(order.id)}>
                      Request Return
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
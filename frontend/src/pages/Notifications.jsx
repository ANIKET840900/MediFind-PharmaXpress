import { useEffect, useState } from "react";
import { api } from "../api";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    try {
      setError("");
      const res = await api.get("/notifications/");
      setItems(res.data.results || []);
    } catch (err) {
      setError("Unable to load notifications.");
      setItems([]);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAsRead = async (notificationId) => {
    try {
      await api.post("/notifications/mark-read/", { notification_id: notificationId });
      loadNotifications();
    } catch (err) {
      setError("Unable to mark notification as read.");
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post("/notifications/mark-read/", {});
      loadNotifications();
    } catch (err) {
      setError("Unable to update notifications.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>🔔 Notifications</h1>
        <p>Order updates, returns, and important account alerts</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="form-actions" style={{ marginBottom: 14 }}>
        <button className="btn-action btn-secondary" onClick={markAllAsRead}>Mark all as read</button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔔</div>
          <h3>No notifications</h3>
          <p>You are all caught up.</p>
        </div>
      ) : (
        <div className="orders-container">
          {items.map((item) => (
            <div key={item.id} className={`order-card notification-card ${item.is_read ? "is-read" : ""}`}>
              <div className="order-header">
                <div>
                  <div className="order-id">{item.title}</div>
                  <div className="order-date">{new Date(item.created_at).toLocaleString()}</div>
                </div>
                <div className={`order-status ${item.is_read ? "order-status-delivered" : "order-status-placed"}`}>
                  {item.is_read ? "Read" : "New"}
                </div>
              </div>
              <p>{item.message}</p>
              {!item.is_read && (
                <button className="btn-action btn-add-cart" onClick={() => markAsRead(item.id)}>
                  Mark as read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import MedicineCard from "../components/MedicineCard";

export default function Wishlist() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadWishlist = async () => {
    try {
      setError("");
      const res = await api.get("/wishlist/");
      setItems(res.data.results || []);
    } catch (err) {
      setError("Unable to load wishlist.");
      setItems([]);
    }
  };

  useEffect(() => {
    loadWishlist();
  }, []);

  const removeFromWishlist = async (id) => {
    try {
      await api.delete(`/wishlist/${id}/`);
      setMessage("Removed from wishlist.");
      setTimeout(() => setMessage(""), 2000);
      loadWishlist();
    } catch (err) {
      setError("Unable to remove item.");
    }
  };

  const addToCart = async (medicineId) => {
    try {
      await api.post("/cart/", { medicine: medicineId, quantity: 1 });
      setMessage("Added to cart.");
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to add to cart.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>❤ Wishlist</h1>
        <p>Save medicines for later purchase</p>
      </div>

      <section className="wishlist-banner">
        <div>
          <span className="market-kicker">Saved for later</span>
          <h2>Keep medicines here until you are ready to buy.</h2>
          <p>Return to these items quickly, compare options, and move the ones you need into your cart.</p>
        </div>
        <button className="btn-hero btn-primary" onClick={() => navigate("/search")}>Browse medicines</button>
      </section>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">❤</div>
          <h3>No items in wishlist</h3>
          <p>Browse medicines and save your favorites.</p>
        </div>
      ) : (
        <div className="medicine-grid">
          {items.map((item) => (
            <div key={item.id}>
              <MedicineCard medicine={item.medicine_detail} onAddToCart={addToCart} />
              <button className="btn-action btn-delete" onClick={() => removeFromWishlist(item.id)}>
                Remove from Wishlist
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { api, getAuthToken } from "../api";

export default function Cart() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [couponCode, setCouponCode] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);

  const checkoutSteps = ["Cart", "Address", "Payment"];

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.medicine_detail.price, 0),
    [items]
  );

  const totalUnits = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items]
  );

  const loadCart = async () => {
    if (!getAuthToken()) {
      setError("Please login to view cart.");
      setItems([]);
      return;
    }
    try {
      setError("");
      const res = await api.get("/cart/");
      setItems(res.data.results || []);
    } catch (err) {
      setError("Unable to load cart.");
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  const updateQuantity = async (id, quantity) => {
    const safeQuantity = Math.max(1, Number(quantity) || 1);
    try {
      await api.patch(`/cart/${id}/`, { quantity: safeQuantity });
      loadCart();
    } catch (err) {
      setError("Unable to update quantity.");
    }
  };

  const removeItem = async (id) => {
    try {
      await api.delete(`/cart/${id}/`);
      loadCart();
    } catch (err) {
      setError("Unable to remove item.");
    }
  };

  const placeOrder = async () => {
    try {
      setIsPlacingOrder(true);
      setMessage("");
      setError("");
      setPaymentInfo(null);
      if (!items.length) {
        setError("Your cart is empty.");
        return;
      }
      if (!mobileNumber.trim() || !houseNumber.trim() || !street.trim() || !city.trim() || !stateName.trim() || !pincode.trim()) {
        setError("Please fill mobile number, house number, street, city, state, and pincode.");
        return;
      }
      if (!/^\d{10,15}$/.test(mobileNumber.trim())) {
        setError("Enter a valid mobile number (10 to 15 digits).");
        return;
      }
      const deliveryAddress = `${houseNumber.trim()}, ${street.trim()}, ${city.trim()}, ${stateName.trim()} - ${pincode.trim()}`;
      let paymentReference = "";
      if (paymentMethod !== "cod") {
        const paymentRes = await api.post("/payments/initialize/", {
          items: items.map((i) => i.id),
          payment_method: paymentMethod,
          coupon_code: couponCode.trim().toUpperCase(),
        });
        const paymentId = paymentRes.data?.payment?.id;
        const confirmRes = await api.post(`/payments/${paymentId}/confirm/`, { action: "capture" });
        paymentReference = confirmRes.data?.payment?.gateway_order_id || paymentRes.data?.payment?.gateway_order_id || "";
        setPaymentInfo(confirmRes.data?.payment || paymentRes.data?.payment || null);
      }

      await api.post("/orders/", {
        items: items.map((i) => i.id),
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        coupon_code: couponCode.trim().toUpperCase(),
        delivery_address: deliveryAddress,
        mobile_number: mobileNumber.trim(),
        house_number: houseNumber.trim(),
        street: street.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
      });
      setMessage("✓ Order placed successfully!");
      setMobileNumber("");
      setHouseNumber("");
      setStreet("");
      setCity("");
      setStateName("");
      setPincode("");
      setCouponCode("");
      setPaymentMethod("cod");
      loadCart();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to place order.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>🛒 Shopping Cart</h1>
        <p>Review your items and checkout</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}
      {paymentInfo && (
        <div className="info-banner" role="status">
          Payment initialized: {paymentInfo.payment_method.toUpperCase()} • Ref {paymentInfo.gateway_order_id}
        </div>
      )}

      {items.length > 0 && (
        <section className="cart-hero-banner">
          <div className="cart-hero-copy">
            <span className="market-kicker">Secure checkout</span>
            <h2>Review your cart and confirm delivery details.</h2>
            <p>We keep the checkout simple: verify your address, choose payment, and place the order in one pass.</p>
          </div>
          <div className="cart-hero-summary">
            <div>
              <strong>{items.length}</strong>
              <span>Items</span>
            </div>
            <div>
              <strong>{totalUnits}</strong>
              <span>Units</span>
            </div>
            <div>
              <strong>₹ {total.toFixed(2)}</strong>
              <span>Subtotal</span>
            </div>
          </div>
        </section>
      )}

      <div className="checkout-step-rail" aria-label="Checkout progress">
        {checkoutSteps.map((step, index) => (
          <div key={step} className={`checkout-step ${index === 0 ? "is-active" : ""}`}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Add some medicines to get started</p>
        </div>
      ) : (
        <div className="cart-container">
          <div className="cart-items">
            {items.map((item) => (
              <div className="cart-item" key={item.id}>
                <div className="cart-item-info">
                  <h3>{item.medicine_detail.name}</h3>
                  <p>Shop: {item.medicine_detail.shop_name}</p>
                  <p className="price">Unit: ₹ {item.medicine_detail.price}</p>
                </div>

                <div className="cart-item-quantity">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button>
                  <span className="cart-qty-value">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                </div>

                <div className="cart-item-price">
                  <div className="total">₹ {(item.quantity * item.medicine_detail.price).toFixed(2)}</div>
                  <button onClick={() => removeItem(item.id)} className="btn-remove">Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h3>Order Summary</h3>
            <div className="summary-address">
              <label>Delivery Address</label>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="Mobile Number"
                inputMode="numeric"
              />
              <input
                type="text"
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                placeholder="House / Flat No."
              />
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Street / Area"
              />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
              <div className="summary-address-grid">
                <input
                  type="text"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  placeholder="State"
                />
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="Pincode"
                />
              </div>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cod">Cash on Delivery</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Coupon code (try FIRST50)"
              />
            </div>
            <div className="summary-row">
              <span>Items ({items.length}) • Units ({totalUnits}):</span>
              <span>₹ {total.toFixed(2)}</span>
            </div>
            <div className="summary-row" style={{marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #2874f0'}}>
              <span style={{fontWeight: '800', fontSize: '18px'}}>Total:</span>
              <span style={{fontWeight: '800', fontSize: '18px', color: '#1aa260'}}>₹ {total.toFixed(2)}</span>
            </div>
            <button onClick={placeOrder} className="btn-action btn-add-cart checkout-btn" disabled={isPlacingOrder}>
              {isPlacingOrder ? "Processing..." : "✓ Place Order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
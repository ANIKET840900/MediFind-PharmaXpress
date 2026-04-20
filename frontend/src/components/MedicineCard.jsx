import { useNavigate } from "react-router-dom";

export default function MedicineCard({ medicine, userLocation, onAddToCart, onBuy, onEdit, onDelete, onAddToWishlist }) {
  const navigate = useNavigate();
  const imageSrc = medicine.image_url || `https://picsum.photos/seed/medicine-${medicine.id}/420/260`;
  const hasCoords = medicine.shop_latitude != null && medicine.shop_longitude != null;
  const hasOrigin = userLocation?.latitude != null && userLocation?.longitude != null;
  const HIDDEN_NEARBY_RANGE_KM = 20;
  const destination = hasCoords ? `${medicine.shop_latitude},${medicine.shop_longitude}` : null;
  const directionsUrl = destination
    ? `https://www.google.com/maps/dir/?api=1${hasOrigin ? `&origin=${encodeURIComponent(`${userLocation.latitude},${userLocation.longitude}`)}` : ""}&destination=${encodeURIComponent(destination)}&travelmode=driving`
    : null;
  const numericRating = medicine.shop_rating ? Number(medicine.shop_rating).toFixed(1) : null;
  const starCount = medicine.shop_rating ? Math.max(1, Math.min(5, Math.round(Number(medicine.shop_rating)))) : 0;
  const starText = starCount ? `${"★".repeat(starCount)}${"☆".repeat(5 - starCount)}` : "No rating";
  const distanceKm = medicine.distance_km ?? medicine.distanceKm;
  const showNearYouBadge = typeof distanceKm === "number" && distanceKm <= HIDDEN_NEARBY_RANGE_KM;

  return (
    <div className="medicine-card">
      <img className="medicine-thumb" src={imageSrc} alt={medicine.name} loading="lazy" />

      <div className="card-header">
        <div className="medicine-badge">{medicine.in_stock ? "In Stock" : "Out of Stock"}</div>
        <div className="card-header-badges">
          {medicine.prescription_required && <span className="card-pill card-pill-warning">Rx required</span>}
          {numericRating && <span className="card-pill card-pill-soft">{numericRating} rating</span>}
          {showNearYouBadge && <span className="near-you-badge">Near you</span>}
          {medicine.in_stock && <div className="stock-indicator"></div>}
        </div>
      </div>

      <div className="card-content">
        <h3 className="medicine-name medicine-name-link" onClick={() => navigate(`/medicine/${medicine.id}`)}>
          {medicine.name}
        </h3>
        
        <div className="medicine-info">
          <div className="info-row">
            <span className="label">Shop:</span>
            <span className="value">{medicine.shop_name || "Medical Shop"}</span>
          </div>

          <div className="info-row">
            <span className="label">Area:</span>
            <span className="value">{medicine.shop_area || "Area not available"}</span>
          </div>

          <div className="info-row">
            <span className="label">Location:</span>
            <span className="value">
              {medicine.shop_area && medicine.shop_state
                ? `${medicine.shop_area}, ${medicine.shop_state}`
                : medicine.shop_state || medicine.shop_area || "Location not available"}
            </span>
          </div>

          {directionsUrl && (
            <div className="info-row">
              <span className="label">Direction:</span>
              <a className="shop-map-link" href={directionsUrl} target="_blank" rel="noreferrer">
                {hasOrigin ? "Get direction from my location" : "Get direction"}
              </a>
            </div>
          )}

          <div className="info-row">
            <span className="label">State:</span>
            <span className="value">{medicine.shop_state || "State not available"}</span>
          </div>

          {typeof distanceKm === "number" && (
            <div className="info-row">
              <span className="label">Distance:</span>
              <span className="value">{distanceKm.toFixed(2)} km</span>
            </div>
          )}

          <div className="info-row">
            <span className="label">Rate:</span>
            <span className="value">
              {numericRating ? `${starText} (${numericRating}/5)` : starText}
            </span>
          </div>
          
          <div className="info-row">
            <span className="label">Price:</span>
            <span className="price">₹ {medicine.price}</span>
          </div>

          <div className="info-row">
            <span className="label">Availability:</span>
            <span className={`availability ${medicine.in_stock ? "available" : "unavailable"}`}>
              {medicine.in_stock ? "✓ Available" : "✗ Out of Stock"}
            </span>
          </div>

          <div className="card-trust-row">
            <span>Trusted shop listing</span>
            {showNearYouBadge && <span>Nearby pickup</span>}
            {medicine.prescription_required && <span>Prescription verified</span>}
          </div>
        </div>
      </div>

      <div className="card-actions">
        {onBuy && (
          <button
            className="btn-action btn-buy-now"
            onClick={() => onBuy(medicine.id)}
            disabled={!medicine.in_stock}
          >
            Buy Now
          </button>
        )}
        {onAddToCart && (
          <button
            className="btn-action btn-add-cart"
            onClick={() => onAddToCart(medicine.id)}
            disabled={!medicine.in_stock}
          >
            🛒 Add to Cart
          </button>
        )}
        {onAddToWishlist && (
          <button className="btn-action btn-secondary" onClick={() => onAddToWishlist(medicine.id)}>
            ♡ Wishlist
          </button>
        )}
        {onEdit && (
          <button 
            className="btn-action btn-edit"
            onClick={() => onEdit(medicine.id)}
          >
            ✏️ Edit
          </button>
        )}
        {onDelete && (
          <button 
            className="btn-action btn-delete"
            onClick={() => onDelete(medicine.id)}
          >
            🗑️ Delete
          </button>
        )}
      </div>
    </div>
  );
}

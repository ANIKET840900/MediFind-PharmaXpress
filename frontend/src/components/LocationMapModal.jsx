function buildGoogleMapsEmbedUrl(userLocation) {
  if (!userLocation) {
    return "";
  }

  const lat = Number(userLocation.latitude);
  const lng = Number(userLocation.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "";
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=17&output=embed`;
}

function buildGoogleMapsDirectionsUrl(userLocation, shop) {
  if (!userLocation || !shop) {
    return "https://www.google.com/maps";
  }

  const origin = `${userLocation.latitude},${userLocation.longitude}`;
  const destination = shop.latitude != null && shop.longitude != null ? `${shop.latitude},${shop.longitude}` : shop.name || "";
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export default function LocationMapModal({ isOpen, onClose, userLocation, nearbyShops }) {
  if (!isOpen) return null;

  const mapsEmbedUrl = buildGoogleMapsEmbedUrl(userLocation);
  const nearestShop = Array.isArray(nearbyShops) && nearbyShops.length > 0 ? nearbyShops[0] : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content location-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📍 Your Live Location on Google Maps</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="location-map-container">
            {mapsEmbedUrl ? (
              <iframe
                title="Google Maps live location"
                src={mapsEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : (
              <div className="empty-state-compact">
                <p>Location details are unavailable right now.</p>
              </div>
            )}

            {userLocation && (
              <div className="map-overlay-copy">
                <strong>Exact live location</strong>
                <span>
                  {Number(userLocation.latitude).toFixed(6)}, {Number(userLocation.longitude).toFixed(6)}
                  {userLocation.accuracy ? ` • ±${Math.round(userLocation.accuracy)}m` : ""}
                </span>
              </div>
            )}
          </div>

          {nearestShop && (
            <div className="nearest-shop-spotlight">
              <h3>Closest medical store from your live location</h3>
              <div className="nearest-shop-card">
                <img
                  className="nearest-shop-image"
                  src={nearestShop.photoUrl}
                  alt={nearestShop.name}
                  loading="lazy"
                />
                <div className="nearest-shop-copy">
                  <div className="nearest-shop-title-row">
                    <h4>{nearestShop.name}</h4>
                    <span>{nearestShop.distanceKm.toFixed(2)} km away</span>
                  </div>
                  <p>📍 {nearestShop.area}, {nearestShop.state}</p>
                  {nearestShop.topMedicineName && <p>💊 {nearestShop.topMedicineName}</p>}
                  <div className="nearest-shop-actions">
                    <a
                      className="btn-action btn-secondary shop-map-link"
                      href={buildGoogleMapsDirectionsUrl(userLocation, nearestShop)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open route in Google Maps
                    </a>
                    {nearestShop.latitude != null && nearestShop.longitude != null && (
                      <span className="nearest-shop-coords">
                        {Number(nearestShop.latitude).toFixed(6)}, {Number(nearestShop.longitude).toFixed(6)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {nearbyShops && nearbyShops.length > 0 && (
            <div className="nearby-shops-list">
              <h3>Medical Stores Nearby ({nearbyShops.length})</h3>
              <div className="shops-scroll">
                {nearbyShops.map((shop) => (
                  <div key={shop.id} className="shop-card-compact">
                    <div className="shop-card-header">
                      <span className="shop-icon">🏥</span>
                      <h4>{shop.name}</h4>
                    </div>
                    <p className="shop-location">
                      📍 {shop.area}, {shop.state}
                    </p>
                    {shop.rating && (
                      <p className="shop-rating">
                        ⭐ {shop.rating.toFixed(1)} rating
                      </p>
                    )}
                    <a
                      className="btn-action btn-secondary shop-map-link"
                      href={buildGoogleMapsDirectionsUrl(userLocation, shop)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!nearbyShops || nearbyShops.length === 0) && (
            <div className="empty-state-compact">
              <p>No nearby medical stores found in this area.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-action btn-secondary" onClick={onClose}>
            Close Map
          </button>
        </div>
      </div>
    </div>
  );
}

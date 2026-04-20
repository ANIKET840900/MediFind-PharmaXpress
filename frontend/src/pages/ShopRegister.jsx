import { useEffect, useRef, useState } from "react";
import { api, getAuthToken } from "../api";
import MedicineCard from "../components/MedicineCard";

const LOCATION_HELP_URL = "https://support.microsoft.com/en-us/microsoft-edge/website-wants-to-use-your-location-in-microsoft-edge-24facc98-4866-4584-9ca2-7a1f262f4eec";

export default function ShopRegister() {
  const watchIdRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [state, setState] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationSource, setLocationSource] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [locationHint, setLocationHint] = useState("Auto-fill shop latitude and longitude from your device location.");
  const [copyStatus, setCopyStatus] = useState("");
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [medicineId, setMedicineId] = useState(null);
  const [medicineName, setMedicineName] = useState("");
  const [medicineBrand, setMedicineBrand] = useState("");
  const [medicineCategory, setMedicineCategory] = useState("General");
  const [medicineDescription, setMedicineDescription] = useState("");
  const [medicineComposition, setMedicineComposition] = useState("");
  const [medicineRequiresPrescription, setMedicineRequiresPrescription] = useState(false);
  const [medicinePrice, setMedicinePrice] = useState("");
  const [medicineInStock, setMedicineInStock] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const resetMedicineForm = () => {
    setMedicineId(null);
    setMedicineName("");
    setMedicineBrand("");
    setMedicineCategory("General");
    setMedicineDescription("");
    setMedicineComposition("");
    setMedicineRequiresPrescription(false);
    setMedicinePrice("");
    setMedicineInStock(true);
  };

  const loadData = async () => {
    if (!getAuthToken()) {
      setError("Please login to manage shops.");
      setShops([]);
      return;
    }

    try {
      setError("");
      const [meRes, shopsRes, medicinesRes] = await Promise.all([
        api.get("/auth/me/"),
        api.get("/shops/"),
        api.get("/medicines/?page_size=200"),
      ]);
      const mine = shopsRes.data.filter((shop) => shop.owner === meRes.data.id);
      setCurrentUser(meRes.data);
      setShops(mine);
      setMedicines(Array.isArray(medicinesRes.data) ? medicinesRes.data : (medicinesRes.data.results || []));
      if (!selectedShopId && mine.length > 0) {
        setSelectedShopId(String(mine[0].id));
      }
      if (mine.length === 0) {
        setSelectedShopId("");
      }
    } catch (err) {
      setError("Unable to load your shop data.");
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const applyLocation = (position) => {
    setLatitude(position.coords.latitude.toFixed(6));
    setLongitude(position.coords.longitude.toFixed(6));
    setLocationSource("gps");
    setLocationHint(
      `Location updated at ${new Date().toLocaleTimeString()}${position.coords.accuracy ? ` (±${Math.round(position.coords.accuracy)}m)` : ""}.`
    );
  };

  const fallbackLocationFromIp = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) {
        throw new Error("IP location unavailable");
      }
      const data = await res.json();
      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("IP location response missing coordinates");
      }
      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));
      setLocationSource("ip");
      setLocationHint("Using approximate network location. Enable browser location permission for accurate live GPS.");
      return true;
    } catch (err) {
      return false;
    }
  };

  const stopLiveLocation = () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsLiveTracking(false);
  };

  const useMyCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      fallbackLocationFromIp();
      return;
    }

    if (!window.isSecureContext) {
      setError("Location requires a secure context (HTTPS or localhost).");
      fallbackLocationFromIp();
      return;
    }

    setIsLocating(true);
    setError("");
    setLocationHint("Requesting your current location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyLocation(position);
        setIsLocating(false);
      },
      (geoError) => {
        let message = "Unable to get your current location. You can enter coordinates manually.";
        if (geoError.code === 1) message = "Location permission denied. Allow location permission and try again.";
        if (geoError.code === 2) message = "Location unavailable. Check GPS/network and retry.";
        if (geoError.code === 3) message = "Location request timed out. Please retry.";
        setError(message);
        setLocationHint("You can still enter latitude and longitude manually.");
        setIsLocating(false);
        fallbackLocationFromIp();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const startLiveLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      fallbackLocationFromIp();
      return;
    }

    if (!window.isSecureContext) {
      setError("Live location requires a secure context (HTTPS or localhost).");
      fallbackLocationFromIp();
      return;
    }

    stopLiveLocation();
    setError("");
    setIsLocating(true);
    setLocationHint("Starting live location updates...");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        applyLocation(position);
        setIsLocating(false);
        setIsLiveTracking(true);
      },
      (geoError) => {
        let message = "Unable to start live location tracking.";
        if (geoError.code === 1) message = "Location permission denied. Allow location permission and try again.";
        if (geoError.code === 2) message = "Live location unavailable. Check GPS/network.";
        if (geoError.code === 3) message = "Live location timed out. Please retry.";
        setError(message);
        setIsLocating(false);
        setIsLiveTracking(false);
        setLocationHint("You can still use one-time current location or enter coordinates manually.");
        fallbackLocationFromIp();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const copyCoordinates = async () => {
    if (!latitude || !longitude) {
      setCopyStatus("No coordinates to copy");
      setTimeout(() => setCopyStatus(""), 2500);
      return;
    }

    const text = `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied");
      setTimeout(() => setCopyStatus(""), 1000);
    } catch (err) {
      setCopyStatus("Copy failed");
      setTimeout(() => setCopyStatus(""), 2500);
    }
  };

  const createShop = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setMessage("");
      await api.post("/shops/", {
        name,
        area,
        state,
        gst_number: gstNumber.trim().toUpperCase(),
        pan_number: panNumber.trim().toUpperCase(),
        bank_account_name: bankAccountName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        ifsc_code: ifscCode.trim().toUpperCase(),
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      });
      setName("");
      setArea("");
      setState("");
      setGstNumber("");
      setPanNumber("");
      setBankAccountName("");
      setBankAccountNumber("");
      setIfscCode("");
      setLatitude("");
      setLongitude("");
      setMessage("✓ Shop registered successfully!");
      setTimeout(() => setMessage(""), 3000);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to create shop.");
    }
  };

  const createOrUpdateMedicine = async (e) => {
    e.preventDefault();
    if (!selectedShopId) {
      setError("Create a shop first to manage medicines.");
      return;
    }

    try {
      setError("");
      setMessage("");
      const payload = {
        shop: Number(selectedShopId),
        name: medicineName,
        brand: medicineBrand,
        category: medicineCategory,
        description: medicineDescription,
        composition: medicineComposition,
        prescription_required: medicineRequiresPrescription,
        price: Number(medicinePrice),
        in_stock: medicineInStock,
      };

      if (medicineId) {
        await api.patch(`/medicines/${medicineId}/`, payload);
        setMessage("✓ Medicine updated.");
      } else {
        await api.post("/medicines/", payload);
        setMessage("✓ Medicine added.");
      }

      setTimeout(() => setMessage(""), 3000);
      resetMedicineForm();
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to save medicine.");
    }
  };

  const handleEditMedicine = (medicine) => {
    setSelectedShopId(String(medicine.shop));
    setMedicineId(medicine.id);
    setMedicineName(medicine.name);
    setMedicineBrand(medicine.brand || "");
    setMedicineCategory(medicine.category || "General");
    setMedicineDescription(medicine.description || "");
    setMedicineComposition(medicine.composition || "");
    setMedicineRequiresPrescription(Boolean(medicine.prescription_required));
    setMedicinePrice(String(medicine.price));
    setMedicineInStock(Boolean(medicine.in_stock));
  };

  const handleDeleteMedicine = async (id) => {
    if (!window.confirm("Delete this medicine?")) return;
    try {
      setError("");
      setMessage("");
      await api.delete(`/medicines/${id}/`);
      setMessage("✓ Medicine deleted.");
      setTimeout(() => setMessage(""), 3000);
      if (medicineId === id) {
        resetMedicineForm();
      }
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to delete medicine.");
    }
  };

  const managedMedicines = medicines.filter(
    (medicine) => String(medicine.shop) === String(selectedShopId)
  );
  const locationMode = isLocating
    ? "locating"
    : isLiveTracking && locationSource === "gps"
      ? "gps-live"
      : locationSource === "gps"
        ? "gps-current"
        : locationSource === "ip"
          ? "approximate"
          : "off";
  const locationModeLabel =
    locationMode === "gps-live"
      ? "GPS live mode"
      : locationMode === "gps-current"
        ? "GPS current mode"
        : locationMode === "approximate"
          ? "Approximate mode"
          : locationMode === "locating"
            ? "Locating"
            : "Location off";
  const copyStatusClass =
    copyStatus === "Copied"
      ? "is-success"
      : copyStatus === "Copy failed"
        ? "is-error"
        : "is-info";

  return (
    <div className="page">
      <div className="page-header">
        <h1>🏪 Store Management</h1>
        <p>Manage your shop and medicines inventory</p>
      </div>

      <div className={`location-banner location-banner-${locationMode}`}>
        <div className="location-banner-copy">
          <strong>{`Location mode: ${locationModeLabel}`}</strong>
          <span>
            {error && error.toLowerCase().includes("location")
              ? error
              : latitude && longitude
                ? `Lat ${Number(latitude).toFixed(5)}, Lng ${Number(longitude).toFixed(5)}${locationSource === "ip" ? " • Approximate" : ""}`
                : "Use current/live location to auto-fill shop latitude and longitude."}
          </span>
        </div>
        <div className="location-banner-actions">
          <button
            type="button"
            className="btn-copy-coords"
            onClick={copyCoordinates}
            disabled={!latitude || !longitude}
          >
            {copyStatus === "Copied" ? "Copied" : "Copy coordinates"}
          </button>
          {copyStatus && (
            <span className={`location-copy-status ${copyStatusClass}`} aria-live="polite">
              {copyStatus}
            </span>
          )}
          <a className="location-banner-link" href={LOCATION_HELP_URL} target="_blank" rel="noreferrer">
            Open browser location settings help
          </a>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      {/* CREATE SHOP SECTION */}
      <section className="shop-section">
        <h2>Register New Shop</h2>
        <form onSubmit={createShop} className="shop-form">
          <div className="form-row">
            <div className="form-group-full">
              <label>Shop Name</label>
              <input
                type="text"
                placeholder="Enter shop name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group-full">
              <label>Area / Location</label>
              <input
                type="text"
                placeholder="Enter area name"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                required
              />
            </div>

            <div className="form-group-full">
              <label>State</label>
              <input
                type="text"
                placeholder="Enter state name"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              />
            </div>

            <div className="form-group-full">
              <label>GST Number (optional)</label>
              <input
                type="text"
                placeholder="e.g. 27ABCDE1234F1Z5"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
              />
            </div>

            <div className="form-group-full">
              <label>PAN Number (optional)</label>
              <input
                type="text"
                placeholder="e.g. ABCDE1234F"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value)}
              />
            </div>

            <div className="form-group-full">
              <label>Bank Account Name (optional)</label>
              <input
                type="text"
                placeholder="Account holder name"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
              />
            </div>

            <div className="form-group-full">
              <label>Bank Account Number (optional)</label>
              <input
                type="text"
                placeholder="Account number"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
              />
            </div>

            <div className="form-group-full">
              <label>IFSC Code (optional)</label>
              <input
                type="text"
                placeholder="e.g. HDFC0001234"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
              />
            </div>

            <div className="form-group-full">
              <label>Shop Latitude</label>
              <input
                type="number"
                placeholder="e.g. 19.076000"
                step="0.000001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>

            <div className="form-group-full">
              <label>Shop Longitude</label>
              <input
                type="number"
                placeholder="e.g. 72.877700"
                step="0.000001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>

            <div className="form-group-full">
              <button
                type="button"
                className="btn-action btn-location"
                onClick={useMyCurrentLocation}
                disabled={isLocating}
              >
                {isLocating ? "Locating..." : "Use My Current Location"}
              </button>
              {!isLiveTracking ? (
                <button
                  type="button"
                  className="btn-action btn-location"
                  onClick={startLiveLocation}
                  disabled={isLocating}
                >
                  Start Live Location
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-action btn-location"
                  onClick={stopLiveLocation}
                >
                  Stop Live Location
                </button>
              )}
              <p className="location-hint">{locationHint}</p>
            </div>

          </div>

          <button type="submit" className="btn-action btn-add-cart" style={{width: '100%'}}>
            ✓ Register Shop
          </button>
        </form>
      </section>

      {/* YOUR SHOPS SECTION */}
      {shops.length > 0 && (
        <section className="shop-section">
          <h2>Your Shops ({shops.length})</h2>
          <div className="medicine-grid">
            {shops.map((shop) => (
              <div 
                className={`shop-card ${String(shop.id) === selectedShopId ? 'active' : ''}`}
                key={shop.id}
                onClick={() => setSelectedShopId(String(shop.id))}
              >
                <div className="shop-header">
                  <h3>{shop.name}</h3>
                  <div className="shop-rating">⭐ {shop.rating}</div>
                </div>
                <p className="shop-area">📍 {shop.area}</p>
                <p className="shop-area">🗺️ {shop.state || "State not added"}</p>
                <p className="shop-area">🧾 GST: {shop.gst_number || "Not provided"}</p>
                <p className="shop-area">🪪 PAN: {shop.pan_number || "Not provided"}</p>
                <p className="shop-area">🏦 KYC: {shop.is_kyc_verified ? "Verified" : "Pending"}</p>
                {shop.latitude && shop.longitude && (
                  <p className="shop-area">🧭 {Number(shop.latitude).toFixed(4)}, {Number(shop.longitude).toFixed(4)}</p>
                )}
                <div className="shop-badge">
                  {String(shop.id) === selectedShopId ? "✓ Selected" : "Click to Select"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MEDICINE INVENTORY SECTION */}
      {shops.length > 0 && (
        <section className="shop-section">
          <h2>Medicine Inventory</h2>
          <div className="inventory-info">
            <p>Managing as: <strong>{currentUser ? currentUser.username : "-"}</strong></p>
            {selectedShopId && (
              <p>Selected Shop: <strong>{shops.find(s => String(s.id) === selectedShopId)?.name}</strong></p>
            )}
          </div>

          <form onSubmit={createOrUpdateMedicine} className="medicine-form">
            <div className="form-row">
              <div className="form-group-full">
                <label>Medicine Name</label>
                <input
                  type="text"
                  placeholder="Enter medicine name"
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-full">
                <label>Price (₹)</label>
                <input
                  type="number"
                  placeholder="Enter price"
                  min="0"
                  step="0.01"
                  value={medicinePrice}
                  onChange={(e) => setMedicinePrice(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-full">
                <label>Brand</label>
                <input
                  type="text"
                  placeholder="Enter brand"
                  value={medicineBrand}
                  onChange={(e) => setMedicineBrand(e.target.value)}
                />
              </div>

              <div className="form-group-full">
                <label>Category</label>
                <input
                  type="text"
                  placeholder="e.g. Pain Relief"
                  value={medicineCategory}
                  onChange={(e) => setMedicineCategory(e.target.value)}
                />
              </div>

              <div className="form-group-full">
                <label>Composition</label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 650mg"
                  value={medicineComposition}
                  onChange={(e) => setMedicineComposition(e.target.value)}
                />
              </div>

              <div className="form-group-full">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="Short product description"
                  value={medicineDescription}
                  onChange={(e) => setMedicineDescription(e.target.value)}
                />
              </div>

              <div className="form-group-full">
                <label>
                  <input
                    type="checkbox"
                    checked={medicineInStock}
                    onChange={(e) => setMedicineInStock(e.target.checked)}
                  />
                  <span style={{marginLeft: '8px'}}>In Stock</span>
                </label>
              </div>

              <div className="form-group-full">
                <label>
                  <input
                    type="checkbox"
                    checked={medicineRequiresPrescription}
                    onChange={(e) => setMedicineRequiresPrescription(e.target.checked)}
                  />
                  <span style={{marginLeft: '8px'}}>Prescription Required</span>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-action btn-add-cart">
                {medicineId ? "📝 Update Medicine" : "✓ Add Medicine"}
              </button>
              {medicineId && (
                <button type="button" onClick={resetMedicineForm} className="btn-action btn-edit">
                  ✕ Cancel
                </button>
              )}
            </div>
          </form>

          {/* MEDICINES LIST */}
          {selectedShopId ? (
            managedMedicines.length > 0 ? (
              <>
                <h3 style={{marginTop: '30px', marginBottom: '20px'}}>
                  Medicines in Selected Shop ({managedMedicines.length})
                </h3>
                <div className="medicine-grid">
                  {managedMedicines.map((medicine) => (
                    <MedicineCard
                      key={medicine.id}
                      medicine={medicine}
                      onEdit={handleEditMedicine}
                      onDelete={handleDeleteMedicine}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state" style={{marginTop: '30px'}}>
                <div className="empty-icon">💊</div>
                <h3>No medicines yet</h3>
                <p>Add your first medicine using the form above</p>
              </div>
            )
          ) : (
            <div className="empty-state" style={{marginTop: '30px'}}>
              <div className="empty-icon">🏪</div>
              <h3>Select a shop</h3>
              <p>Click on a shop above to manage its medicines</p>
            </div>
          )}
        </section>
      )}

      {shops.length === 0 && !error && (
        <div className="empty-state" style={{marginTop: '40px'}}>
          <div className="empty-icon">🏪</div>
          <h3>No shops yet</h3>
          <p>Create your first shop using the form above</p>
        </div>
      )}
    </div>
  );
}
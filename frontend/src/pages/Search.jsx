import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, getAuthToken } from "../api";
import MedicineCard from "../components/MedicineCard";

const HIDDEN_NEARBY_RANGE_KM = 20;

const QUICK_SEARCHES = [
  "Paracetamol",
  "Vitamin C",
  "Cough Syrup",
  "BP Monitor",
  "Hand Sanitizer",
  "Nebulizer",
];

const LOCATION_HELP_URL = "https://support.microsoft.com/en-us/microsoft-edge/website-wants-to-use-your-location-in-microsoft-edge-24facc98-4866-4584-9ca2-7a1f262f4eec";

export default function Search() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const watchIdRef = useRef(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [meds, setMeds] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);
  const [locationSource, setLocationSource] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

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
      setUserLocation({ latitude: lat, longitude: lng, accuracy: null });
      setLocationSource("ip");
      setLastLocationUpdate(new Date());
      setLocationError("Using approximate location from network. Enable location permission for accurate live GPS.");
      return true;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    const prefill = (searchParams.get("q") || "").trim();
    setQuery(prefill);
    search(1, prefill);
  }, [searchParams]);

  useEffect(() => {
    if (page > 1) {
      search(page);
    }
  }, [page, sort, category, brand, minPrice, maxPrice, minRating]);

  useEffect(() => {
    if (!userLocation) {
      return;
    }

    const timeout = setTimeout(() => {
      search(1);
    }, 350);

    return () => clearTimeout(timeout);
  }, [userLocation?.latitude, userLocation?.longitude, nearbyOnly]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await api.get("/medicines/suggestions/", { params: { q: trimmed } });
        setSuggestions(res.data || []);
      } catch (err) {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  const stopLiveLocation = () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsLiveTracking(false);
  };

  const updateLocationState = (position) => {
    setUserLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    });
    setLocationSource("gps");
    setLastLocationUpdate(new Date());
    setLocationError("");
  };

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location services are not supported by this browser. Trying network-based location...");
      fallbackLocationFromIp();
      return;
    }

    if (!window.isSecureContext) {
      setLocationError("Location needs a secure context (HTTPS or localhost). Trying network-based location...");
      fallbackLocationFromIp();
      return;
    }

    setIsLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocationState(position);
        setIsLocating(false);
      },
      (geoError) => {
        let message = "Unable to access your current location.";
        if (geoError.code === 1) message = "Location permission denied. Allow location access and try again.";
        if (geoError.code === 2) message = "Location is unavailable right now. Please check GPS/network and retry.";
        if (geoError.code === 3) message = "Location request timed out. Please retry.";
        setLocationError(message);
        setIsLocating(false);
        fallbackLocationFromIp();
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const startLiveLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location services are not supported by this browser. Trying network-based location...");
      fallbackLocationFromIp();
      return;
    }

    if (!window.isSecureContext) {
      setLocationError("Live location needs a secure context (HTTPS or localhost). Trying network-based location...");
      fallbackLocationFromIp();
      return;
    }

    stopLiveLocation();
    setLocationError("");
    setIsLocating(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        updateLocationState(position);
        setIsLocating(false);
        setIsLiveTracking(true);
      },
      (geoError) => {
        let message = "Unable to start live location tracking.";
        if (geoError.code === 1) message = "Location permission denied. Allow location access and try again.";
        if (geoError.code === 2) message = "Live location is currently unavailable. Check GPS/network.";
        if (geoError.code === 3) message = "Live location timed out. Please retry.";
        setLocationError(message);
        setIsLocating(false);
        setIsLiveTracking(false);
        fallbackLocationFromIp();
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const copyCoordinates = async () => {
    if (!userLocation) {
      setCopyStatus("No coordinates to copy");
      setTimeout(() => setCopyStatus(""), 2500);
      return;
    }

    const text = `${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied");
      setTimeout(() => setCopyStatus(""), 1000);
    } catch (err) {
      setCopyStatus("Copy failed");
      setTimeout(() => setCopyStatus(""), 2500);
    }
  };

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          if (status.state === "denied") {
            setLocationError("Location permission is blocked in browser settings. Using network-based location when available.");
          }
        })
        .catch(() => {
          // Ignore permission API failures.
        });
    }
    requestCurrentLocation();
    return () => stopLiveLocation();
  }, []);

  const search = async (newPage = 1, forcedQuery = null, locationOverride = null) => {
    if (!getAuthToken()) {
      setError("Please login first.");
      setMeds([]);
      setAllMatches([]);
      return;
    }

    try {
      setError("");
      setMessage("");
      const activeQuery = (forcedQuery ?? query).trim();
      const params = { page: newPage };
      const activeLocation = locationOverride ?? userLocation;
      if (activeQuery) {
        params.q = activeQuery;
      }
      if (sort) params.sort = sort;
      if (activeLocation) {
        params.near_lat = activeLocation.latitude;
        params.near_lng = activeLocation.longitude;
        if (nearbyOnly) {
          params.radius_km = HIDDEN_NEARBY_RANGE_KM;
        }
        if (!sort) {
          params.sort = "distance_asc";
        }
      }
      if (category.trim()) params.category = category.trim();
      if (brand.trim()) params.brand = brand.trim();
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (minRating) params.min_rating = minRating;
      const res = await api.get("/medicines/", { params });

      const summaryRes = await api.get("/medicines/", {
        params: {
          q: activeQuery || undefined,
          sort: sort || undefined,
          near_lat: activeLocation ? activeLocation.latitude : undefined,
          near_lng: activeLocation ? activeLocation.longitude : undefined,
          radius_km: activeLocation && nearbyOnly ? HIDDEN_NEARBY_RANGE_KM : undefined,
          category: category.trim() || undefined,
          brand: brand.trim() || undefined,
          min_price: minPrice || undefined,
          max_price: maxPrice || undefined,
          min_rating: minRating || undefined,
          page_size: 50,
        },
      });
      
      const medicines = res.data.results || res.data;
      const summaryMedicines = summaryRes.data.results || summaryRes.data;
      const total = res.data.count ? Math.ceil(res.data.count / 8) : 1;
      
      setMeds(medicines);
      setAllMatches(summaryMedicines);
      setTotalPages(total);
      setPage(newPage);
    } catch (err) {
      setError("Unable to fetch medicines. Please login and try again.");
      setMeds([]);
      setAllMatches([]);
    }
  };

  const launchQuickSearch = (term) => {
    setQuery(term);
    setPage(1);
    search(1, term);
  };

  const addToCart = async (medicineId) => {
    try {
      setError("");
      await api.post("/cart/", { medicine: medicineId, quantity: 1 });
      setMessage("✓ Added to cart successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to add to cart.");
      throw err;
    }
  };

  const buyNow = async (medicineId) => {
    try {
      await addToCart(medicineId);
      navigate("/cart");
    } catch (err) {
      // addToCart already sets the error message
    }
  };

  const addToWishlist = async (medicineId) => {
    try {
      await api.post("/wishlist/", { medicine: medicineId });
      setMessage("Saved to wishlist.");
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to save wishlist.");
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    search(1);
  };

  const normalizedQuery = query.trim().toLowerCase();
  const medicineNamedMatches = normalizedQuery
    ? allMatches.filter((m) => (m.name || "").toLowerCase().includes(normalizedQuery))
    : allMatches;
  const uniqueShopIds = new Set(medicineNamedMatches.map((m) => m.shop));
  const visibleMeds = meds;
  const locationMode = isLocating
    ? "locating"
    : isLiveTracking && locationSource === "gps"
      ? "gps-live"
      : userLocation && locationSource === "gps"
        ? "gps-current"
        : userLocation && locationSource === "ip"
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
      <section className="search-hero">
        <div className="page-header">
          <h1>🔍 Discover Medicines</h1>
          <p>Browse and order quality medicines</p>
        </div>

        <form onSubmit={handleSearch} className="search-container">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search medicine, shop, area, or state"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
              list="medicine-suggestions"
            />
            <datalist id="medicine-suggestions">
              {suggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <button type="submit" className="btn-search" aria-label="Search medicines">
              🔍
            </button>
          </div>
        </form>

        <div className="filters-row">
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            <option value="">Sort: Relevance</option>
            <option value="distance_asc">Distance: Near to Far</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating_desc">Rating: High to Low</option>
            <option value="name_asc">Name: A to Z</option>
          </select>
          <input type="text" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <input type="text" placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <input type="number" placeholder="Min Price" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <input type="number" placeholder="Max Price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
            <option value="">Any rating</option>
            <option value="3">3+ rating</option>
            <option value="4">4+ rating</option>
            <option value="4.5">4.5+ rating</option>
          </select>
          <button type="button" onClick={() => search(1)} className="btn-action btn-add-cart">Apply</button>
        </div>

        <div className={`location-banner location-banner-${locationMode}`}>
          <div className="location-banner-copy">
            <strong>{`Location mode: ${locationModeLabel}`}</strong>
            <span>
              {locationError
                ? locationError
                : userLocation
                  ? `Lat ${userLocation.latitude.toFixed(5)}, Lng ${userLocation.longitude.toFixed(5)}${userLocation.accuracy ? ` • ±${Math.round(userLocation.accuracy)}m` : ""}`
                  : "Enable location to get accurate nearby sorting and route directions."}
            </span>
          </div>
          <div className="location-banner-actions">
            <button
              type="button"
              className="btn-copy-coords"
              onClick={copyCoordinates}
              disabled={!userLocation}
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

        <div className="search-tools">
          <div className="search-chip-row">
            {QUICK_SEARCHES.map((term) => (
              <button key={term} type="button" className="search-chip" onClick={() => launchQuickSearch(term)}>
                {term}
              </button>
            ))}
          </div>
          <div className="search-meta-row">
            <span>{[sort, category, brand, minPrice, maxPrice, minRating].filter(Boolean).length} filters active</span>
            <span>
              {userLocation
                ? `Location active${isLiveTracking ? " (live)" : ""}${locationSource === "ip" ? " (approximate)" : ""}${nearbyOnly ? ` • Nearby only within ${HIDDEN_NEARBY_RANGE_KM} km` : ""}`
                : "Location not shared"}
            </span>
          </div>
          <div className="search-meta-row">
            <button
              type="button"
              className="btn-location"
              onClick={requestCurrentLocation}
              disabled={isLocating}
            >
              {isLocating ? "Getting location..." : "Use my current location"}
            </button>
            {!isLiveTracking ? (
              <button type="button" className="btn-location" onClick={startLiveLocation}>
                Start live location
              </button>
            ) : (
              <button type="button" className="btn-location" onClick={stopLiveLocation}>
                Stop live location
              </button>
            )}
            <button
              type="button"
              className="btn-location"
              onClick={() => setNearbyOnly((prev) => !prev)}
              disabled={!userLocation}
            >
              {nearbyOnly ? "Showing nearby only" : "Show all distances"}
            </button>
          </div>
          {locationError && <div className="location-hint">{locationError}</div>}
          {!locationError && userLocation && (
            <div className="location-hint">
              {`Lat ${userLocation.latitude.toFixed(5)}, Lng ${userLocation.longitude.toFixed(5)}${locationSource === "ip" ? " • Approximate" : ""}${userLocation.accuracy ? ` • ±${Math.round(userLocation.accuracy)}m` : ""}${lastLocationUpdate ? ` • Updated ${lastLocationUpdate.toLocaleTimeString()}` : ""}`}
            </div>
          )}
        </div>

      </section>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      {meds.length > 0 ? (
        <>
          <div className="results-info">
            Found {visibleMeds.length} medicine(s) • Page {page} of {totalPages}
          </div>

          <div className="results-info results-info-highlight">
            {uniqueShopIds.size} registered shop(s) have this medicine in current search results
            {userLocation && nearbyOnly ? ` within ${HIDDEN_NEARBY_RANGE_KM} km nearby coverage` : ""}
          </div>

          <div className="medicine-grid">
            {visibleMeds.map((m) => (
              <MedicineCard 
                key={m.id}
                medicine={m}
                onAddToCart={addToCart}
                onBuy={buyNow}
                onAddToWishlist={addToWishlist}
                userLocation={userLocation}
              />
            ))}
          </div>

          {visibleMeds.length === 0 && userLocation && nearbyOnly && (
            <div className="results-info results-info-highlight">
              No nearby registered shops found within {HIDDEN_NEARBY_RANGE_KM} km for this search.
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination-row">
              <button 
                onClick={() => search(page - 1)} 
                disabled={page === 1}
                className="btn-pagination"
              >
                ← Previous
              </button>
              
              <div className="pagination-info">
                Page {page} of {totalPages}
              </div>
              
              <button 
                onClick={() => search(page + 1)} 
                disabled={page === totalPages}
                className="btn-pagination"
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        !error && (
          <div className="empty-state">
            <div className="empty-icon">💊</div>
            <h3>No medicines found</h3>
            <p>Try searching for different medicine names</p>
          </div>
        )
      )}
    </div>
  );
}
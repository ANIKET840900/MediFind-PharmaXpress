import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, getAuthToken } from "../api";
import MedicineCard from "../components/MedicineCard";
import LocationMapModal from "../components/LocationMapModal";

const HIDDEN_NEARBY_RANGE_KM = 20;

const QUICK_SEARCHES = [
  "Paracetamol",
  "Vitamin C",
  "Cough Syrup",
  "BP Monitor",
  "Hand Sanitizer",
  "Nebulizer",
];

const GEO_OPTIONS_HIGH_ACCURACY = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};
const GEO_OPTIONS_BALANCED = {
  enableHighAccuracy: false,
  timeout: 30000,
  maximumAge: 15000,
};

function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

  function haversineKm(lat1, lon1, lat2, lon2) {
    return distanceMeters(lat1, lon1, lat2, lon2) / 1000;
  }

function pickAreaName(address = {}) {
  return (
    address.suburb ||
    address.neighbourhood ||
    address.city_district ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.city ||
    ""
  );
}

function normalizeLocationDetails(details = {}) {
  const safe = {
    area: details.area || "",
    district: details.district || "",
    state: details.state || "",
    country: details.country || "",
  };
  const segments = [
    safe.area ? `Area: ${safe.area}` : "",
    safe.district ? `District: ${safe.district}` : "",
    safe.state ? `State: ${safe.state}` : "",
    safe.country ? `Country: ${safe.country}` : "",
  ].filter(Boolean);
  return { ...safe, label: segments.join(" • ") };
}

export default function Search() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const watchIdRef = useRef(null);
  const triedBalancedLiveRef = useRef(false);
  const lastResolvedLocationRef = useRef({ lat: null, lng: null, at: 0 });
  const isResolvingPlaceRef = useRef(false);
  const requestCurrentLocationRef = useRef(null);
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
  const [price, setPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);
  const [locationSource, setLocationSource] = useState("");
  const [locationDetails, setLocationDetails] = useState(() => normalizeLocationDetails());
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  const resolvePlaceFromCoordinates = async (lat, lng, { force = false } = {}) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const previous = lastResolvedLocationRef.current;
    const movedMeters =
      previous.lat == null || previous.lng == null
        ? Infinity
        : distanceMeters(previous.lat, previous.lng, lat, lng);
    const ageMs = Date.now() - (previous.at || 0);
    const shouldRefresh = force || previous.lat == null || movedMeters > 45 || ageMs > 45000;

    if (!shouldRefresh || isResolvingPlaceRef.current) {
      return;
    }

    isResolvingPlaceRef.current = true;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          "Accept-Language": "en",
        },
      });

      if (!response.ok) {
        throw new Error("reverse geocoding unavailable");
      }

      const payload = await response.json();
      const address = payload.address || {};
      const normalized = normalizeLocationDetails({
        area: pickAreaName(address),
        district: address.county || address.state_district || address.district || "",
        state: address.state || address.region || "",
        country: address.country || "",
      });
      if (normalized.label) {
        setLocationDetails(normalized);
      }
      lastResolvedLocationRef.current = { lat, lng, at: Date.now() };
    } catch (err) {
      // Keep last resolved place if reverse geocoding fails.
    } finally {
      isResolvingPlaceRef.current = false;
    }
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
      setUserLocation({ latitude: lat, longitude: lng, accuracy: null });
      setLocationSource("ip");
      setLocationDetails(
        normalizeLocationDetails({
          area: data.city || "",
          district: data.region || "",
          state: data.region || "",
          country: data.country_name || data.country || "",
        })
      );
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
  }, [page, sort, category, brand, price, minRating]);

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
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    setUserLocation({
      latitude,
      longitude,
      accuracy: position.coords.accuracy,
    });
    setLocationSource("gps");
    setLastLocationUpdate(new Date());
    setLocationError("");
    resolvePlaceFromCoordinates(latitude, longitude);
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
        if (geoError.code !== 1) {
          navigator.geolocation.getCurrentPosition(
            (balancedPosition) => {
              updateLocationState(balancedPosition);
              setLocationError("Using balanced GPS mode for more stable location updates.");
              setIsLocating(false);
            },
            () => {
              let message = "Unable to access your current location.";
              if (geoError.code === 1) message = "Location permission denied. Allow location access and try again.";
              if (geoError.code === 2) message = "Location is unavailable right now. Please check GPS/network and retry.";
              if (geoError.code === 3) message = "Location request timed out. Please retry.";
              setLocationError(message);
              setIsLocating(false);
              fallbackLocationFromIp();
            },
            GEO_OPTIONS_BALANCED
          );
          return;
        }

        let message = "Unable to access your current location.";
        if (geoError.code === 1) message = "Location permission denied. Allow location access and try again.";
        if (geoError.code === 2) message = "Location is unavailable right now. Please check GPS/network and retry.";
        if (geoError.code === 3) message = "Location request timed out. Please retry.";
        setLocationError(message);
        setIsLocating(false);
        fallbackLocationFromIp();
      },
      GEO_OPTIONS_HIGH_ACCURACY
    );
  };

  requestCurrentLocationRef.current = requestCurrentLocation;

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

    const onLiveLocationSuccess = (position) => {
      updateLocationState(position);
      setIsLocating(false);
      setIsLiveTracking(true);
      triedBalancedLiveRef.current = false;
    };

    const onLiveLocationError = (geoError) => {
      if ((geoError.code === 2 || geoError.code === 3) && !triedBalancedLiveRef.current) {
        triedBalancedLiveRef.current = true;
        setLocationError("Live location is unstable. Switching to balanced GPS mode...");
        if (watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = navigator.geolocation.watchPosition(
          onLiveLocationSuccess,
          onLiveLocationError,
          GEO_OPTIONS_BALANCED
        );
        return;
      }

      let message = "Unable to start live location tracking.";
      if (geoError.code === 1) message = "Location permission denied. Allow location access and try again.";
      if (geoError.code === 2) message = "Live location is currently unavailable. Check GPS/network.";
      if (geoError.code === 3) message = "Live location timed out. Please retry.";
      setLocationError(message);
      setIsLocating(false);
      setIsLiveTracking(false);
      triedBalancedLiveRef.current = false;
      fallbackLocationFromIp();
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onLiveLocationSuccess,
      onLiveLocationError,
      GEO_OPTIONS_HIGH_ACCURACY
    );
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

  useEffect(() => {
    if (!userLocation && !isLiveTracking) {
      return;
    }

    const refreshTimer = window.setInterval(() => {
      if (typeof requestCurrentLocationRef.current === "function") {
        requestCurrentLocationRef.current();
      }
    }, 60000);

    return () => window.clearInterval(refreshTimer);
  }, [userLocation?.latitude, userLocation?.longitude, isLiveTracking]);

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
      if (price) params.max_price = price;
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
          max_price: price || undefined,
          min_rating: minRating || undefined,
          page_size: 300,
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

  const openMapModal = () => {
    if (userLocation) {
      setIsMapModalOpen(true);
    } else {
      setLocationError("Please enable location to view the map.");
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const medicineNamedMatches = normalizedQuery
    ? allMatches.filter((m) => (m.name || "").toLowerCase().includes(normalizedQuery))
    : allMatches;
  const uniqueShopIds = new Set(medicineNamedMatches.map((m) => m.shop));
  const visibleMeds = meds;
  const nearestShops = userLocation
    ? Object.values(
        allMatches.reduce((acc, medicine) => {
          const shopKey = String(medicine.shop || medicine.shop_name || "");
          if (!shopKey) {
            return acc;
          }

          const hasCoords =
            Number.isFinite(medicine.shop_latitude) && Number.isFinite(medicine.shop_longitude);
          const distanceFromMedicine = Number.isFinite(medicine.distance_km)
            ? Number(medicine.distance_km)
            : Number.isFinite(medicine.distanceKm)
              ? Number(medicine.distanceKm)
              : null;
          const computedDistance = hasCoords
            ? haversineKm(
                userLocation.latitude,
                userLocation.longitude,
                Number(medicine.shop_latitude),
                Number(medicine.shop_longitude)
              )
            : null;
          const distanceKm = distanceFromMedicine ?? computedDistance;

          if (!Number.isFinite(distanceKm)) {
            return acc;
          }

          const current = acc[shopKey];
          if (!current || distanceKm < current.distanceKm) {
            acc[shopKey] = {
              id: medicine.shop,
              name: medicine.shop_name || "Medical Shop",
              area: medicine.shop_area || "Area unavailable",
              state: medicine.shop_state || "State unavailable",
              latitude: hasCoords ? Number(medicine.shop_latitude) : null,
              longitude: hasCoords ? Number(medicine.shop_longitude) : null,
              distanceKm,
              topMedicineName: medicine.name || "",
              photoUrl:
                medicine.image_url ||
                `https://picsum.photos/seed/shop-${encodeURIComponent(`${medicine.shop_name || "medical-shop"}-${medicine.shop || "0"}`)}/500/280`,
            };
          }

          return acc;
        }, {})
      )
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, nearbyOnly ? undefined : 8)
    : [];
  const shouldShowNearestShops = Boolean(userLocation) && nearestShops.length > 0;
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
      const locationText = locationDetails.label
        ? locationDetails.label
        : userLocation
          ? `Lat ${userLocation.latitude.toFixed(5)}, Lng ${userLocation.longitude.toFixed(5)}`
          : "Enable location to get accurate nearby sorting and route directions.";
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
          <input type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
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
                  ? `${locationText}${userLocation.accuracy ? ` • ±${Math.round(userLocation.accuracy)}m` : ""}`
                  : locationText}
            </span>
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
            <span>{[sort, category, brand, price, minRating].filter(Boolean).length} filters active</span>
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
              <>
                <button type="button" className="btn-location" onClick={stopLiveLocation}>
                  Stop live location
                </button>
                <button type="button" className="btn-location" onClick={openMapModal} disabled={!userLocation}>
                  📍 View Map
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-location"
              onClick={() => setNearbyOnly((prev) => !prev)}
              disabled={!userLocation}
            >
              {nearbyOnly ? `Nearby only ON (${HIDDEN_NEARBY_RANGE_KM} km)` : "Show nearby only"}
            </button>
          </div>
          {locationError && <div className="location-hint">{locationError}</div>}
          {!locationError && userLocation && (
            <div className="location-hint">
              {`${locationDetails.label || `Lat ${userLocation.latitude.toFixed(5)}, Lng ${userLocation.longitude.toFixed(5)}`}${locationSource === "ip" ? " • Approximate" : ""}${userLocation.accuracy ? ` • ±${Math.round(userLocation.accuracy)}m` : ""}${lastLocationUpdate ? ` • Updated ${lastLocationUpdate.toLocaleTimeString()}` : ""}`}
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

          {shouldShowNearestShops && (
            <>
              <div className="results-info results-info-highlight">
                {`Nearest medical shops ${isLiveTracking ? "with live location" : "with current location"} (${nearestShops.length})${nearbyOnly ? ` • within ${HIDDEN_NEARBY_RANGE_KM} km` : ""}`}
              </div>
              <div className="medicine-grid">
                {nearestShops.map((shop) => (
                  <article
                    key={String(shop.id || shop.name)}
                    className="shop-card"
                    onClick={() => launchQuickSearch(shop.name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        launchQuickSearch(shop.name);
                      }
                    }}
                  >
                    <img className="medicine-thumb" src={shop.photoUrl} alt={shop.name} loading="lazy" />
                    <div className="shop-header">
                      <h3>{shop.name}</h3>
                      <div className="shop-rating">{shop.distanceKm.toFixed(2)} km</div>
                    </div>
                    <p className="shop-area">📍 {shop.area}</p>
                    <p className="shop-area">🗺️ {shop.state}</p>
                    {shop.topMedicineName && <p className="shop-area">💊 {shop.topMedicineName}</p>}
                    {shop.latitude != null && shop.longitude != null && userLocation && (
                      <a
                        className="btn-action btn-secondary"
                        href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                          `${userLocation.latitude},${userLocation.longitude}`
                        )}&destination=${encodeURIComponent(
                          `${shop.latitude},${shop.longitude}`
                        )}&travelmode=driving`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Open in Google Maps
                      </a>
                    )}
                    <div className="shop-badge">Tap to search this shop</div>
                  </article>
                ))}
              </div>
            </>
          )}

          {nearbyOnly && userLocation && !shouldShowNearestShops && (
            <div className="results-info results-info-highlight">
              No nearby medical shops found within {HIDDEN_NEARBY_RANGE_KM} km for this medicine search.
            </div>
          )}

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

      <LocationMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        userLocation={userLocation}
        nearbyShops={nearestShops}
      />
    </div>
  );
}
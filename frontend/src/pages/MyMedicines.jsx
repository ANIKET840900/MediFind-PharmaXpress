import { useEffect, useState } from "react";
import { api, getAuthToken } from "../api";
import MedicineCard from "../components/MedicineCard";

export default function MyMedicines() {
  const [medicines, setMedicines] = useState([]);
  const [shops, setShops] = useState([]);
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [shopFilter, setShopFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editInStock, setEditInStock] = useState(true);

  const loadShops = async () => {
    try {
      const res = await api.get("/shops/?mine=1");
      setShops(res.data);
    } catch (err) {
      setError("Unable to load your shops.");
    }
  };

  const loadMedicines = async () => {
    if (!getAuthToken()) {
      setError("Please login to access My Medicines.");
      setMedicines([]);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("mine", "1");
      params.set("page", String(page));
      params.set("page_size", "8");
      if (query.trim()) {
        params.set("q", query.trim());
      }
      if (stockFilter !== "all") {
        params.set("in_stock", stockFilter);
      }
      if (shopFilter) {
        params.set("shop", shopFilter);
      }

      const res = await api.get(`/medicines/?${params.toString()}`);
      const data = res.data;
      setMedicines(data.results || []);
      setTotalCount(data.count || 0);
      const pages = Math.max(1, Math.ceil((data.count || 0) / 8));
      setTotalPages(pages);
    } catch (err) {
      setError("Unable to load medicines.");
      setMedicines([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, []);

  useEffect(() => {
    loadMedicines();
  }, [page, stockFilter, shopFilter]);

  const applySearch = () => {
    setPage(1);
    setMessage("");
    setError("");
    loadMedicines();
  };

  const clearFilters = () => {
    setQuery("");
    setStockFilter("all");
    setShopFilter("");
    setPage(1);
    setMessage("");
    setError("");
  };

  const handleEdit = (medicine) => {
    setEditingId(medicine.id);
    setEditName(medicine.name);
    setEditPrice(String(medicine.price));
    setEditInStock(Boolean(medicine.in_stock));
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
    setEditInStock(true);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      setError("");
      setMessage("");
      await api.patch(`/medicines/${editingId}/`, {
        name: editName,
        price: Number(editPrice),
        in_stock: editInStock,
      });
      setMessage("✓ Medicine updated successfully.");
      setTimeout(() => setMessage(""), 3000);
      handleCancelEdit();
      loadMedicines();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to update medicine.");
    }
  };

  const handleDelete = async (medicineId) => {
    if (!window.confirm("Are you sure you want to delete this medicine?")) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await api.delete(`/medicines/${medicineId}/`);
      setMessage("✓ Medicine deleted successfully.");
      setTimeout(() => setMessage(""), 3000);
      if (editingId === medicineId) {
        handleCancelEdit();
      }
      loadMedicines();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to delete medicine.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>💊 My Medicines</h1>
        <p>Manage your medicine inventory ({totalCount} total)</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      {/* EDIT FORM */}
      {editingId && (
        <div className="edit-form-container">
          <h2>Edit Medicine</h2>
          <div className="edit-form">
            <div className="form-row">
              <div className="form-group-full">
                <label>Medicine Name</label>
                <input
                  type="text"
                  placeholder="Enter medicine name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="form-group-full">
                <label>Price (₹)</label>
                <input
                  type="number"
                  placeholder="Enter price"
                  min="0"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>

              <div className="form-group-full">
                <label>
                  <input
                    type="checkbox"
                    checked={editInStock}
                    onChange={(e) => setEditInStock(e.target.checked)}
                  />
                  <span style={{marginLeft: '8px'}}>In Stock</span>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button onClick={handleSaveEdit} className="btn-action btn-add-cart">
                💾 Save Changes
              </button>
              <button onClick={handleCancelEdit} className="btn-action btn-edit">
                ✕ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILTERS SECTION */}
      <div className="filters-section">
        <h3>Filter & Search</h3>
        <div className="filters-row">
          <div className="search-filter">
            <input
              type="text"
              placeholder="🔍 Search by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
            <option value="all">All Stock Status</option>
            <option value="true">✓ In Stock</option>
            <option value="false">✗ Out of Stock</option>
          </select>

          <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
            <option value="">All My Shops</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>

          <button onClick={applySearch} className="btn-action btn-add-cart">
            🔍 Search
          </button>
          <button onClick={clearFilters} className="btn-action btn-secondary">
            ✕ Clear
          </button>
        </div>
      </div>

      {/* STATUS */}
      {loading && (
        <div className="loading-state">
          <div style={{fontSize: '24px'}}>⏳</div>
          <p>Loading medicines...</p>
        </div>
      )}

      {/* MEDICINES GRID */}
      {!loading && medicines.length > 0 ? (
        <>
          <div className="results-info">
            Found {medicines.length} medicine(s) • Page {page} of {totalPages}
          </div>

          <div className="medicine-grid">
            {medicines.map((medicine) => (
              <MedicineCard
                key={medicine.id}
                medicine={medicine}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="pagination-row">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-pagination"
              >
                ← Previous
              </button>
              <div className="pagination-info">
                Page {page} of {totalPages}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-pagination"
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : !loading && !error ? (
        <div className="empty-state">
          <div className="empty-icon">💊</div>
          <h3>No medicines found</h3>
          <p>Create medicines in Shop Registration page</p>
        </div>
      ) : null}
    </div>
  );
}

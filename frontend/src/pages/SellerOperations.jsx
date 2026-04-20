import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const SELLER_OPS_AUTORELOAD_KEY = "medcompare_sellerops_autorefresh";
const SELLER_OPS_EXPORT_FILTERED_KEY = "medcompare_sellerops_export_filtered_only";
const SELLER_OPS_ACTIVE_TAB_KEY = "medcompare_sellerops_active_tab";
const SELLER_OPS_FILTERS_KEY = "medcompare_sellerops_filters";
const SELLER_OPS_TABS = ["reviews", "returns", "prescriptions", "admin"];

function readBooleanPreference(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return defaultValue;
    return raw === "true";
  } catch {
    return defaultValue;
  }
}

function readTabPreference(defaultValue = "reviews") {
  try {
    const raw = localStorage.getItem(SELLER_OPS_ACTIVE_TAB_KEY);
    if (!raw) return defaultValue;
    return SELLER_OPS_TABS.includes(raw) ? raw : defaultValue;
  } catch {
    return defaultValue;
  }
}

function readSellerOpsFilters() {
  const defaults = {
    reviewStatusFilter: "all",
    reviewQuery: "",
    returnStatusFilter: "all",
    returnQuery: "",
    prescriptionStatusFilter: "all",
    prescriptionQuery: "",
    fraudRiskFilter: "all",
    fraudQuery: "",
  };

  try {
    const raw = localStorage.getItem(SELLER_OPS_FILTERS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  } catch {
    return defaults;
  }
}

const SELLER_OPS_DEFAULT_FILTERS = {
  reviewStatusFilter: "all",
  reviewQuery: "",
  returnStatusFilter: "all",
  returnQuery: "",
  prescriptionStatusFilter: "all",
  prescriptionQuery: "",
  fraudRiskFilter: "all",
  fraudQuery: "",
};

const PRIORITY_RULES = {
  review: { mediumHours: 24, highHours: 48 },
  return: { mediumHours: 24, highHours: 72 },
  prescription: { mediumHours: 8, highHours: 24 },
};

function getElapsedHours(createdAt) {
  if (!createdAt) return 0;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, (Date.now() - created) / (1000 * 60 * 60));
}

function formatElapsed(createdAt) {
  const totalMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60)));
  if (!Number.isFinite(totalMinutes)) return "0m";
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getPriorityMeta(createdAt, kind) {
  const elapsed = getElapsedHours(createdAt);
  const rules = PRIORITY_RULES[kind] || PRIORITY_RULES.review;

  if (elapsed >= rules.highHours) {
    return { tone: "high", label: "High Priority", sla: `SLA exceeded by ${formatElapsed(createdAt)}` };
  }
  if (elapsed >= rules.mediumHours) {
    return { tone: "medium", label: "Medium Priority", sla: `SLA running: ${formatElapsed(createdAt)}` };
  }
  return { tone: "low", label: "Low Priority", sla: `Fresh: ${formatElapsed(createdAt)}` };
}

function toCsv(dataRows, headers) {
  const escapeCell = (value) => {
    const raw = String(value ?? "");
    return `"${raw.replace(/"/g, '""')}"`;
  };

  const headerLine = headers.map((item) => escapeCell(item.label)).join(",");
  const rowLines = dataRows.map((row) => headers.map((item) => escapeCell(row[item.key])).join(","));
  return [headerLine, ...rowLines].join("\n");
}

function downloadCsv(fileName, csvContent) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SellerOperations() {
  const initialFilters = useMemo(() => readSellerOpsFilters(), []);
  const [reviews, setReviews] = useState([]);
  const [returns, setReturns] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [fraudEvents, setFraudEvents] = useState([]);
  const [responseDrafts, setResponseDrafts] = useState({});
  const [activeTab, setActiveTab] = useState(() => readTabPreference("reviews"));
  const [roleUsername, setRoleUsername] = useState("");
  const [roleValue, setRoleValue] = useState("seller");
  const [reviewStatusFilter, setReviewStatusFilter] = useState(initialFilters.reviewStatusFilter);
  const [reviewQuery, setReviewQuery] = useState(initialFilters.reviewQuery);
  const [returnStatusFilter, setReturnStatusFilter] = useState(initialFilters.returnStatusFilter);
  const [returnQuery, setReturnQuery] = useState(initialFilters.returnQuery);
  const [prescriptionStatusFilter, setPrescriptionStatusFilter] = useState(initialFilters.prescriptionStatusFilter);
  const [prescriptionQuery, setPrescriptionQuery] = useState(initialFilters.prescriptionQuery);
  const [returnDrafts, setReturnDrafts] = useState({});
  const [prescriptionRejectionReasons, setPrescriptionRejectionReasons] = useState({});
  const [selectedReviewIds, setSelectedReviewIds] = useState([]);
  const [selectedPrescriptionIds, setSelectedPrescriptionIds] = useState([]);
  const [bulkPrescriptionReason, setBulkPrescriptionReason] = useState("");
  const [exportFilteredOnly, setExportFilteredOnly] = useState(() =>
    readBooleanPreference(SELLER_OPS_EXPORT_FILTERED_KEY, true)
  );
  const [fraudRiskFilter, setFraudRiskFilter] = useState(initialFilters.fraudRiskFilter);
  const [fraudQuery, setFraudQuery] = useState(initialFilters.fraudQuery);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() =>
    readBooleanPreference(SELLER_OPS_AUTORELOAD_KEY, false)
  );
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [lastBulkAction, setLastBulkAction] = useState(null);
  const [undoClock, setUndoClock] = useState(Date.now());
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const queueCounts = {
    pendingReviews: reviews.filter((item) => (item.moderation_status || "pending") === "pending").length,
    openReturns: returns.filter((item) => ["requested", "approved"].includes(item.status || "requested")).length,
    prescriptionQueue: prescriptions.filter((item) => (item.status || "pending") === "pending").length,
    fraudHighRisk: fraudEvents.filter((item) => (item.risk_level || "").toLowerCase() === "high").length,
  };

  const loadData = async () => {
    try {
      setError("");
      const [reviewsRes, returnsRes, prescriptionsRes, fraudRes] = await Promise.all([
        api.get("/reviews/", { params: { mine: 1, page_size: 100 } }),
        api.get("/returns/manage/"),
        api.get("/prescriptions/", { params: { queue: 1, page_size: 100 } }),
        api.get("/fraud-events/", { params: { page_size: 100 } }),
      ]);
      setReviews(reviewsRes.data.results || []);
      setReturns(returnsRes.data || []);
      setPrescriptions(prescriptionsRes.data.results || []);
      setFraudEvents(fraudRes.data.results || []);
      setLastRefreshedAt(new Date());
    } catch (err) {
      setError("Unable to load seller operations data.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!autoRefreshEnabled) return undefined;

    const intervalId = setInterval(() => {
      loadData();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [autoRefreshEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(SELLER_OPS_AUTORELOAD_KEY, String(autoRefreshEnabled));
    } catch {
      // Ignore storage write errors in restricted environments.
    }
  }, [autoRefreshEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(SELLER_OPS_EXPORT_FILTERED_KEY, String(exportFilteredOnly));
    } catch {
      // Ignore storage write errors in restricted environments.
    }
  }, [exportFilteredOnly]);

  useEffect(() => {
    try {
      localStorage.setItem(SELLER_OPS_ACTIVE_TAB_KEY, activeTab);
    } catch {
      // Ignore storage write errors in restricted environments.
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      const payload = {
        reviewStatusFilter,
        reviewQuery,
        returnStatusFilter,
        returnQuery,
        prescriptionStatusFilter,
        prescriptionQuery,
        fraudRiskFilter,
        fraudQuery,
      };
      localStorage.setItem(SELLER_OPS_FILTERS_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage write errors in restricted environments.
    }
  }, [
    reviewStatusFilter,
    reviewQuery,
    returnStatusFilter,
    returnQuery,
    prescriptionStatusFilter,
    prescriptionQuery,
    fraudRiskFilter,
    fraudQuery,
  ]);

  useEffect(() => {
    if (!lastBulkAction) return undefined;

    const timerId = setInterval(() => {
      setUndoClock(Date.now());
    }, 1000);

    return () => clearInterval(timerId);
  }, [lastBulkAction]);

  const moderateReview = async (reviewId, action) => {
    try {
      setBusyAction(`review-${reviewId}-${action}`);
      await api.post(`/reviews/${reviewId}/moderate/`, { action });
      setMessage(`Review ${action} successfully.`);
      setTimeout(() => setMessage(""), 2000);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to moderate review.");
    } finally {
      setBusyAction("");
    }
  };

  const respondReview = async (reviewId) => {
    const response = (responseDrafts[reviewId] || "").trim();
    if (!response) {
      setError("Please type a seller response before submitting.");
      return;
    }

    try {
      setBusyAction(`review-response-${reviewId}`);
      await api.post(`/reviews/${reviewId}/respond/`, { response });
      setResponseDrafts((prev) => ({ ...prev, [reviewId]: "" }));
      setMessage("Seller response submitted.");
      setTimeout(() => setMessage(""), 2000);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to submit response.");
    } finally {
      setBusyAction("");
    }
  };

  const setReturnDraftField = (returnId, field, value) => {
    setReturnDrafts((prev) => ({
      ...prev,
      [returnId]: {
        ...(prev[returnId] || { note: "" }),
        [field]: value,
      },
    }));
  };

  const updateReturn = async (returnId, status) => {
    const draft = returnDrafts[returnId] || {};
    const note = (draft.note || "").trim();

    try {
      setBusyAction(`return-update-${returnId}-${status}`);
      await api.post(`/returns/${returnId}/manage/`, {
        status,
        note,
      });
      setMessage(`Return request marked ${status}.`);
      setTimeout(() => setMessage(""), 2000);
      setReturnDrafts((prev) => ({
        ...prev,
        [returnId]: { note: "" },
      }));
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to update return request.");
    } finally {
      setBusyAction("");
    }
  };

  const assignRole = async () => {
    if (!roleUsername.trim()) {
      setError("Username is required for role assignment.");
      return;
    }

    try {
      setBusyAction("assign-role");
      await api.post("/auth/assign-role/", {
        username: roleUsername.trim(),
        role: roleValue,
      });
      setMessage("User role updated successfully.");
      setRoleUsername("");
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to assign role.");
    } finally {
      setBusyAction("");
    }
  };

  const reviewPrescription = async (id, status) => {
    const rejection_reason = status === "rejected" ? (prescriptionRejectionReasons[id] || "").trim() : "";
    if (status === "rejected" && !rejection_reason) {
      setError("Add a rejection reason before rejecting this prescription.");
      return;
    }

    try {
      setBusyAction(`prescription-${id}-${status}`);
      await api.post(`/prescriptions/${id}/review/`, { status, rejection_reason });
      setMessage(`Prescription ${status}.`);
      setTimeout(() => setMessage(""), 2000);
      setPrescriptionRejectionReasons((prev) => ({ ...prev, [id]: "" }));
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to review prescription.");
    } finally {
      setBusyAction("");
    }
  };

  const filteredReviews = reviews.filter((review) => {
    const moderationStatus = review.moderation_status || "pending";
    const reviewText = `${review.username || ""} ${review.medicine_name || ""} ${review.title || ""} ${review.comment || ""}`.toLowerCase();
    const statusMatch = reviewStatusFilter === "all" || moderationStatus === reviewStatusFilter;
    const queryMatch = !reviewQuery.trim() || reviewText.includes(reviewQuery.trim().toLowerCase());
    return statusMatch && queryMatch;
  });

  const filteredReturns = returns.filter((request) => {
    const requestStatus = request.status || "requested";
    const requestText = `${request.reason || ""} ${request.order_tracking_id || ""} ${request.order || ""}`.toLowerCase();
    const statusMatch = returnStatusFilter === "all" || requestStatus === returnStatusFilter;
    const queryMatch = !returnQuery.trim() || requestText.includes(returnQuery.trim().toLowerCase());
    return statusMatch && queryMatch;
  });

  const filteredPrescriptions = prescriptions.filter((item) => {
    const prescriptionStatus = item.status || "pending";
    const itemText = `${item.medicine_name || ""} ${item.note || ""}`.toLowerCase();
    const statusMatch = prescriptionStatusFilter === "all" || prescriptionStatus === prescriptionStatusFilter;
    const queryMatch = !prescriptionQuery.trim() || itemText.includes(prescriptionQuery.trim().toLowerCase());
    return statusMatch && queryMatch;
  });

  const filteredFraudEvents = fraudEvents.filter((event) => {
    const risk = (event.risk_level || "").toLowerCase();
    const text = `${event.username || ""} ${event.action || ""} ${event.reason || ""} ${event.context || ""}`.toLowerCase();
    const riskMatch = fraudRiskFilter === "all" || risk === fraudRiskFilter;
    const queryMatch = !fraudQuery.trim() || text.includes(fraudQuery.trim().toLowerCase());
    return riskMatch && queryMatch;
  });

  const visiblePendingReviews = useMemo(
    () => filteredReviews.filter((item) => (item.moderation_status || "pending") === "pending"),
    [filteredReviews]
  );

  const visiblePendingPrescriptions = useMemo(
    () => filteredPrescriptions.filter((item) => (item.status || "pending") === "pending"),
    [filteredPrescriptions]
  );

  const toggleReviewSelection = (reviewId) => {
    setSelectedReviewIds((prev) => (
      prev.includes(reviewId) ? prev.filter((id) => id !== reviewId) : [...prev, reviewId]
    ));
  };

  const togglePrescriptionSelection = (prescriptionId) => {
    setSelectedPrescriptionIds((prev) => (
      prev.includes(prescriptionId) ? prev.filter((id) => id !== prescriptionId) : [...prev, prescriptionId]
    ));
  };

  const selectAllPendingReviews = () => {
    setSelectedReviewIds(visiblePendingReviews.map((item) => item.id));
  };

  const selectAllPendingPrescriptions = () => {
    setSelectedPrescriptionIds(visiblePendingPrescriptions.map((item) => item.id));
  };

  const clearReviewSelection = () => setSelectedReviewIds([]);
  const clearPrescriptionSelection = () => setSelectedPrescriptionIds([]);

  const bulkModerateReviews = async (action) => {
    if (!selectedReviewIds.length) {
      setError("Select at least one pending review for bulk action.");
      return;
    }

    try {
      setError("");
      setBusyAction(`bulk-review-${action}`);
      await Promise.all(selectedReviewIds.map((reviewId) => api.post(`/reviews/${reviewId}/moderate/`, { action })));
      setLastBulkAction({
        kind: "reviews",
        appliedAction: action,
        ids: [...selectedReviewIds],
        expiresAt: Date.now() + 30000,
      });
      setMessage(`${selectedReviewIds.length} review(s) ${action}.`);
      setTimeout(() => setMessage(""), 2500);
      clearReviewSelection();
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to complete bulk review moderation.");
    } finally {
      setBusyAction("");
    }
  };

  const bulkReviewPrescriptions = async (status) => {
    if (!selectedPrescriptionIds.length) {
      setError("Select at least one pending prescription for bulk action.");
      return;
    }

    if (status === "rejected" && !bulkPrescriptionReason.trim()) {
      setError("Provide a rejection reason for bulk reject action.");
      return;
    }

    try {
      setError("");
      setBusyAction(`bulk-prescription-${status}`);
      await Promise.all(
        selectedPrescriptionIds.map((id) => api.post(`/prescriptions/${id}/review/`, {
          status,
          rejection_reason: status === "rejected" ? bulkPrescriptionReason.trim() : "",
        }))
      );
      setLastBulkAction({
        kind: "prescriptions",
        appliedAction: status,
        ids: [...selectedPrescriptionIds],
        expiresAt: Date.now() + 30000,
      });
      setMessage(`${selectedPrescriptionIds.length} prescription(s) ${status}.`);
      setTimeout(() => setMessage(""), 2500);
      clearPrescriptionSelection();
      setBulkPrescriptionReason("");
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to complete bulk prescription action.");
    } finally {
      setBusyAction("");
    }
  };

  const exportReturnsCsv = () => {
    const source = exportFilteredOnly ? filteredReturns : returns;
    const rows = source.map((item) => ({
      id: item.id,
      order: item.order_tracking_id || item.order,
      status: item.status || "requested",
      reason: item.reason || "",
      resolution_note: item.resolution_note || "",
      created_at: item.created_at ? new Date(item.created_at).toISOString() : "",
      resolved_at: item.resolved_at ? new Date(item.resolved_at).toISOString() : "",
    }));

    const csv = toCsv(rows, [
      { key: "id", label: "Return ID" },
      { key: "order", label: "Order" },
      { key: "status", label: "Status" },
      { key: "reason", label: "Reason" },
      { key: "resolution_note", label: "Resolution Note" },
      { key: "created_at", label: "Created At" },
      { key: "resolved_at", label: "Resolved At" },
    ]);

    downloadCsv(`returns-export-${Date.now()}.csv`, csv);
    setMessage(`Returns CSV exported (${rows.length} row(s)).`);
    setTimeout(() => setMessage(""), 2000);
  };

  const exportFraudEventsCsv = () => {
    const source = exportFilteredOnly ? filteredFraudEvents : fraudEvents;
    const rows = source.map((item) => ({
      id: item.id,
      username: item.username || "",
      risk_level: item.risk_level || "",
      action: item.action || "",
      reason: item.reason || "",
      context: item.context || "",
      created_at: item.created_at ? new Date(item.created_at).toISOString() : "",
    }));

    const csv = toCsv(rows, [
      { key: "id", label: "Event ID" },
      { key: "username", label: "User" },
      { key: "risk_level", label: "Risk Level" },
      { key: "action", label: "Action" },
      { key: "reason", label: "Reason" },
      { key: "context", label: "Context" },
      { key: "created_at", label: "Created At" },
    ]);

    downloadCsv(`fraud-events-export-${Date.now()}.csv`, csv);
    setMessage(`Fraud events CSV exported (${rows.length} row(s)).`);
    setTimeout(() => setMessage(""), 2000);
  };

  const resetSavedDashboardPreferences = () => {
    try {
      localStorage.removeItem(SELLER_OPS_AUTORELOAD_KEY);
      localStorage.removeItem(SELLER_OPS_EXPORT_FILTERED_KEY);
      localStorage.removeItem(SELLER_OPS_ACTIVE_TAB_KEY);
      localStorage.removeItem(SELLER_OPS_FILTERS_KEY);
    } catch {
      // Ignore storage cleanup errors in restricted environments.
    }

    setAutoRefreshEnabled(false);
    setExportFilteredOnly(true);
    setActiveTab("reviews");

    setReviewStatusFilter(SELLER_OPS_DEFAULT_FILTERS.reviewStatusFilter);
    setReviewQuery(SELLER_OPS_DEFAULT_FILTERS.reviewQuery);
    setReturnStatusFilter(SELLER_OPS_DEFAULT_FILTERS.returnStatusFilter);
    setReturnQuery(SELLER_OPS_DEFAULT_FILTERS.returnQuery);
    setPrescriptionStatusFilter(SELLER_OPS_DEFAULT_FILTERS.prescriptionStatusFilter);
    setPrescriptionQuery(SELLER_OPS_DEFAULT_FILTERS.prescriptionQuery);
    setFraudRiskFilter(SELLER_OPS_DEFAULT_FILTERS.fraudRiskFilter);
    setFraudQuery(SELLER_OPS_DEFAULT_FILTERS.fraudQuery);

    setMessage("Dashboard preferences reset to defaults.");
    setTimeout(() => setMessage(""), 2500);
  };

  const undoSecondsRemaining = lastBulkAction
    ? Math.max(0, Math.ceil((lastBulkAction.expiresAt - undoClock) / 1000))
    : 0;

  const undoLastBulkAction = async () => {
    if (!lastBulkAction || undoSecondsRemaining <= 0) {
      setError("Undo window has expired for the last bulk action.");
      setLastBulkAction(null);
      return;
    }

    const inverseAction = lastBulkAction.appliedAction === "approved" ? "rejected" : "approved";

    try {
      setError("");
      setBusyAction("undo-bulk-action");

      if (lastBulkAction.kind === "reviews") {
        await Promise.all(lastBulkAction.ids.map((id) => api.post(`/reviews/${id}/moderate/`, { action: inverseAction })));
      } else {
        await Promise.all(lastBulkAction.ids.map((id) => api.post(`/prescriptions/${id}/review/`, {
          status: inverseAction,
          rejection_reason: inverseAction === "rejected" ? "Soft rollback of last bulk action" : "",
        })));
      }

      setMessage(`Soft rollback applied to ${lastBulkAction.ids.length} ${lastBulkAction.kind}.`);
      setTimeout(() => setMessage(""), 2500);
      setLastBulkAction(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to rollback bulk action.");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>🛠 Seller & Admin Operations</h1>
        <p>Moderate reviews, manage return decisions, and clear prescription queue faster</p>
      </div>

      <section className="seller-ops-hero">
        <div>
          <span className="market-kicker">Operations command center</span>
          <h2>Prioritize risk, resolve requests, and keep customer trust high.</h2>
          <p>Use filters and status queues below to process moderation and post-purchase workflows quickly.</p>
        </div>
        <div className="seller-ops-metrics">
          <div>
            <strong>{queueCounts.pendingReviews}</strong>
            <span>Pending reviews</span>
          </div>
          <div>
            <strong>{queueCounts.openReturns}</strong>
            <span>Open returns</span>
          </div>
          <div>
            <strong>{queueCounts.prescriptionQueue}</strong>
            <span>Pending prescriptions</span>
          </div>
          <div>
            <strong>{queueCounts.fraudHighRisk}</strong>
            <span>High-risk events</span>
          </div>
        </div>
      </section>

      <div className="seller-ops-utility-row">
        <label className="seller-ops-switch">
          <input
            type="checkbox"
            checked={autoRefreshEnabled}
            onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
          />
          <span>Auto-refresh every 30s</span>
        </label>
        <button className="btn-action btn-secondary" onClick={loadData}>Refresh now</button>
        <span className="seller-ops-last-sync">
          Last synced: {lastRefreshedAt ? lastRefreshedAt.toLocaleTimeString() : "--"}
        </span>
      </div>

      {lastBulkAction && undoSecondsRemaining > 0 && (
        <div className="seller-ops-undo-banner">
          <p>
            Last bulk action: {lastBulkAction.kind} marked {lastBulkAction.appliedAction}. You can soft rollback for {undoSecondsRemaining}s.
          </p>
          <button
            className="btn-action btn-secondary"
            disabled={busyAction === "undo-bulk-action"}
            onClick={undoLastBulkAction}
          >
            {busyAction === "undo-bulk-action" ? "Rolling back..." : "Undo last bulk action"}
          </button>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      <div className="seller-ops-tab-row">
        <button className={`btn-action ${activeTab === "reviews" ? "btn-add-cart" : "btn-secondary"}`} onClick={() => setActiveTab("reviews")}>
          Reviews Moderation
        </button>
        <button className={`btn-action ${activeTab === "returns" ? "btn-add-cart" : "btn-secondary"}`} onClick={() => setActiveTab("returns")}>
          Return Management
        </button>
        <button className={`btn-action ${activeTab === "prescriptions" ? "btn-add-cart" : "btn-secondary"}`} onClick={() => setActiveTab("prescriptions")}>
          Prescription Queue
        </button>
        <button className={`btn-action ${activeTab === "admin" ? "btn-add-cart" : "btn-secondary"}`} onClick={() => setActiveTab("admin")}>
          Admin Controls
        </button>
      </div>

      {activeTab === "reviews" && (
        <div className="orders-container">
          <div className="seller-ops-toolbar">
            <input
              type="text"
              placeholder="Search by user, medicine, title, or comment"
              value={reviewQuery}
              onChange={(e) => setReviewQuery(e.target.value)}
            />
            <select value={reviewStatusFilter} onChange={(e) => setReviewStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="seller-ops-bulk-row">
            <button className="btn-action btn-secondary" onClick={selectAllPendingReviews}>Select all pending</button>
            <button className="btn-action btn-secondary" onClick={clearReviewSelection}>Clear selection</button>
            <button
              className="btn-action btn-add-cart"
              disabled={busyAction === "bulk-review-approved"}
              onClick={() => bulkModerateReviews("approved")}
            >
              {busyAction === "bulk-review-approved" ? "Bulk approving..." : "Bulk approve"}
            </button>
            <button
              className="btn-action btn-delete"
              disabled={busyAction === "bulk-review-rejected"}
              onClick={() => bulkModerateReviews("rejected")}
            >
              {busyAction === "bulk-review-rejected" ? "Bulk rejecting..." : "Bulk reject"}
            </button>
          </div>

          <div className="results-info results-info-highlight">
            Selected reviews: {selectedReviewIds.length} • Pending in view: {visiblePendingReviews.length}
          </div>

          {filteredReviews.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⭐</div>
              <h3>No matching reviews</h3>
              <p>Adjust filters or search query to view reviews.</p>
            </div>
          ) : (
            filteredReviews.map((review) => (
              <div key={review.id} className="order-card">
                <div className="order-header">
                  <div>
                    {(review.moderation_status || "pending") === "pending" && (
                      <label className="seller-ops-select-toggle">
                        <input
                          type="checkbox"
                          checked={selectedReviewIds.includes(review.id)}
                          onChange={() => toggleReviewSelection(review.id)}
                        />
                        Select
                      </label>
                    )}
                    <div className="order-id">{review.medicine_name || "Medicine review"}</div>
                    <div className="order-date">By {review.username} • {new Date(review.created_at).toLocaleString()}</div>
                    {(review.moderation_status || "pending") === "pending" && (() => {
                      const meta = getPriorityMeta(review.created_at, "review");
                      return (
                        <div className="seller-ops-priority-row">
                          <span className={`ops-priority-badge ${meta.tone}`}>{meta.label}</span>
                          <span className="ops-sla-text">{meta.sla}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className={`order-status order-status-${review.moderation_status || "pending"}`}>
                    {review.moderation_status || "pending"}
                  </div>
                </div>
                <p><strong>{"★".repeat(Number(review.rating || 0))}</strong> {review.title || "No title"}</p>
                <p>{review.comment || "No comment provided."}</p>
                {review.verified_purchase && <span className="deal-source">Verified purchase</span>}
                {review.seller_response && (
                  <p><strong>Seller response:</strong> {review.seller_response}</p>
                )}
                <div className="form-actions">
                  <button
                    className="btn-action btn-add-cart"
                    disabled={busyAction === `review-${review.id}-approved`}
                    onClick={() => moderateReview(review.id, "approved")}
                  >
                    {busyAction === `review-${review.id}-approved` ? "Approving..." : "Approve"}
                  </button>
                  <button
                    className="btn-action btn-delete"
                    disabled={busyAction === `review-${review.id}-rejected`}
                    onClick={() => moderateReview(review.id, "rejected")}
                  >
                    {busyAction === `review-${review.id}-rejected` ? "Rejecting..." : "Reject"}
                  </button>
                </div>
                <div className="review-form" style={{ marginTop: 8 }}>
                  <textarea
                    placeholder="Write seller response"
                    value={responseDrafts[review.id] || ""}
                    onChange={(e) => setResponseDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                  />
                  <button
                    className="btn-action btn-secondary"
                    disabled={busyAction === `review-response-${review.id}`}
                    onClick={() => respondReview(review.id)}
                  >
                    {busyAction === `review-response-${review.id}` ? "Sending..." : "Respond"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "returns" && (
        <div className="orders-container">
          <div className="seller-ops-toolbar">
            <input
              type="text"
              placeholder="Search by order id, tracking id, or reason"
              value={returnQuery}
              onChange={(e) => setReturnQuery(e.target.value)}
            />
            <select value={returnStatusFilter} onChange={(e) => setReturnStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="seller-ops-bulk-row">
            <button className="btn-action btn-secondary" onClick={exportReturnsCsv}>Export returns CSV</button>
            <label className="seller-ops-inline-check">
              <input
                type="checkbox"
                checked={exportFilteredOnly}
                onChange={(e) => setExportFilteredOnly(e.target.checked)}
              />
              Export only filtered rows
            </label>
          </div>

          {filteredReturns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">↩</div>
              <h3>No matching return requests</h3>
              <p>Try a different status filter or search keyword.</p>
            </div>
          ) : (
            filteredReturns.map((request) => (
              <div key={request.id} className="order-card">
                <div className="order-header">
                  <div>
                    <div className="order-id">Return #{request.id} • Order {request.order_tracking_id || request.order}</div>
                    <div className="order-date">{new Date(request.created_at).toLocaleString()}</div>
                    {(["requested", "approved"].includes(request.status || "requested")) && (() => {
                      const meta = getPriorityMeta(request.created_at, "return");
                      return (
                        <div className="seller-ops-priority-row">
                          <span className={`ops-priority-badge ${meta.tone}`}>{meta.label}</span>
                          <span className="ops-sla-text">{meta.sla}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className={`order-status order-status-${request.status || "requested"}`}>
                    {request.status}
                  </div>
                </div>
                <p><strong>Reason:</strong> {request.reason || "No reason provided"}</p>
                {request.resolution_note && <p><strong>Resolution note:</strong> {request.resolution_note}</p>}

                <div className="seller-ops-inline-form">
                  <textarea
                    placeholder="Resolution note (optional)"
                    value={(returnDrafts[request.id] || {}).note || ""}
                    onChange={(e) => setReturnDraftField(request.id, "note", e.target.value)}
                  />
                </div>

                <div className="form-actions">
                  <button
                    className="btn-action btn-add-cart"
                    disabled={busyAction === `return-update-${request.id}-approved`}
                    onClick={() => updateReturn(request.id, "approved")}
                  >
                    {busyAction === `return-update-${request.id}-approved` ? "Approving..." : "Approve"}
                  </button>
                  <button
                    className="btn-action btn-delete"
                    disabled={busyAction === `return-update-${request.id}-rejected`}
                    onClick={() => updateReturn(request.id, "rejected")}
                  >
                    {busyAction === `return-update-${request.id}-rejected` ? "Rejecting..." : "Reject"}
                  </button>
                  <button
                    className="btn-action btn-secondary"
                    disabled={busyAction === `return-update-${request.id}-completed`}
                    onClick={() => updateReturn(request.id, "completed")}
                  >
                    {busyAction === `return-update-${request.id}-completed` ? "Updating..." : "Mark Completed"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "prescriptions" && (
        <div className="orders-container">
          <div className="seller-ops-toolbar">
            <input
              type="text"
              placeholder="Search by medicine or note"
              value={prescriptionQuery}
              onChange={(e) => setPrescriptionQuery(e.target.value)}
            />
            <select value={prescriptionStatusFilter} onChange={(e) => setPrescriptionStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="seller-ops-bulk-row">
            <button className="btn-action btn-secondary" onClick={selectAllPendingPrescriptions}>Select all pending</button>
            <button className="btn-action btn-secondary" onClick={clearPrescriptionSelection}>Clear selection</button>
            <input
              type="text"
              placeholder="Bulk rejection reason"
              value={bulkPrescriptionReason}
              onChange={(e) => setBulkPrescriptionReason(e.target.value)}
            />
            <button
              className="btn-action btn-add-cart"
              disabled={busyAction === "bulk-prescription-approved"}
              onClick={() => bulkReviewPrescriptions("approved")}
            >
              {busyAction === "bulk-prescription-approved" ? "Bulk approving..." : "Bulk approve"}
            </button>
            <button
              className="btn-action btn-delete"
              disabled={busyAction === "bulk-prescription-rejected"}
              onClick={() => bulkReviewPrescriptions("rejected")}
            >
              {busyAction === "bulk-prescription-rejected" ? "Bulk rejecting..." : "Bulk reject"}
            </button>
          </div>

          <div className="results-info results-info-highlight">
            Selected prescriptions: {selectedPrescriptionIds.length} • Pending in view: {visiblePendingPrescriptions.length}
          </div>

          {filteredPrescriptions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h3>No matching prescriptions</h3>
              <p>Update filters to inspect queue items.</p>
            </div>
          ) : (
            filteredPrescriptions.map((item) => (
              <div key={item.id} className="order-card">
                <div className="order-header">
                  <div>
                    {(item.status || "pending") === "pending" && (
                      <label className="seller-ops-select-toggle">
                        <input
                          type="checkbox"
                          checked={selectedPrescriptionIds.includes(item.id)}
                          onChange={() => togglePrescriptionSelection(item.id)}
                        />
                        Select
                      </label>
                    )}
                    <div className="order-id">Prescription #{item.id} • {item.medicine_name}</div>
                    <div className="order-date">Uploaded: {new Date(item.created_at).toLocaleString()}</div>
                    {(item.status || "pending") === "pending" && (() => {
                      const meta = getPriorityMeta(item.created_at, "prescription");
                      return (
                        <div className="seller-ops-priority-row">
                          <span className={`ops-priority-badge ${meta.tone}`}>{meta.label}</span>
                          <span className="ops-sla-text">{meta.sla}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className={`order-status order-status-${item.status || "pending"}`}>{item.status}</div>
                </div>
                  {item.file_url && <p><a href={item.file_url} target="_blank" rel="noreferrer">View uploaded prescription</a></p>}
                {item.note && <p><strong>Note:</strong> {item.note}</p>}
                {item.rejection_reason && <p><strong>Rejection reason:</strong> {item.rejection_reason}</p>}
                <textarea
                  placeholder="Rejection reason (required only for reject)"
                  value={prescriptionRejectionReasons[item.id] || ""}
                  onChange={(e) => setPrescriptionRejectionReasons((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />
                <div className="form-actions">
                  <button
                    className="btn-action btn-add-cart"
                    disabled={busyAction === `prescription-${item.id}-approved`}
                    onClick={() => reviewPrescription(item.id, "approved")}
                  >
                    {busyAction === `prescription-${item.id}-approved` ? "Approving..." : "Approve"}
                  </button>
                  <button
                    className="btn-action btn-delete"
                    disabled={busyAction === `prescription-${item.id}-rejected`}
                    onClick={() => reviewPrescription(item.id, "rejected")}
                  >
                    {busyAction === `prescription-${item.id}-rejected` ? "Rejecting..." : "Reject"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "admin" && (
        <div className="orders-container">
          <div className="order-card">
            <h3>Assign Role</h3>
            <div className="review-form" style={{ marginTop: 8 }}>
              <input
                type="text"
                placeholder="Username"
                value={roleUsername}
                onChange={(e) => setRoleUsername(e.target.value)}
              />
              <select value={roleValue} onChange={(e) => setRoleValue(e.target.value)}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="admin">Admin</option>
              </select>
              <button className="btn-action btn-add-cart" disabled={busyAction === "assign-role"} onClick={assignRole}>
                {busyAction === "assign-role" ? "Updating..." : "Update Role"}
              </button>
            </div>
          </div>

          <div className="order-card">
            <h3>Export Operations Data</h3>
            <p>Download filtered queue data for audit, reporting, and SLA reviews.</p>
            <div className="seller-ops-bulk-row">
              <button className="btn-action btn-secondary" onClick={exportReturnsCsv}>Export Returns CSV</button>
              <button className="btn-action btn-secondary" onClick={exportFraudEventsCsv}>Export Fraud Events CSV</button>
              <label className="seller-ops-inline-check">
                <input
                  type="checkbox"
                  checked={exportFilteredOnly}
                  onChange={(e) => setExportFilteredOnly(e.target.checked)}
                />
                Export only filtered rows
              </label>
              <button className="btn-action btn-secondary" onClick={resetSavedDashboardPreferences}>
                Reset saved dashboard preferences
              </button>
            </div>
          </div>

          <div className="order-card">
            <h3>Fraud Risk Events</h3>
            <div className="seller-ops-toolbar" style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Search by user, action, reason, or context"
                value={fraudQuery}
                onChange={(e) => setFraudQuery(e.target.value)}
              />
              <select value={fraudRiskFilter} onChange={(e) => setFraudRiskFilter(e.target.value)}>
                <option value="all">All risk levels</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {filteredFraudEvents.length === 0 ? (
              <p>No fraud risk events logged.</p>
            ) : (
              <div className="review-list">
                {filteredFraudEvents.map((event) => (
                  <div key={event.id} className="review-card">
                    <p><strong>{event.risk_level.toUpperCase()}</strong> - {event.action}</p>
                    <p><strong>User:</strong> {event.username}</p>
                    <p><strong>Reason:</strong> {event.reason || "-"}</p>
                    {event.context && <p><strong>Context:</strong> {event.context}</p>}
                    <p><strong>When:</strong> {new Date(event.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

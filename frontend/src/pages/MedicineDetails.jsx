import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import MedicineCard from "../components/MedicineCard";

export default function MedicineDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [medicine, setMedicine] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [prescriptionNote, setPrescriptionNote] = useState("");
  const [rating, setRating] = useState("5");
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const detailFacts = medicine ? [
    { label: "Brand", value: medicine.brand || "Not specified" },
    { label: "Category", value: medicine.category || "General" },
    { label: "Prescription", value: medicine.prescription_required ? "Required" : "Not required" },
    { label: "Shop rating", value: `${Number(medicine.shop_rating || medicine.average_rating || 0).toFixed(1)} / 5` },
  ] : [];

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const detailRes = await api.get(`/medicines/${id}/`);
        const med = detailRes.data;
        setMedicine(med);

        const relatedRes = await api.get("/medicines/", {
          params: {
            category: med.category || undefined,
            brand: med.brand || undefined,
            page_size: 6,
          },
        });

        const relatedItems = (relatedRes.data.results || []).filter((m) => m.id !== med.id).slice(0, 4);
        setRelated(relatedItems);

        const reviewRes = await api.get("/reviews/", { params: { medicine: med.id } });
        setReviews(reviewRes.data.results || []);

        const prescriptionRes = await api.get("/prescriptions/", { params: { mine: 1 } });
        const mine = (prescriptionRes.data.results || []).filter((p) => p.medicine === med.id);
        setPrescriptions(mine);
      } catch (err) {
        setError("Unable to load medicine details.");
      }
    };

    load();
  }, [id]);

  const addToCart = async (medicineId) => {
    try {
      await api.post("/cart/", { medicine: medicineId, quantity: 1 });
      setMessage("Added to cart.");
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to add to cart.");
    }
  };

  const buyNow = async (medicineId) => {
    await addToCart(medicineId);
    navigate("/cart");
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

  const submitReview = async () => {
    if (!medicine) return;
    try {
      await api.post("/reviews/", {
        medicine: medicine.id,
        rating: Number(rating),
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
      });
      setMessage("Review submitted successfully.");
      setReviewTitle("");
      setReviewComment("");
      const reviewRes = await api.get("/reviews/", { params: { medicine: medicine.id } });
      setReviews(reviewRes.data.results || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to submit review.");
    }
  };

  const uploadPrescription = async () => {
    if (!medicine) return;
    if (!prescriptionFile) {
      setError("Prescription file is required.");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("medicine", String(medicine.id));
      formData.append("file", prescriptionFile);
      formData.append("note", prescriptionNote.trim());
      await api.post("/prescriptions/", formData);
      setMessage("Prescription uploaded for review.");
      setPrescriptionFile(null);
      setPrescriptionNote("");
      const prescriptionRes = await api.get("/prescriptions/", { params: { mine: 1 } });
      const mine = (prescriptionRes.data.results || []).filter((p) => p.medicine === medicine.id);
      setPrescriptions(mine);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to upload prescription.");
    }
  };

  if (!medicine && !error) {
    return <div className="page"><div className="loading-state"><p>Loading details...</p></div></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Medicine Details</h1>
        <p>Product detail page with rich information</p>
      </div>

      {medicine && (
        <section className="medicine-summary-banner">
          <div className="medicine-summary-copy">
            <span className="market-kicker">Marketplace snapshot</span>
            <h2>{medicine.name}</h2>
            <p>
              Compare stock, nearby shop data, reviews, and prescription requirements before you add this item to your cart.
            </p>
            <div className="medicine-summary-badges">
              <span>{medicine.in_stock ? "In stock" : "Out of stock"}</span>
              <span>{medicine.prescription_required ? "Prescription required" : "No prescription needed"}</span>
              <span>{medicine.rating_count} review(s)</span>
            </div>
          </div>

          <div className="medicine-summary-facts">
            {detailFacts.map((fact) => (
              <div key={fact.label} className="medicine-summary-fact">
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      {medicine && (
        <div className="medicine-details-panel">
          <MedicineCard medicine={medicine} onAddToCart={addToCart} onBuy={buyNow} onAddToWishlist={addToWishlist} />
          <div className="medicine-meta-card">
            <h3>Product Information</h3>
            <p><strong>Brand:</strong> {medicine.brand || "Not specified"}</p>
            <p><strong>Category:</strong> {medicine.category || "General"}</p>
            <p><strong>Composition:</strong> {medicine.composition || "Not specified"}</p>
            <p><strong>Prescription:</strong> {medicine.prescription_required ? "Required" : "Not required"}</p>
            <p><strong>Rating:</strong> {Number(medicine.average_rating || 0).toFixed(1)} / 5 ({medicine.rating_count} reviews)</p>
            <p><strong>Description:</strong> {medicine.description || "No additional description available."}</p>
          </div>
        </div>
      )}

      {medicine?.prescription_required && (
        <section className="deal-section">
          <h3>Prescription Required</h3>
          <p>Upload your prescription to proceed with checkout for this medicine.</p>
          <div className="review-form">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setPrescriptionFile(e.target.files?.[0] || null)}
            />
            <textarea
              placeholder="Optional note for reviewer"
              value={prescriptionNote}
              onChange={(e) => setPrescriptionNote(e.target.value)}
            />
            <button className="btn-action btn-add-cart" onClick={uploadPrescription}>Upload Prescription</button>
          </div>
          {prescriptions.length > 0 && (
            <div className="review-list">
              {prescriptions.map((p) => (
                <div key={p.id} className="review-card">
                  <p><strong>Status:</strong> {p.status}</p>
                  <p><strong>Note:</strong> {p.note || "-"}</p>
                  {p.file_url && <p><a href={p.file_url} target="_blank" rel="noreferrer">View uploaded prescription</a></p>}
                  {p.rejection_reason && <p><strong>Rejection reason:</strong> {p.rejection_reason}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section className="deal-section">
          <h3>Similar products</h3>
          <div className="medicine-grid">
            {related.map((item) => (
              <MedicineCard key={item.id} medicine={item} onAddToCart={addToCart} onAddToWishlist={addToWishlist} onBuy={buyNow} />
            ))}
          </div>
        </section>
      )}

      <section className="deal-section">
        <h3>Ratings & Reviews</h3>
        <div className="review-form">
          <select value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Good</option>
            <option value="3">3 - Average</option>
            <option value="2">2 - Poor</option>
            <option value="1">1 - Bad</option>
          </select>
          <input
            type="text"
            placeholder="Review title"
            value={reviewTitle}
            onChange={(e) => setReviewTitle(e.target.value)}
          />
          <textarea
            placeholder="Share your experience"
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
          />
          <button className="btn-action btn-add-cart" onClick={submitReview}>Submit Review</button>
        </div>

        <div className="review-list">
          {reviews.length === 0 ? (
            <p>No reviews yet. Be the first to review.</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="review-card">
                <strong>{"★".repeat(Number(review.rating || 0))}</strong>
                <span className="review-user"> {review.username}</span>
                {review.verified_purchase && <span className="deal-source">Verified Purchase</span>}
                {review.title && <h4>{review.title}</h4>}
                <p>{review.comment || "No written comment."}</p>
                {review.seller_response && <p><strong>Seller response:</strong> {review.seller_response}</p>}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

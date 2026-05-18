import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const CATEGORY_KEYWORDS = {
  "Pain Relief": ["pain", "ibuprofen", "acetaminophen", "paracetamol", "diclofenac"],
  "Cold & Flu": ["cold", "flu", "cough", "decongest", "allergy", "sinus"],
  Vitamins: ["vitamin", "multivitamin", "zinc", "calcium", "supplement"],
  "Diabetes Care": ["diabetes", "insulin", "glucose", "metformin"],
  "Skin Care": ["skin", "cream", "lotion", "ointment", "acne", "derma"],
  "Heart Health": ["heart", "cardio", "cholesterol", "bp", "pressure", "statin"],
  "Baby Care": ["baby", "infant", "kids", "children", "pediatric"],
  Fitness: ["protein", "electrolyte", "energy", "sports", "fitness"],
  "Personal Care": ["sanitizer", "hygiene", "soap", "oral", "tooth", "care"],
  Devices: ["device", "monitor", "meter", "thermometer", "nebulizer", "kit"],
};

function inferCategory(medicineName = "") {
  const lower = medicineName.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category;
    }
  }
  return "For You";
}

const FALLBACK_SPOTLIGHT_DEALS = [
  {
    name: "Paracetamol 650",
    offer: "From Rs 49",
    image: "https://picsum.photos/seed/medicine-paracetamol/500/320",
    source: "Fallback",
  },
  {
    name: "Vitamin C Tablets",
    offer: "Flat 35% Off",
    image: "https://picsum.photos/seed/medicine-vitamin/500/320",
    source: "Fallback",
  },
  {
    name: "Cough Syrup",
    offer: "From Rs 89",
    image: "https://picsum.photos/seed/medicine-cough/500/320",
    source: "Fallback",
  },
  {
    name: "Digital Thermometer",
    offer: "Best Picks",
    image: "https://picsum.photos/seed/medicine-thermometer/500/320",
    source: "Fallback",
  },
];

const FALLBACK_IN_DEMAND_DEALS = [
  {
    name: "BP Monitor",
    offer: "Up to 30% Off",
    image: "https://picsum.photos/seed/medicine-bp/500/320",
    source: "Fallback",
  },
  {
    name: "Hand Sanitizer",
    offer: "Combo Savings",
    image: "https://picsum.photos/seed/medicine-sanitizer/500/320",
    source: "Fallback",
  },
  {
    name: "Calcium Capsules",
    offer: "From Rs 199",
    image: "https://picsum.photos/seed/medicine-calcium/500/320",
    source: "Fallback",
  },
  {
    name: "Nebulizer",
    offer: "Limited Time Deal",
    image: "https://picsum.photos/seed/medicine-nebulizer/500/320",
    source: "Fallback",
  },
];

const FEATURED_CATEGORIES = [
  { label: "Pain Relief", query: "pain relief", icon: "💊" },
  { label: "Cold & Flu", query: "cold flu", icon: "🤧" },
  { label: "Vitamins", query: "vitamins", icon: "🧴" },
  { label: "Diabetes Care", query: "diabetes care", icon: "🩺" },
  { label: "Heart Health", query: "heart health", icon: "❤️" },
  { label: "Baby Care", query: "baby care", icon: "👶" },
];

const SHOPPING_PROMISES = [
  "Compare nearby store options in one place",
  "Save favorites for faster reorder later",
  "Track orders and alerts from your dashboard",
];

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ shops: 0, medicines: 0 });
  const [allDeals, setAllDeals] = useState([]);

  const effectiveDeals = allDeals;
  const spotlightDeals = effectiveDeals.slice(0, 4);
  const inDemandDeals = effectiveDeals.slice(4, 8);
  const heroShowcaseDeals = effectiveDeals.slice(0, 3);
  const quickPickDeals = effectiveDeals.slice(3, 6);
  const animationSeed = "all-deals";
  const openSearchForDeal = (dealName) => {
    const q = encodeURIComponent(dealName || "");
    navigate(`/search?q=${q}`);
  };

  const openCategorySearch = (query) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleCardKeyDown = (event, dealName) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openSearchForDeal(dealName);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadStats = async () => {
      try {
        const [shopsRes, medicinesRes] = await Promise.all([
          api.get("/shops/"),
          api.get("/medicines/"),
        ]);
        const medicineCount = Array.isArray(medicinesRes.data)
          ? medicinesRes.data.length
          : (medicinesRes.data.count || 0);
        setStats({ shops: shopsRes.data.length, medicines: medicineCount });
      } catch (err) {
        // Keep default stats if backend is unavailable.
      }
    };

    setAllDeals(
      [...FALLBACK_SPOTLIGHT_DEALS, ...FALLBACK_IN_DEMAND_DEALS].map((deal) => ({
        ...deal,
        category: inferCategory(deal.name),
      }))
    );

    const loadLiveMedicineDeals = async () => {
      try {
        const [firstRes, secondRes] = await Promise.all([
          fetch("https://api.fda.gov/drug/ndc.json?limit=12"),
          fetch("https://api.fda.gov/drug/ndc.json?limit=12&skip=12"),
        ]);

        if (!firstRes.ok || !secondRes.ok) {
          return;
        }

        const [firstPayload, secondPayload] = await Promise.all([
          firstRes.json(),
          secondRes.json(),
        ]);

        const allResults = [
          ...(firstPayload.results || []),
          ...(secondPayload.results || []),
        ];

        const seen = new Set();
        const liveDeals = [];

        allResults.forEach((item, index) => {
          const activeIngredientName =
            Array.isArray(item.active_ingredients) && item.active_ingredients[0]
              ? item.active_ingredients[0].name
              : "";
          const rawName =
            item.brand_name || item.generic_name || activeIngredientName || "Medicine";
          const medicineName = rawName.trim();
          const key = medicineName.toLowerCase();

          if (!medicineName || seen.has(key) || liveDeals.length >= 8) {
            return;
          }

          seen.add(key);
          const labeler = (item.labeler_name || "OpenFDA supplier").trim();
          const trimmedLabeler =
            labeler.length > 26 ? `${labeler.slice(0, 26)}...` : labeler;
          const productSeed = item.product_ndc || item.package_ndc || `medicine-${index}`;

          liveDeals.push({
            name: medicineName.length > 34 ? `${medicineName.slice(0, 34)}...` : medicineName,
            offer: `By ${trimmedLabeler}`,
            image: `https://picsum.photos/seed/live-${encodeURIComponent(productSeed)}/500/320`,
            source: "Live API",
            category: inferCategory(medicineName),
          });
        });

        if (!ignore && liveDeals.length >= 8) {
          setAllDeals(liveDeals.slice(0, 8));
        }
      } catch (err) {
        // Keep fallback cards if live API is unavailable.
      }
    };

    loadStats();
    loadLiveMedicineDeals();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="page market-page">
      <div className="market-shell">
        <div className="market-search-row">
          <input
            className="market-search-input"
            placeholder="Search for Products, Brands and More"
            onFocus={() => navigate("/search")}
            readOnly
          />
        </div>

        <section className="market-intro-panel">
          <div className="market-intro-copy">
            <span className="market-kicker">Trusted pharmacy shopping</span>
            <h1>Find medicines faster than the pharmacy counter.</h1>
            <p>
              Compare nearby stores, save shopping lists, and keep your medicine orders, reviews,
              and prescriptions in one place.
            </p>
            <div className="market-intro-actions">
              <button className="btn-hero btn-primary" onClick={() => navigate("/search")}>Start shopping</button>
              <button className="btn-hero" onClick={() => navigate("/wishlist")}>View wishlist</button>
            </div>
          </div>

          <div className="market-intro-card">
            <div className="market-intro-stats">
              <div>
                <strong>{stats.shops || "--"}</strong>
                <span>Registered stores</span>
              </div>
              <div>
                <strong>{stats.medicines || "--"}</strong>
                <span>Listed products</span>
              </div>
            </div>
            <div className="market-intro-list">
              {SHOPPING_PROMISES.map((item) => (
                <div key={item} className="market-intro-list-item">
                  <span>✓</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="market-category-rail" aria-label="Featured medicine categories">
          {FEATURED_CATEGORIES.map((category) => (
            <button
              key={category.label}
              type="button"
              className="market-category-chip"
              onClick={() => openCategorySearch(category.query)}
            >
              <span className="market-category-icon">{category.icon}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </section>

        <section className="market-hero-strip">
          {heroShowcaseDeals.map((deal, index) => (
            <article
              key={`hero-${deal.name}-${index}`}
              className="market-hero-card"
              onClick={() => openSearchForDeal(deal.name)}
              onKeyDown={(event) => handleCardKeyDown(event, deal.name)}
              role="button"
              tabIndex={0}
              aria-label={`Find nearby shops for ${deal.name}`}
            >
              <img src={deal.image} alt={deal.name} loading="lazy" />
              <div className="market-hero-overlay">
                <h4>{deal.name}</h4>
                <p>{deal.offer}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="market-quick-picks">
          {quickPickDeals.map((deal, index) => (
            <article
              key={`quick-${deal.name}-${index}`}
              className="market-quick-card"
              onClick={() => openSearchForDeal(deal.name)}
              onKeyDown={(event) => handleCardKeyDown(event, deal.name)}
              role="button"
              tabIndex={0}
              aria-label={`Find nearby shops for ${deal.name}`}
            >
              <img src={deal.image} alt={deal.name} loading="lazy" />
              <div className="market-quick-copy">
                <strong>{deal.offer}</strong>
                <span>{deal.name}</span>
              </div>
            </article>
          ))}
        </section>

        <section className="market-highlight-banner">
          <div>
            <h2>Brands In Spotlight</h2>
            <p>Top wellness and medicine picks curated for you</p>
          </div>
          <div className="market-banner-stats">
            <span>{stats.shops}+ Stores</span>
            <span>{stats.medicines}+ Products</span>
          </div>
        </section>

        <section className="deal-section">
          <h3>On everybody's list</h3>
          <div key={`spotlight-${animationSeed}`} className="deal-track deal-track-animate">
            {spotlightDeals.map((deal, index) => (
              <article
                key={`${deal.name}-${index}`}
                className="deal-card"
                style={{ "--card-delay": `${index * 70}ms` }}
                onClick={() => openSearchForDeal(deal.name)}
                onKeyDown={(event) => handleCardKeyDown(event, deal.name)}
                role="button"
                tabIndex={0}
                aria-label={`Find nearby shops for ${deal.name}`}
              >
                <img src={deal.image} alt={deal.name} loading="lazy" />
                <div className="deal-copy">
                  <p>{deal.name}</p>
                  <strong>{deal.offer}</strong>
                  <span className="deal-source">{deal.source}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="deal-section">
          <h3>In demand</h3>
          <div key={`demand-${animationSeed}`} className="deal-track deal-track-animate">
            {inDemandDeals.map((deal, index) => (
              <article
                key={`${deal.name}-${index}`}
                className="deal-card"
                style={{ "--card-delay": `${index * 70}ms` }}
                onClick={() => openSearchForDeal(deal.name)}
                onKeyDown={(event) => handleCardKeyDown(event, deal.name)}
                role="button"
                tabIndex={0}
                aria-label={`Find nearby shops for ${deal.name}`}
              >
                <img src={deal.image} alt={deal.name} loading="lazy" />
                <div className="deal-copy">
                  <p>{deal.name}</p>
                  <strong>{deal.offer}</strong>
                  <span className="deal-source">{deal.source}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
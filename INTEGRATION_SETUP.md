# MediFind-PharmaXpress - Backend & Frontend Integration Setup

## Status: ✅ READY FOR INTEGRATION

---

## 1. Backend Server
**Status**: ✅ Running  
**URL**: http://localhost:8080  
**API Base**: http://localhost:8080/api  
**Database**: H2 (File-based at `./data/pharmaxpress`)  
**Framework**: Spring Boot 3.4.5 | Java 17.0.19 | Tomcat 10.1.40

---

## 2. Frontend Configuration
**Environment File**: `.env` (Created)
```
REACT_APP_API_BASE_URL=http://localhost:8080/api
REACT_APP_ENV=development
```

**Dependencies**:
- axios: ^1.15.0 (HTTP Client)
- react-router-dom: ^6.30.3 (Navigation)
- react: ^18.3.1 (Core Library)
- leaflet: ^1.9.4 (Maps)
- react-scripts: ^5.0.1 (Build Tool)

---

## 3. API Endpoints Alignment

### Authentication Endpoints
| Endpoint | Method | Frontend Page | Backend Controller |
|----------|--------|---------------|--------------------|
| `/auth/login/` | POST | Login.jsx | AuthController |
| `/auth/signup/` | POST | Signup.jsx | AuthController |
| `/auth/forgot-username/` | POST | ForgotUsername.jsx | AuthController |
| `/auth/forgot-password/` | POST | ForgotPassword.jsx | AuthController |
| `/auth/profile/` | GET, PATCH | Profile.jsx | AuthController |
| `/auth/me/` | GET | PaymentsOps.jsx, ShopRegister.jsx | AuthController |

### Catalog Endpoints
| Endpoint | Method | Frontend Pages | Backend Controller |
|----------|--------|----------------|--------------------|
| `/medicines/` | GET, POST | Home, Search, MyMedicines, ShopRegister | CatalogController |
| `/medicines/{id}/` | GET, PATCH, DELETE | MedicineDetails, MyMedicines | CatalogController |
| `/medicines/suggestions/` | GET | Search.jsx | CatalogController |
| `/shops/` | GET, POST | Home, ShopRegister, MyMedicines | CatalogController |
| `/shops/{id}/` | GET | CatalogController | CatalogController |

### Commerce Endpoints
| Endpoint | Method | Frontend Pages | Backend Controller |
|----------|--------|----------------|--------------------|
| `/cart/` | GET, POST | Cart, MedicineDetails, Search | CommerceController |
| `/cart/{id}/` | PATCH, DELETE | Cart.jsx | CommerceController |
| `/orders/` | GET, POST | Orders, Cart | CommerceController |
| `/orders/{id}/cancel/` | POST | Orders.jsx | CommerceController |
| `/returns/` | POST | Orders.jsx | CommerceController |
| `/wishlist/` | POST | MedicineDetails, Search | CommerceController |

### Payment Endpoints
| Endpoint | Method | Frontend Pages | Backend Controller |
|----------|--------|----------------|--------------------|
| `/payments/` | GET | Payments.jsx | PaymentController |
| `/payments/initialize/` | POST | Cart.jsx | PaymentController |
| `/payments/{id}/confirm/` | POST | Cart.jsx | PaymentController |
| `/payments/{id}/history/` | GET | Payments.jsx | PaymentController |
| `/payments/reconcile/` | GET, POST | PaymentsOps.jsx | PaymentController |

### Engagement Endpoints
| Endpoint | Method | Frontend Pages | Backend Controller |
|----------|--------|----------------|--------------------|
| `/reviews/` | GET, POST | MedicineDetails.jsx | EngagementController |
| `/prescriptions/` | GET, POST | MedicineDetails.jsx | EngagementController |
| `/notifications/` | GET | Notifications.jsx | EngagementController |
| `/notifications/mark-read/` | POST | Notifications.jsx | EngagementController |

---

## 4. Authentication Flow
**Token Format**: `Token {token_string}`  
**Storage**: localStorage (key: `medcompare_token`)  
**Header**: `Authorization: Token {token_string}`  
**Free Endpoints** (No Auth Required):
- `/auth/login/`
- `/auth/signup/`
- `/auth/forgot-username/`
- `/auth/forgot-password/`

---

## 5. CORS Configuration
**Backend**: ✅ Configured for Cross-Origin Requests  
**File**: `spring-backend/src/main/java/com/medifind/pharmaxpress/config/CorsConfig.java`  
**Allows**: Frontend requests from configured origins

---

## 6. Database Schema
**Type**: H2 In-Memory + File Persistence  
**Location**: `./data/pharmaxpress`  
**Console**: http://localhost:8080/h2-console  
**User**: SA  
**Tables**: 16 JPA repositories configured

**Key Entities**:
- UserAccount (Users)
- Medicine (Product Catalog)
- Shop (Seller Stores)
- Order (Purchases)
- CartItem (Shopping Cart)
- Review (User Reviews)
- Prescription (Medical Prescriptions)
- Payment Transaction (Payments)
- Notification (User Notifications)
- WishlistItem (Favorites)
- ReturnRequest (Returns Management)

---

## 7. Running the System

### Backend (Already Running)
```bash
cd spring-backend
$env:JAVA_HOME = "$env:USERPROFILE\.local\jdk\jdk-17.0.19+10"
mvn spring-boot:run
```

### Frontend
```bash
cd frontend
npm install          # (if dependencies not installed)
npm start            # Starts on http://localhost:3000
```

---

## 8. Frontend Pages Overview

| Page | Route | Functionality |
|------|-------|---------------|
| Login | `/login` | User authentication |
| Signup | `/signup` | User registration |
| Home | `/home`, `/` | Homepage with deals/categories |
| Search | `/search` | Medicine search and filtering |
| Medicine Details | `/medicine/{id}` | Product details, reviews, add to cart |
| Cart | `/cart` | Shopping cart management |
| Orders | `/orders` | Order history and tracking |
| Payments | `/payments` | Payment history |
| Profile | `/profile` | User profile settings |
| Wishlist | `/wishlist` | Saved favorites |
| Notifications | `/notifications` | User notifications |
| Shop Register | `/shop-register` | Seller shop registration |
| My Medicines | `/my-medicines` | Seller inventory management |

---

## 9. Key Features Enabled

✅ User Authentication & Authorization  
✅ Product Search & Filtering  
✅ Shopping Cart Management  
✅ Order Processing  
✅ Payment Processing  
✅ Seller Dashboard  
✅ Review & Rating System  
✅ Prescription Management  
✅ Order Returns  
✅ Wishlist/Favorites  
✅ Notification System  
✅ User Profile Management  

---

## 10. Environment Setup Checklist

- [x] Backend running on http://localhost:8080
- [x] Frontend `.env` file configured
- [x] API base URL set to http://localhost:8080/api
- [x] Authentication token format configured
- [x] CORS enabled
- [x] Database initialized
- [x] All controllers compiled and working
- [x] All dependencies listed in package.json

---

## Next Steps

1. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Start Frontend Development Server**:
   ```bash
   npm start
   ```

3. **Test Integration**:
   - Navigate to http://localhost:3000
   - Create account or login
   - Browse medicines
   - Add to cart
   - Complete a purchase

---

**Last Updated**: May 13, 2026  
**Backend Status**: ✅ Running on http://localhost:8080  
**Frontend Status**: Ready for npm install & npm start

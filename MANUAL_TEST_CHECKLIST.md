# Manual Page-by-Page Test Checklist
**Date:** April 19, 2026 | **Tester:** You | **Environment:** http://127.0.0.1:8000

---

## PHASE 1: AUTHENTICATION PAGES (Unauthenticated)

### Test 1: Login Page (`/login`)
**Steps:**
1. Navigate to http://127.0.0.1:8000/login (or click "Login" in navbar)
2. Verify page shows: email field, password field, login button, "New user? Sign up" link
3. Try invalid email → should show validation error
4. Try empty fields → click Login → should show error or remain on page
5. **Test with valid credentials:**
   - Email: `buyer@example.com` (from backend fixtures)
   - Password: `testpass123` (use real password from your DB or fixtures)
   - Expected: Page redirects to /home, token stored in localStorage
6. Verify localStorage has `medcompare_token` key after login
7. Verify Navbar shows user profile icon (not login link)

**Results:**
- [ ] Page loads without errors
- [ ] Validation works for invalid emails
- [ ] Login with valid credentials succeeds
- [ ] Token stored in localStorage
- [ ] Redirects to /home

---

### Test 2: Signup Page (`/signup`)
**Steps:**
1. Log out or use incognito window, navigate to /signup
2. Verify form fields: email, username, password, confirm password, role dropdown, email verification opt-in
3. Try invalid email format → validation error shown
4. Try password mismatch → error shown
5. Try username that already exists → error from API
6. **Test valid signup:**
   - Email: `newbuyer@example.com`
   - Username: `newbuyer_test_123`
   - Password: `TestPass123!`
   - Role: `buyer`
   - Expected: Success message or redirect to login
7. Verify new user can log in with those credentials

**Results:**
- [ ] Form validation works
- [ ] Duplicate email rejected
- [ ] Password mismatch detected
- [ ] Valid signup succeeds
- [ ] Can login with new credentials

---

### Test 3: Forgot Password Page (`/forgot-password`)
**Steps:**
1. Navigate to /forgot-password
2. Enter an email address
3. Click "Send Reset Link"
4. Verify success message shown (or check backend email output in console)
5. Verify form resets or shows confirmation

**Results:**
- [ ] Page loads correctly
- [ ] Form accepts email input
- [ ] Submit works without errors

---

### Test 4: Forgot Username Page (`/forgot-username`)
**Steps:**
1. Navigate to /forgot-username
2. Enter an email address
3. Click "Send Username"
4. Verify success message or confirmation shown

**Results:**
- [ ] Page loads correctly
- [ ] Form accepts email input
- [ ] Submit works without errors

---

### Test 5: Shop Register Page (`/shop-register`)
**Steps:**
1. Navigate to /shop-register
2. Verify form shows: shop name, address, city, pincode, latitude, longitude
3. Fill in valid shop details
4. Submit and verify success or appropriate response

**Results:**
- [ ] Page loads correctly
- [ ] Form fields present
- [ ] Submit works

---

## PHASE 2: SHOPPER FLOWS (Authenticated as Buyer)

**Pre-requirement:** Log in with buyer account first
- Email: `buyer@example.com`
- Password: `testpass123` (or valid credentials)

---

### Test 6: Home Page (`/home` or `/`)
**Steps:**
1. After login, verify you're on /home
2. Scroll page and verify:
   - Hero/intro section visible
   - Medicine listings displayed with cards
   - Each card shows: medicine name, price, rating, Rx/OTC badge, trust badges
   - Shop name visible on cards
3. Click a category chip (if available) - should filter medicines
4. Scroll to end - verify pagination or "Load More"
5. No JavaScript errors in console

**Results:**
- [ ] Hero section displays
- [ ] Medicine cards render properly
- [ ] Pagination/load more works
- [ ] No console errors

---

### Test 7: Search Page (`/search`)
**Steps:**
1. Click search in navbar or navigate directly to /search
2. Type a medicine name (e.g., "Aspirin", "Toast Freezin Cold")
3. Verify results appear dynamically
4. Verify each result card shows: name, price, rating, Rx badge
5. Try advanced filters:
   - Price range filter (if available)
   - Rx/OTC filter
   - Sort options
6. Verify results update based on filters
7. Clear search - results reset
8. Use quick-search chips (if visible) - should auto-search

**Results:**
- [ ] Search results display correctly
- [ ] Filters work and update results
- [ ] No console errors
- [ ] Quick-search chips functional

---

### Test 8: Medicine Details Page (`/medicine/:id`)
**Steps:**
1. From Home or Search, click a medicine card
2. Verify details page shows:
   - Large medicine image (if available)
   - Medicine name, price, rating
   - Rx/OTC badge, trust badges
   - Description/facts section
   - "Add to Cart" button
   - Reviews section
3. Click "Add to Cart" → verify success toast or modal
4. Click "Add to Wishlist" (if button present) → verify added
5. Scroll reviews - verify list displays
6. Back button or navigate away - works correctly

**Results:**
- [ ] All product info displays
- [ ] "Add to Cart" works
- [ ] "Add to Wishlist" works (if present)
- [ ] Reviews display
- [ ] No console errors

---

### Test 9: Cart Page (`/cart`)
**Steps:**
1. Click Cart icon in navbar (or /cart)
2. Verify added items appear in cart with:
   - Medicine name, price, quantity
   - Remove button
   - Quantity increment/decrement
3. Try increasing quantity → total price updates
4. Try removing an item → removed from cart
5. Verify cart total/subtotal correct
6. Scroll to checkout section:
   - Delivery address fields (address, city, pincode, house number, mobile number)
   - Payment method (if applicable)
   - Place Order button
7. Fill checkout details:
   - Address: "123 Main St"
   - City: "New York"
   - Pincode: "10001"
   - House: "Apt 5"
   - Mobile: "9876543210"
8. Click "Place Order"
9. Verify order confirmation and redirect to /orders

**Results:**
- [ ] Cart items display correctly
- [ ] Add/remove/quantity works
- [ ] Checkout form accepts input
- [ ] Order placement succeeds
- [ ] Redirects to orders page

---

### Test 10: Orders Page (`/orders`)
**Steps:**
1. After placing an order, verify you're on /orders
2. Verify recent order appears with:
   - Order ID
   - Order date/time
   - Status (e.g., "placed", "confirmed")
   - Total amount
   - Delivery address
3. Click on an order - verify details/tracking info (if expanded view)
4. Verify order status timeline or tracking rail visible
5. Scroll through past orders if multiple exist

**Results:**
- [ ] Orders list displays
- [ ] Recent order appears first
- [ ] Order details correct
- [ ] Status shown clearly
- [ ] Tracking/details expandable

---

### Test 11: Wishlist Page (`/wishlist`)
**Steps:**
1. Navigate to /wishlist (or click heart icon in navbar)
2. Verify items you added to wishlist appear
3. Each item shows: name, price, rating, "Add to Cart" button, "Remove" button
4. Click "Add to Cart" from wishlist → verify added to cart
5. Navigate to /cart - verify item added
6. Back to /wishlist and remove an item → verify removed
7. Empty wishlist shows appropriate message

**Results:**
- [ ] Wishlist items display
- [ ] Add to Cart works
- [ ] Remove works
- [ ] Empty state message shown

---

### Test 12: Profile Page (`/profile`)
**Steps:**
1. Click Profile in navbar or navigate to /profile
2. Verify page shows:
   - User email
   - Username
   - User role (buyer, seller, admin)
   - Account creation date (if available)
   - Profile action buttons (edit, settings, preferences)
3. Try editing profile (if edit button present) - verify form loads
4. Verify address book or saved addresses section
5. Verify preferences/settings section

**Results:**
- [ ] Profile info displays
- [ ] All user data correct
- [ ] Edit functionality works (if present)
- [ ] Preferences visible

---

## PHASE 3: ADMIN/SELLER PAGES (Authenticated as Seller/Admin)

**Pre-requirement:** Log in with seller/admin account
- Create or use existing seller account
- Or add test role in database

---

### Test 13: SellerOperations Page (`/seller-operations`)
**Steps:**
1. Log in as seller/admin, navigate to /seller-operations
2. Verify page structure:
   - KPI cards at top (Revenue, Orders, Returns, Fraud Events)
   - Tab navigation: Returns | Orders | Prescriptions | Fraud | Reviews
3. **Test Returns Tab:**
   - Verify returns list with columns: Order ID, Reason, Status
   - Try filtering returns by status
   - Try inline OTP entry for return approval
   - Verify "Approve" button works
4. **Test Orders Tab:**
   - Verify orders list with status, dates
   - Try bulk select multiple orders
   - Try bulk action (mark as shipped, cancel, etc.)
5. **Test Prescriptions Tab:**
   - Verify prescription list
   - Try moderation workflow (approve/reject with reason)
6. **Test Fraud Tab:**
   - Verify fraud events list
   - Try exporting to CSV
7. **Test Reviews Tab:**
   - Verify reviews list
   - Try filtering/searching
8. **Test Bulk Actions:**
   - Select multiple items
   - Perform bulk action
   - Verify undo option appears (30s timer)
9. **Test Persistence:**
   - Change active tab
   - Refresh page → tab should persist
   - Set filters
   - Refresh page → filters should persist
10. **Test Refresh Controls:**
    - Click "Refresh Now" button
    - Verify data updates
    - Check auto-refresh toggle
    - Set to enabled, wait 30s → data should auto-refresh
11. **Test Export:**
    - Click CSV export on appropriate tab
    - Verify file downloads
    - Check "Export filtered only" toggle works
12. **Test Reset Button:**
    - Click "Reset Saved Preferences"
    - Verify filters cleared
    - Verify tab resets to default
    - Verify toggles reset to default

**Results:**
- [ ] KPI cards display correct data
- [ ] All tabs load and render
- [ ] Filters work per tab
- [ ] Bulk actions execute
- [ ] Inline OTP entry works
- [ ] CSV export downloads
- [ ] Persistence (tab/filters) works after refresh
- [ ] Auto-refresh toggles work
- [ ] Reset preferences clears state
- [ ] No console errors

---

### Test 14: My Medicines Page (`/my-medicines`)
**Steps:**
1. Log in as seller, navigate to /my-medicines
2. Verify seller's medicines listed with:
   - Medicine name, price, stock, Rx/OTC type
   - Edit, Delete buttons
3. Try editing a medicine:
   - Update price
   - Update stock
   - Save
   - Verify changes reflected
4. Try deleting a medicine (may require confirmation)
5. Try adding a new medicine (if button present):
   - Fill form with name, price, dosage, shop
   - Submit
   - Verify added to list
6. Search/filter medicines by name

**Results:**
- [ ] Medicines list displays
- [ ] Edit works
- [ ] Delete works
- [ ] Add new works (if available)
- [ ] Changes persist

---

## PHASE 4: UTILITY PAGES

### Test 15: Notifications Page (`/notifications`)
**Steps:**
1. Navigate to /notifications
2. Verify notifications list displays
3. Each notification shows:
   - Message/title
   - Date/time
   - Read/unread status
4. Try marking as read (if button present)
5. Try clearing old notifications (if button present)

**Results:**
- [ ] Notifications display
- [ ] Mark as read works
- [ ] Clear notifications works

---

## PHASE 5: CROSS-PAGE FUNCTIONALITY

### Test 16: Navigation & Routing
**Steps:**
1. Test navbar links:
   - Click Home → verify navigate to /home
   - Click Search → verify navigate to /search
   - Click Cart → verify navigate to /cart
   - Click Wishlist → verify navigate to /wishlist
   - Click Profile → verify navigate to /profile
2. Test logout:
   - Click logout in profile menu
   - Verify token removed from localStorage
   - Verify redirected to /login
3. Test back button navigation across pages
4. Test direct URL navigation (type path in address bar)

**Results:**
- [ ] All navbar links navigate correctly
- [ ] Logout clears token and redirects
- [ ] Back button works
- [ ] Direct URL navigation works

---

### Test 17: Error Handling
**Steps:**
1. Navigate to non-existent page (e.g., /nonexistent)
   - Should show 404 or redirect to home
2. Try accessing seller pages as buyer
   - Should show 403 or redirect to profile
3. Check browser console for JavaScript errors
   - Should have no red errors
4. Try network errors:
   - Simulate offline mode (DevTools)
   - Try clicking buttons
   - Should show error message or graceful handling

**Results:**
- [ ] 404 handling correct
- [ ] Role-based access works
- [ ] No critical console errors
- [ ] Offline handling graceful

---

### Test 18: Responsive Design
**Steps:**
1. Resize browser to mobile (375px width)
2. Verify pages still readable
3. Verify navbar collapses to mobile menu
4. Verify buttons/forms accessible on mobile
5. Try one complete flow on mobile (login → search → cart → order)
6. Resize to tablet (768px) and verify layout
7. Resize to desktop (1920px) and verify layout

**Results:**
- [ ] Mobile layout works
- [ ] Tablet layout works
- [ ] Desktop layout works
- [ ] No text overflow/broken elements

---

## SUMMARY

Total Tests: 18 categories

**Automated Tests Results:**
- ✅ Login.test.jsx: PASS
- ✅ Signup.test.jsx: PASS
- ✅ Cart.test.jsx: PASS
- ✅ Orders.test.jsx: PASS

**Manual Tests Results:**
| Category | Status | Notes |
|----------|--------|-------|
| 1. Login | [ ] | |
| 2. Signup | [ ] | |
| 3. Forgot Password | [ ] | |
| 4. Forgot Username | [ ] | |
| 5. Shop Register | [ ] | |
| 6. Home | [ ] | |
| 7. Search | [ ] | |
| 8. Medicine Details | [ ] | |
| 9. Cart | [ ] | |
| 10. Orders | [ ] | |
| 11. Wishlist | [ ] | |
| 12. Profile | [ ] | |
| 13. SellerOperations | [ ] | |
| 14. My Medicines | [ ] | |
| 15. Notifications | [ ] | |
| 16. Navigation | [ ] | |
| 17. Error Handling | [ ] | |
| 18. Responsive Design | [ ] | |

**Issues Found:**
- [ ] Issue 1: _______________
- [ ] Issue 2: _______________
- [ ] Issue 3: _______________

---

## Notes
- Backend API: http://127.0.0.1:8000/api
- Test user credentials available in backend/api/tests.py or create via signup
- Use browser DevTools (F12) to check console for errors
- Automated tests already validate core functionality; manual tests verify UX/flow

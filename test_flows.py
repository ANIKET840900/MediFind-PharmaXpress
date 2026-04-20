#!/usr/bin/env python
"""
End-to-end test script for medicine platform
Tests: Signup → Login → Browse → Cart → Checkout → Orders → Auth Recovery
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000/api"
TEST_USER_EMAIL = f"testuser_{datetime.now().strftime('%H%M%S')}@example.com"
TEST_USERNAME = f"testuser_{datetime.now().strftime('%H%M%S')}"
TEST_PASSWORD = "TestPass123!"

class TestRunner:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.cart_items = []
        
    def print_section(self, title):
        print(f"\n{'='*60}")
        print(f"  {title}")
        print(f"{'='*60}")
    
    def print_test(self, name, result, details=""):
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status} | {name}")
        if details:
            print(f"        {details}")
    
    def test_signup(self):
        """Test user registration"""
        self.print_section("1. SIGNUP FLOW")
        
        payload = {
            "username": TEST_USERNAME,
            "email": TEST_USER_EMAIL,
            "password": TEST_PASSWORD,
            "first_name": "Test",
            "last_name": "User"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/auth/signup/", json=payload)
            success = response.status_code in [200, 201]
            self.print_test("Signup endpoint accessible", response.status_code < 500)
            
            if success:
                data = response.json()
                self.token = data.get("token")
                self.user_id = data.get("user_id") or data.get("user", {}).get("id")
                self.print_test("User created successfully", True, f"Token: {self.token[:20]}...")
                self.print_test("Auth token received", bool(self.token))
                return True
            else:
                self.print_test("Registration failed", False, f"Status: {response.status_code}")
                print(f"        Response: {response.text}")
                return False
        except Exception as e:
            self.print_test("Signup request failed", False, str(e))
            return False
    
    def test_login(self):
        """Test user authentication"""
        self.print_section("2. LOGIN FLOW")
        
        payload = {
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD
        }
        
        try:
            response = requests.post(f"{BASE_URL}/auth/login/", json=payload)
            success = response.status_code == 200
            self.print_test("Login endpoint accessible", response.status_code < 500)
            
            if success:
                data = response.json()
                self.token = data.get("token")
                self.user_id = data.get("user_id") or data.get("user", {}).get("id")
                self.print_test("User authenticated", True)
                self.print_test("Auth token present", bool(self.token), f"Token: {self.token[:20]}...")
                return True
            else:
                self.print_test("Login failed", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.print_test("Login request failed", False, str(e))
            return False
    
    def test_medicines(self):
        """Test fetching medicines"""
        self.print_section("3. BROWSE MEDICINES")
        
        headers = {} if not self.token else {"Authorization": f"Token {self.token}"}
        
        try:
            response = requests.get(f"{BASE_URL}/medicines/", headers=headers)
            success = response.status_code == 200
            self.print_test("Medicines endpoint accessible", response.status_code < 500)
            
            if success:
                data = response.json()
                medicines = data.get("results", [])
                self.print_test("Medicines retrieved", len(medicines) > 0, f"Found {len(medicines)} medicines")
                
                if medicines:
                    first_med = medicines[0]
                    print(f"        Sample: {first_med.get('name')} - ₹{first_med.get('price')}")
                return True
            else:
                self.print_test("Failed to fetch medicines", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.print_test("Medicines request failed", False, str(e))
            return False
    
    def test_cart(self):
        """Test cart operations"""
        self.print_section("4. CART OPERATIONS")
        
        if not self.token:
            self.print_test("Cart test skipped", False, "Not authenticated")
            return False
        
        headers = {"Authorization": f"Token {self.token}"}
        self.cart_items = []  # Store cart items for order creation
        
        try:
            # Get first medicine
            response = requests.get(f"{BASE_URL}/medicines/", headers=headers)
            medicines = response.json().get("results", [])
            
            if not medicines:
                self.print_test("No medicines available", False)
                return False
            
            medicine_id = medicines[0]["id"]
            
            # Add to cart
            cart_payload = {"medicine": medicine_id, "quantity": 2}
            response = requests.post(f"{BASE_URL}/cart/", json=cart_payload, headers=headers)
            success = response.status_code in [200, 201]
            self.print_test("Add to cart", success, f"Medicine {medicine_id}, Qty: 2")
            
            # Fetch cart
            response = requests.get(f"{BASE_URL}/cart/", headers=headers)
            success = response.status_code == 200
            
            # Handle both paginated and non-paginated responses
            data = response.json()
            if isinstance(data, dict):
                cart_items = data.get("results", [])
            else:
                cart_items = data
            
            self.cart_items = [item["id"] for item in cart_items]
            self.print_test("Fetch cart", success, f"Cart items: {len(cart_items)}")
            
            return success
        except Exception as e:
            self.print_test("Cart operation failed", False, str(e))
            return False
    
    def test_checkout(self):
        """Test order checkout"""
        self.print_section("5. CHECKOUT & ORDERS")
        
        if not self.token:
            self.print_test("Checkout test skipped", False, "Not authenticated")
            return False
        
        if not self.cart_items:
            self.print_test("Checkout test skipped", False, "No cart items available")
            return False
        
        headers = {"Authorization": f"Token {self.token}"}
        
        try:
            # Create order with cart items
            order_payload = {
                "items": self.cart_items,
                "delivery_address": "123 Test Street",
                "city": "Test City",
                "pincode": "123456",
                "mobile_number": "9876543210",
                "house_number": "Apt 101"
            }
            response = requests.post(f"{BASE_URL}/orders/", json=order_payload, headers=headers)
            success = response.status_code in [200, 201]
            self.print_test("Create order", success, f"Status: {response.status_code}")
            
            if not success:
                print(f"        Error: {response.text}")
            else:
                order = response.json()
                order_id = order.get("id")
                print(f"        Order ID: {order_id}")
            
            # Fetch orders
            response = requests.get(f"{BASE_URL}/orders/", headers=headers)
            success = response.status_code == 200
            
            # Handle both paginated and non-paginated responses
            data = response.json()
            if isinstance(data, dict):
                orders = data.get("results", [])
            else:
                orders = data
            
            self.print_test("Fetch orders", success, f"Orders count: {len(orders)}")
            
            return success
        except Exception as e:
            self.print_test("Checkout failed", False, str(e))
            return False
    
    def test_forgot_username(self):
        """Test forgot username recovery"""
        self.print_section("6. AUTH RECOVERY - FORGOT USERNAME")
        
        payload = {"email": TEST_USER_EMAIL}
        
        try:
            response = requests.post(f"{BASE_URL}/auth/forgot-username/", json=payload)
            success = response.status_code == 200
            self.print_test("Forgot username endpoint", response.status_code < 500)
            
            if success:
                data = response.json()
                recovered_username = data.get("username") or (data.get("usernames", [None])[0] if data.get("usernames") else None)
                self.print_test("Username recovered", bool(recovered_username), f"Username: {recovered_username}")
                return True
            else:
                self.print_test("Username recovery failed", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.print_test("Forgot username request failed", False, str(e))
            return False
    
    def test_forgot_password(self):
        """Test forgot password recovery"""
        self.print_section("7. AUTH RECOVERY - FORGOT PASSWORD")
        
        payload = {
            "username": TEST_USERNAME,
            "email": TEST_USER_EMAIL,
            "new_password": "NewPass123!"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/auth/forgot-password/", json=payload)
            success = response.status_code == 200
            self.print_test("Forgot password endpoint", response.status_code < 500)
            
            if success:
                data = response.json()
                message = data.get("message")
                self.print_test("Password reset", True, message if message else "Password updated")
                return True
            else:
                self.print_test("Password reset failed", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.print_test("Forgot password request failed", False, str(e))
            return False
    
    def test_logout(self):
        """Test logout"""
        self.print_section("8. LOGOUT")
        
        if not self.token:
            self.print_test("Logout test skipped", False, "Not authenticated")
            return False
        
        headers = {"Authorization": f"Token {self.token}"}
        
        try:
            response = requests.post(f"{BASE_URL}/auth/logout/", headers=headers)
            success = response.status_code == 200
            self.print_test("Logout endpoint", response.status_code < 500)
            
            if success:
                self.print_test("User logged out", True)
                self.token = None
                return True
            else:
                self.print_test("Logout failed", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.print_test("Logout request failed", False, str(e))
            return False
    
    def run_all_tests(self):
        """Run complete test suite"""
        print("\n" + "="*60)
        print("  MEDICINE PLATFORM - END-TO-END TEST SUITE")
        print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        print("="*60)
        
        results = []
        
        # Core flows - user workflow
        results.append(("Signup", self.test_signup()))
        results.append(("Login", self.test_login()))
        results.append(("Browse Medicines", self.test_medicines()))
        results.append(("Cart", self.test_cart()))
        results.append(("Checkout & Orders", self.test_checkout()))
        
        # Logout before password reset (which invalidates tokens)
        results.append(("Logout", self.test_logout()))
        
        # Auth recovery tests (use new user or fresh credentials)
        results.append(("Forgot Username", self.test_forgot_username()))
        results.append(("Forgot Password", self.test_forgot_password()))
        
        # Summary
        self.print_section("TEST SUMMARY")
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = "✓" if result else "✗"
            print(f"{status} {test_name}")
        
        print(f"\nTotal: {passed}/{total} passed ({100*passed//total}%)")
        print("="*60 + "\n")
        
        return passed == total

if __name__ == "__main__":
    runner = TestRunner()
    all_passed = runner.run_all_tests()
    exit(0 if all_passed else 1)

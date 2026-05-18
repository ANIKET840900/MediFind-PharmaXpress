# Backend Setup & Dependencies Guide

## Quick Start

### 1. Navigate to Backend Directory
```bash
cd spring-backend
```

### 2. Ensure Java is Set Up
```bash
# Verify Java 17 is available
java -version
```

### 3. Run Backend
```bash
# Set JAVA_HOME and run
$env:JAVA_HOME = "$env:USERPROFILE\.local\jdk\jdk-17.0.19+10"
mvn spring-boot:run
```

The backend will start at **http://localhost:8080**

---

## Project Dependencies Overview

### Maven Dependencies

#### Spring Boot Framework (3.4.5)
**Parent Framework**:
- `spring-boot-starter-parent:3.4.5`
- Auto-configuration of Spring components
- Embedded Tomcat application server
- Simplified dependency management

#### Spring Web (`spring-boot-starter-web`)
- **Purpose**: RESTful API development
- **Includes**: Spring MVC, Tomcat servlet container, Jackson JSON processor
- **Used For**: HTTP endpoints, request/response handling

#### Spring Data JPA (`spring-boot-starter-data-jpa`)
- **Purpose**: Object-Relational Mapping (ORM)
- **Provides**: Hibernate ORM, JPA abstraction layer
- **Version**: 6.6.13.Final
- **Used For**: Database entity management, query generation
- **Features**:
  - Automatic SQL generation
  - Repository pattern implementation
  - Transaction management

#### Spring Security (`spring-boot-starter-security`)
- **Purpose**: Authentication and authorization
- **Features**:
  - Token-based authentication (custom implementation)
  - CORS configuration
  - Security filters
  - Password encryption (BCrypt)
- **Used For**:
  - User authentication (login/signup)
  - Protected API endpoints
  - Authorization checks

#### H2 Database (`com.h2database:h2`)
- **Purpose**: Embedded SQL database
- **Type**: In-memory + file persistence
- **Location**: `./data/pharmaxpress`
- **Console**: http://localhost:8080/h2-console
- **Features**:
  - Zero configuration
  - SQL standard support
  - Transaction support
- **Used For**: Data storage (medicines, orders, users, etc.)

#### Lombok (`org.projectlombok:lombok`)
- **Purpose**: Reduce boilerplate Java code
- **Features**:
  - `@Data` - auto-generates getters, setters, equals, hashCode, toString
  - `@RequiredArgsConstructor` - constructor with final fields
  - `@Slf4j` - automatic logger injection
- **Used For**: Model classes, service classes, controllers

#### Spring Boot Validation (`spring-boot-starter-validation`)
- **Purpose**: Bean validation and constraint checking
- **Features**: JSR-303/JSR-380 annotations
- **Used For**: Input validation on endpoints

#### Spring Boot Test (`spring-boot-starter-test`)
- **Purpose**: Testing framework
- **Includes**: JUnit 5, Mockito, AssertJ
- **Used For**: Unit and integration tests

---

## Application Configuration

### Configuration Files

#### `application.yml`
Location: `src/main/resources/application.yml`

```yaml
# Server Configuration
server:
  port: 8080
  servlet:
    context-path: /

# Spring Profile
spring:
  profiles:
    active: default

# Database Configuration
  datasource:
    url: jdbc:h2:file:./data/pharmaxpress
    driver-class-name: org.h2.Driver
    username: sa
    password: 

# JPA/Hibernate
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false

# H2 Console
  h2:
    console:
      enabled: true
      path: /h2-console
```

### Security Configuration

#### `CorsConfig.java`
- Enables Cross-Origin Resource Sharing
- Allows requests from frontend
- Configured headers: Authorization, Content-Type, Accept

#### `SecurityConfig.java`
- Stateless session management
- Token-based authentication
- Public endpoints: `/api/auth/**`, `/api/health`, `/h2-console/**`
- Protected endpoints: All other `/api/**` routes

#### `WebConfig.java`
- Static resource serving (uploads)
- HTTP message converters
- Request/response formatting

---

## Architecture & Components

### Controllers (REST Endpoints)

#### `AuthController` (`/api/auth`)
- **Endpoints**:
  - POST `/signup/` - User registration
  - POST `/login/` - User authentication
  - POST `/forgot-username/` - Username recovery
  - POST `/forgot-password/` - Password reset
  - GET `/profile/` - User profile info
  - PATCH `/profile/` - Update profile
  - GET `/me/` - Current user info

#### `CatalogController` (`/api`)
- **Endpoints**:
  - GET `/shops/` - List all shops
  - POST `/shops/` - Create shop
  - GET `/shops/{id}/` - Get shop details
  - GET `/medicines/` - List medicines
  - POST `/medicines/` - Add medicine (seller)
  - GET `/medicines/{id}/` - Get medicine details
  - PATCH `/medicines/{id}/` - Update medicine
  - DELETE `/medicines/{id}/` - Delete medicine
  - GET `/medicines/suggestions/` - Search suggestions

#### `CommerceController` (`/api`)
- **Endpoints**:
  - GET `/cart/` - View cart
  - POST `/cart/` - Add to cart
  - PATCH `/cart/{id}/` - Update cart item
  - DELETE `/cart/{id}/` - Remove from cart
  - POST `/orders/` - Create order
  - GET `/orders/` - List user orders
  - POST `/orders/{id}/cancel/` - Cancel order
  - POST `/returns/` - Request return
  - POST `/wishlist/` - Add to wishlist
  - GET `/wishlist/` - View wishlist

#### `PaymentController` (`/api`)
- **Endpoints**:
  - POST `/payments/initialize/` - Initialize payment
  - POST `/payments/{id}/confirm/` - Confirm payment
  - GET `/payments/` - Payment history
  - GET `/payments/{id}/history/` - Payment details
  - GET `/payments/reconcile/` - Reconciliation runs
  - POST `/payments/reconcile/` - Trigger reconciliation
  - POST `/webhooks/payment/` - Payment webhook handler

#### `EngagementController` (`/api`)
- **Endpoints**:
  - POST `/reviews/` - Create review
  - GET `/reviews/` - List reviews
  - POST `/prescriptions/` - Upload prescription
  - GET `/prescriptions/` - List prescriptions
  - POST `/returns/` - Create return request
  - GET `/notifications/` - List notifications
  - POST `/notifications/mark-read/` - Mark as read

#### `HealthController` (`/api`)
- **Endpoints**:
  - GET `/health` - Application health check

### Models (Database Entities)

#### User Management
- `UserAccount` - User credentials and basic info
- `UserProfile` - Extended user information
- `UserRole` - Role-based access control
- `AuthToken` - Authentication tokens

#### Catalog
- `Medicine` - Product information
- `Shop` - Seller store information
- `Review` - User product reviews
- `ReviewModerationStatus` - Review approval status

#### Commerce
- `CartItem` - Shopping cart items
- `Order` - Customer purchases
- `OrderItem` - Items in an order
- `OrderStatus` - Order state (pending, confirmed, delivered, etc.)
- `WishlistItem` - Favorite medicines

#### Prescription & Returns
- `Prescription` - Medical prescriptions
- `PrescriptionStatus` - Prescription state
- `ReturnRequest` - Return requests
- `ReturnRequestStatus` - Return state

#### Payments
- `PaymentTransaction` - Payment records
- `PaymentStatus` - Payment state
- `PaymentReconciliationRun` - Automated reconciliation
- `PaymentWebhookEvent` - Webhook events for payments
- `FraudRiskEvent` - Fraud detection records

#### Notifications
- `Notification` - User notifications

### Repositories (Data Access)

16 JPA repositories configured for database operations:
- UserAccountRepository
- UserProfileRepository
- AuthTokenRepository
- MedicineRepository
- ShopRepository
- CartItemRepository
- OrderRepository
- OrderItemRepository
- ReviewRepository
- PrescriptionRepository
- NotificationRepository
- PaymentTransactionRepository
- PaymentReconciliationRunRepository
- PaymentWebhookEventRepository
- ReturnRequestRepository
- WishlistItemRepository

### Services (Business Logic)

- `AuthService` - User authentication and registration
- Custom validation and authorization services
- Transaction management
- Email/notification sending (if configured)

### Security Components

#### `TokenService`
- Creates tokens for authenticated users
- Resolves users from tokens
- Manages token expiration (30 days)
- Revokes user tokens

#### `TokenAuthenticationFilter`
- Intercepts HTTP requests
- Extracts token from Authorization header
- Validates token format (Token | Bearer prefix)
- Sets security context for authenticated requests

#### `UserPrincipal`
- Custom Spring Security Principal
- Contains user information and authorities
- Used for authorization checks

---

## Database Schema

### H2 Database Setup
- **File-based Storage**: `./data/pharmaxpress`
- **URL**: `jdbc:h2:file:./data/pharmaxpress`
- **Username**: SA
- **Password**: (empty)
- **Console**: http://localhost:8080/h2-console

### Auto-generated Tables
Hibernate automatically creates tables based on entity definitions:
- USERS (UserAccount)
- USER_PROFILES
- AUTH_TOKENS
- MEDICINES
- SHOPS
- ORDERS
- ORDER_ITEMS
- CART_ITEMS
- REVIEWS
- PRESCRIPTIONS
- NOTIFICATIONS
- PAYMENT_TRANSACTIONS
- WISHLIST_ITEMS
- RETURN_REQUESTS
- ... (and more)

---

## Authentication & Authorization

### Token Format
```
Authorization: Token {uuid_without_hyphens}
```

Example:
```
Authorization: Token a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```

### Alternative Format (Also Supported)
```
Authorization: Bearer {uuid_without_hyphens}
```

### Token Lifecycle
1. **Creation**: Login/signup returns new token
2. **Storage**: Token saved in AuthToken table
3. **Validation**: Token checked on protected endpoints
4. **Expiration**: 30 days from creation
5. **Revocation**: User logout clears all tokens

### Authorization Levels
- **Anonymous**: `/auth/login`, `/auth/signup`, `/auth/forgot-*`
- **Authenticated User**: All protected endpoints
- **Seller**: Can manage own medicines and shop
- **Admin**: Full access (if role configured)

---

## Build & Compilation

### Maven Build Lifecycle

#### Commands
```bash
# Full build with tests
mvn clean test

# Build without tests
mvn clean compile

# Run application
mvn spring-boot:run

# Package JAR
mvn clean package

# Skip tests
mvn -q -DskipTests compile
```

### Compilation Process
1. Clean previous build artifacts
2. Download dependencies from Maven Central
3. Compile Java source files (javac)
4. Process Lombok annotations
5. Generate bytecode
6. Package into JAR or WAR
7. Run Spring Boot auto-configuration

### Key Build Details
- **Java Compiler**: Target Java 17
- **Annotation Processor**: Lombok code generation
- **Test Runner**: JUnit 5
- **Packaging**: Embedded JAR with Tomcat

---

## Running the Application

### Prerequisites
- Java 17 JDK (not just JRE)
- Maven 3.9.9+
- Port 8080 available

### Startup Process
```bash
# 1. Set environment variable
$env:JAVA_HOME = "C:\Users\anike\.local\jdk\jdk-17.0.19+10"

# 2. Navigate to backend
cd spring-backend

# 3. Run Maven
mvn spring-boot:run
```

### Startup Logs
- Spring Boot banner displays
- Spring version confirmed
- Repositories loaded
- H2 database connected
- Hibernate initialized
- Tomcat started on port 8080
- Application ready message

---

## Important Endpoints

### Health Check
```
GET http://localhost:8080/api/health
```

### H2 Console
```
http://localhost:8080/h2-console
```
Use this to browse and manage the database directly during development.

---

## Environment & Configuration

### Runtime Environment
- **JVM**: Java 17.0.19 (Eclipse Adoptium)
- **Memory**: Default heap size
- **Threads**: Spring managed thread pools
- **Timezone**: System default

### Embedded Components
- **Tomcat**: 10.1.40
- **Hibernate**: 6.6.13.Final
- **Spring Framework**: 6.x (managed by Spring Boot)
- **Jackson**: Latest (JSON serialization)

---

## Troubleshooting

### Cannot compile: "javac not found"
- Ensure JAVA_HOME is set to JDK (not JRE)
- JDK must have bin/javac.exe executable

### Port 8080 already in use
Change port in `application.yml`:
```yaml
server:
  port: 8081
```

### Database locked
- Ensure only one instance is running
- Delete `./data/pharmaxpress.lock` file if needed

### Authentication fails
- Check AuthToken table in H2 console
- Verify token hasn't expired (30 days)
- Ensure Authorization header format is correct

---

## Performance Considerations

1. **H2 Database**: Single-threaded, suitable for development
2. **In-memory Caching**: Not configured (can add Redis)
3. **Connection Pooling**: HikariCP (Spring Data default)
4. **Entity Eager Loading**: Review lazy loading strategies

---

## Security Best Practices

1. ✅ BCrypt password encoding
2. ✅ Stateless authentication
3. ✅ CORS configured
4. ✅ Token expiration (30 days)
5. ✅ No password logging
6. ✅ Authorization checks on endpoints

---

## Next Steps

1. Verify backend is running: `mvn spring-boot:run`
2. Check H2 console: http://localhost:8080/h2-console
3. Test API endpoints with Postman or curl
4. Start frontend: `npm start` in frontend directory
5. Test full integration with login → purchase flow

---

**Last Updated**: May 13, 2026  
**Status**: ✅ Running on http://localhost:8080

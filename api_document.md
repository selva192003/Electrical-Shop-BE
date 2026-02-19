# Electrical Shop Backend API Documentation

Base URL (development): `http://localhost:5000/api`

---

## Authentication & Authorization

- Authentication: JWT in `Authorization` header
  - `Authorization: Bearer <token>`
- Roles:
  - `user` (default)
  - `admin` (extra admin-only routes)

---

## 1. User APIs

### 1.1 Register
- **POST** `/users/register`
- **Body (JSON)**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```
- **Response**: `201 Created`
```json
{
  "message": "User registered successfully",
  "token": "<jwt>",
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### 1.2 Login (Email & Password)
- **POST** `/users/login`
- **Body**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```
- **Response**: `200 OK` with JWT and user info.

### 1.3 Login with Google
- **POST** `/users/google-login`
- **Body**
```json
{
  "token": "<GOOGLE_ID_TOKEN_FROM_FRONTEND>"
}
```
- Verifies Google ID token, creates/links user, returns JWT.

### 1.4 Forgot Password
- **POST** `/users/forgot-password`
- **Body**
```json
{
  "email": "john@example.com"
}
```
- Sends reset link to email (based on `CLIENT_URL`).

### 1.5 Reset Password
- **POST** `/users/reset-password/:token`
- **Body**
```json
{
  "password": "newPassword123"
}
```

### 1.6 Get Profile (Auth)
- **GET** `/users/profile`
- **Headers**: `Authorization: Bearer <token>`

### 1.7 Update Profile (Auth)
- **PUT** `/users/profile`
- **Body** (any subset)
```json
{
  "name": "New Name",
  "email": "new@example.com",
  "password": "optionalNewPassword"
}
```

### 1.8 Address Management (Auth)

**Get addresses**
- **GET** `/users/addresses`

**Add address**
- **POST** `/users/addresses`
- **Body**
```json
{
  "fullName": "John Doe",
  "phone": "9876543210",
  "addressLine1": "Street 1",
  "addressLine2": "Apt 2",
  "city": "City",
  "state": "State",
  "postalCode": "600001",
  "country": "India",
  "isDefault": true
}
```

**Update address**
- **PUT** `/users/addresses/:addressId`

**Delete address**
- **DELETE** `/users/addresses/:addressId`

**Set default address**
- **PATCH** `/users/addresses/:addressId/default`

### 1.9 Admin User Management (Admin)
- **GET** `/users` – list all users
- **PATCH** `/users/:id/block` – block a user
- **PATCH** `/users/:id/unblock` – unblock a user

Headers: `Authorization: Bearer <admin_jwt>`

---

## 2. Category & Product APIs

### 2.1 Categories

**Get all categories**
- **GET** `/products/categories`

**Create category (Admin)**
- **POST** `/products/categories`
- **Body**
```json
{
  "name": "LED Bulbs",
  "slug": "led-bulbs",
  "description": "All LED bulbs"
}
```

### 2.2 Products

**Get products (list)**
- **GET** `/products`
- **Query params** (optional):
  - `page` (default 1)
  - `limit` (default 10)
  - `keyword` (text search on name, description, brand)
  - `category` (category ObjectId)
  - `brand`
  - `minPrice`, `maxPrice`
  - `featured` (true/false)
  - `sort` (`price_asc`, `price_desc`, `rating`)

**Response**
```json
{
  "products": [...],
  "page": 1,
  "limit": 10,
  "total": 100,
  "totalPages": 10
}
```

**Get featured products**
- **GET** `/products/featured?limit=8`

**Get single product**
- **GET** `/products/:id`

**Create product (Admin)**
- **POST** `/products`
- **Headers**: `Authorization: Bearer <admin_jwt>`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `name` (string, required)
  - `description` (string, required)
  - `price` (number, required)
  - `category` (Category ObjectId, required)
  - `stock` (number, required)
  - `brand` (string, required)
  - `variants` (JSON string, optional)
  - `featured` (boolean, optional)
  - `images` (up to 5 files)

**Update product (Admin)**
- **PUT** `/products/:id` (same fields as create; partial allowed)

**Delete product (Admin)**
- **DELETE** `/products/:id`

---

## 3. Cart APIs (User)

Headers: `Authorization: Bearer <token>`

**Get cart**
- **GET** `/cart`

**Add to cart**
- **POST** `/cart/add`
- **Body**
```json
{
  "productId": "<product_object_id>",
  "quantity": 2,
  "variant": {
    "watt": "15W",
    "voltage": "220V",
    "brand": "Philips"
  }
}
```

**Update cart item quantity**
- **PUT** `/cart/item/:itemId`
- **Body**
```json
{
  "quantity": 3
}
```

**Remove cart item**
- **DELETE** `/cart/item/:itemId`

**Clear cart**
- **DELETE** `/cart/clear`

---

## 4. Order APIs

### 4.1 Create Order (from cart or direct)
- **POST** `/orders`
- **Headers**: `Authorization: Bearer <token>`
- **Body (from cart)**
```json
{
  "fromCart": true,
  "shippingAddress": {
    "fullName": "John Doe",
    "phone": "9876543210",
    "addressLine1": "Street 1",
    "city": "City",
    "state": "State",
    "postalCode": "600001",
    "country": "India"
  }
}
```

- **Body (direct items)**
```json
{
  "fromCart": false,
  "orderItems": [
    {
      "product": "<product_id>",
      "name": "LED Bulb",
      "quantity": 2,
      "price": 150,
      "image": "https://..."
    }
  ],
  "shippingAddress": { ... },
  "totalPrice": 300
}
```

### 4.2 Get My Orders
- **GET** `/orders/my`

### 4.3 Get Single Order (owner or admin)
- **GET** `/orders/:id`

### 4.4 Admin: Get All Orders
- **GET** `/orders`
- **Headers**: `Authorization: Bearer <admin_jwt>`

### 4.5 Admin: Update Order Status
- **PATCH** `/orders/:id/status`
- **Body**
```json
{
  "status": "Confirmed"  // One of: Pending, Confirmed, Packed, Shipped, Out for Delivery, Delivered, Cancelled
}
```

---

## 5. Payment APIs (Razorpay)

Headers: `Authorization: Bearer <token>`

### 5.1 Create Razorpay Order
- **POST** `/payments/create-order`
- **Body**
```json
{
  "orderId": "<order_object_id>"
}
```
- **Response**
```json
{
  "key": "<RAZORPAY_KEY_ID>",
  "orderId": "order_xyz",
  "amount": 12345,
  "currency": "INR",
  "paymentId": "<payment_db_id>"
}
```

### 5.2 Verify Payment
- **POST** `/payments/verify`
- **Body** (from Razorpay checkout success)
```json
{
  "razorpay_order_id": "order_xyz",
  "razorpay_payment_id": "pay_abc",
  "razorpay_signature": "..."
}
```
- On success: marks `Payment` as captured, sets order `isPaid=true`, updates `orderStatus` to `Confirmed`, and reduces product stock.

If Razorpay is not configured on the server, these endpoints respond with `503 Service Unavailable`.

---

## 6. Review APIs

Headers: `Authorization: Bearer <token>`

### 6.1 Add or Update Review (only if purchased)
- **POST** `/reviews/:productId`
- **Body**
```json
{
  "rating": 5,
  "comment": "Great product!"
}
```
- If a review already exists for that user+product, it is updated.

### 6.2 Edit Review
- **PUT** `/reviews/:reviewId`

### 6.3 Delete Review
- **DELETE** `/reviews/:reviewId`
- Allowed for review owner or admin.

### 6.4 Admin Reply to Review
- **POST** `/reviews/:reviewId/reply`
- **Headers**: `Authorization: Bearer <admin_jwt>`
- **Body**
```json
{
  "message": "Thank you for your feedback!"
}
```

---

## 7. Dashboard Analytics (Admin)

Headers: `Authorization: Bearer <admin_jwt>`

### 7.1 Get Summary
- **GET** `/dashboard/summary`
- **Response**
```json
{
  "totalUsers": 120,
  "totalRevenue": 54321,
  "monthlySales": [
    {
      "_id": { "year": 2026, "month": 1 },
      "totalSales": 10000,
      "count": 20
    }
  ],
  "topProducts": [
    {
      "_id": "<product_id>",
      "totalQuantity": 50,
      "revenue": 15000
    }
  ],
  "orderStatusBreakdown": [
    { "_id": "Pending", "count": 5 },
    { "_id": "Delivered", "count": 40 }
  ]
}
```

---

## 8. Health Check

- **GET** `/health`
- **Response**
```json
{
  "status": "ok",
  "timestamp": "2026-02-19T...Z"
}
```

---

## 9. Error Format

All errors are returned in a consistent JSON format from the centralized error handler:

```json
{
  "message": "Error message here",
  "stack": "..." // omitted in production
}
```

Use HTTP status codes appropriately (400, 401, 403, 404, 500, etc.) as returned by the API.

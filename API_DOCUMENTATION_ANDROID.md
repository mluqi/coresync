# 📱 Dokumentasi Resmi REST API CoreSync (Mobile / Android / Flutter)

Dokumentasi ini disusun sebagai panduan integrasi aplikasi **Mobile CoreSync (Android / iOS / Flutter)** untuk modul **Salesman Taking Order (TO), Cek Harga & Stok, Pengiriman Driver, Pelunasan Tagihan Lapangan, Notifikasi Badge Counter, serta Autentikasi Single-Device Session**.

---

## 🌐 1. Konfigurasi Server & Header

### Base URL
* **Production API**: `https://api-jatimas.luckysdev.com/api`
* **Local Development**: `http://10.0.2.2:8000/api` *(Emulator Android)* atau `http://localhost:8000/api`
* **Static / Image Uploads Host**: `https://api-jatimas.luckysdev.com`

### Standar Header Permintaan (Request Headers)
Semua endpoint setelah login **wajib** menyertakan token JWT:

```http
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
X-Tenant-ID: 1
```

> **Catatan Header Gambar / Multipart:**  
> Untuk endpoint upload gambar (misal upload bukti transfer / foto terima barang), gunakan `Content-Type: multipart/form-data`.

---

## 🔑 2. Modul Autentikasi (Authentication & Single-Device Session)

CoreSync ERP menerapkan mekanisme **Single-Device Session** (1 akun hanya bisa aktif di 1 perangkat pada satu waktu). Jika user login di perangkat baru, token di perangkat lama otomatis dinonaktifkan di server.

### A. Login Pengguna (Sales / Driver / Admin)
Digunakan saat user membuka aplikasi untuk autentikasi dan mendapatkan token.

* **Method & URL**: `POST /auth/login`
* **Auth**: `Public` (Tanpa Token)
* **Request Body**:
```json
{
  "email": "yuli@jatimas.com",
  "password": "password123"
}
```

* **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 5,
    "name": "Yulianto",
    "email": "yuli@jatimas.com",
    "role": "SALES",
    "taxAccess": "ALL",
    "salespersonId": 11
  },
  "tenant": {
    "id": 1,
    "companyName": "CV. JATIMAS",
    "subdomain": "jatimas"
  }
}
```

---

### B. Cek Sesi / Auto-Login (`Me`)
Digunakan saat aplikasi dibuka kembali (splash screen) untuk memastikan token masih aktif dan mencocokkan dengan database.

* **Method & URL**: `GET /auth/me`
* **Auth**: `Bearer <token>`
* **Response `200 OK`**:
```json
{
  "success": true,
  "user": {
    "id": 5,
    "name": "Yulianto",
    "email": "yuli@jatimas.com",
    "role": "SALES"
  }
}
```

---

### C. Logout Pengguna (`Logout`)
Menghapus sesi aktif di database server sehingga token tidak dapat digunakan kembali.

* **Method & URL**: `POST /auth/logout`
* **Auth**: `Bearer <token>`
* **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Logout berhasil."
}
```

---

### ⚠️ Penanganan Error Sesi (HTTP `401 Unauthorized`)
Jika request API mengembalikan status `401`, periksa kode `code` pada JSON response:

| Error `code` | Penyebab | Tindakan Mobile App |
|---|---|---|
| `SESSION_TERMINATED` | Akun telah login di perangkat lain | Bersihkan token lokal, arahkan ke Login, tampilkan dialog: *"Akun Anda telah login di perangkat lain."* |
| `TOKEN_EXPIRED` | Masa berlaku token habis (7 hari) | Bersihkan token lokal, arahkan ke Login: *"Sesi Anda telah berakhir."* |
| `TOKEN_INVALID` | Token tidak sah / rusak | Bersihkan token lokal & arahkan ke Login |

**Contoh Response 401 saat Login di HP Lain:**
```json
{
  "success": false,
  "code": "SESSION_TERMINATED",
  "message": "Sesi Anda telah berakhir karena akun ini telah login di perangkat lain. Silakan login kembali."
}
```

---

## 🔔 3. Modul Notifikasi & Badge Counter

Digunakan untuk menampilkan badge angka notifikasi pada menu atau bottom navigation bar aplikasi mobile.

* **Method & URL**: `GET /reports/badge-counts`
* **Auth**: `Bearer <token>`
* **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "salesOrders": 3,
    "purchaseOrders": 1,
    "deliveries": 2,
    "finance": 5,
    "stockOpname": 0,
    "lowStock": 4,
    "transactionsTotal": 6,
    "inventoryTotal": 0
  }
}
```

* **Penjelasan Field**:
  - `salesOrders`: Jumlah SO berstatus belum selesai (`DRAFT`, `PENDING`, `CONFIRMED`, `APPROVED`).
  - `deliveries`: Jumlah pengiriman aktif dalam perjalanan (`PENDING`, `SHIPPED`).
  - `finance`: Jumlah invoice yang belum lunas (`UNPAID`, `PARTIAL`, `PARTIALLY_PAID`).
  - `lowStock`: Jumlah produk yang stok fisiknya di bawah batas minimum (`stock <= minStock`).
  - `transactionsTotal`: Total akumulasi transaksi aktif.

---

## 📦 4. Modul Produk, Cek Harga, & Stok Real-Time

### A. Cari Produk & Scan Barcode (Katalog / List)
Mendukung pencarian cepat dengan mengetik nama, kode SKU, scan barcode kamera, serta filter multi-satuan dan kategori.

* **Method & URL**: `GET /products`
* **Auth**: `Bearer <token>`
* **Query Parameters**:
  * `search` *(string)*: Keyword pencarian (mencocokkan **Nama Barang**, **Barcode**, atau **SKU**).
  * `categoryId` *(number)*: Filter ID Kategori.
  * `supplierId` *(number)*: Filter ID Supplier.
  * `lowStock` *(boolean)*: `true` untuk hanya barang yang stoknya menipis.
  * `page` *(number)*: Halaman data (default: `1`).
  * `limit` *(number)*: Jumlah data per halaman (default: `20`).

* **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "sku": "PRD-0012",
      "name": "SAOS 5 STICK BANTAL 525GR",
      "unit": "karton",
      "sellingPrice": 95000.00,
      "purchasePrice": 85000.00,
      "image": "/uploads/products/saos-525.webp",
      "category": { "id": 2, "name": "Bumbu & Saus" },
      "supplier": { "id": 1, "name": "PT INDOFOOD CBP" },
      "tax": { "id": 1, "name": "PPN 11%", "rate": 11.0 },
      "units": [
        {
          "id": 45,
          "unitName": "karton",
          "conversionRatio": 1.0,
          "isBaseUnit": true,
          "sellingPrice": 95000.00
        },
        {
          "id": 46,
          "unitName": "pack",
          "conversionRatio": 0.1,
          "isBaseUnit": false,
          "sellingPrice": 10500.00
        },
        {
          "id": 47,
          "unitName": "pcs",
          "conversionRatio": 0.01,
          "isBaseUnit": false,
          "sellingPrice": 1200.00
        }
      ],
      "totalStock": 150,
      "bonusStock": 15,
      "warehouseStocks": [
        {
          "warehouseId": 1,
          "stock": 100,
          "bonusStock": 10,
          "warehouse": { "name": "Gudang Utama" }
        }
      ]
    }
  ],
  "pagination": {
    "totalItems": 120,
    "totalPages": 6,
    "currentPage": 1,
    "limit": 20
  }
}
```

---

### B. Detail Produk Tunggal
* **Method & URL**: `GET /products/:id`
* **Auth**: `Bearer <token>`

---

## 👥 5. Modul Customer / Toko (Pelanggan)

### A. Daftar Toko & Pelanggan
* **Method & URL**: `GET /customers`
* **Auth**: `Bearer <token>`
* **Query Parameters**:
  * `search` *(string)*: Cari nama customer, kode (`C-TGL-XXXXXX`), atau alamat.
  * `salespersonId` *(number)*: Filter toko binaan sales tertentu.
  * `areaCode` *(string)*: Filter area distribusi.
  * `page` & `limit`: Paginasi data.

* **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1946,
      "code": "C-TGL-000001",
      "legacyCode": "010001",
      "name": "SETIA JAYA PLASTIK",
      "address": "JL SETIABUDI",
      "districtName": "TEGAL TIMUR",
      "phone": "08123456789",
      "salespersonName": "YULI",
      "salespersonCode": "105",
      "creditLimit": 15000000.00,
      "topDays": 30,
      "priceTier": "1"
    }
  ]
}
```

---

## 🛒 6. Modul Sales Order (Taking Order Lapangan)

### A. Buat Pesanan Baru (Create SO dari Mobile Sales)
Salesman dapat membuat pesanan langsung dari toko customer lengkap dengan konversi multi-satuan, barang bonus, dan diskon.

* **Method & URL**: `POST /sales-orders`
* **Auth**: `Bearer <token>`
* **Request Body**:
```json
{
  "soNumber": "SO-2026-000123",
  "soDate": "2026-09-17",
  "contactId": 1946,
  "warehouseId": 1,
  "paymentTerm": "TEMPO",
  "dueDate": "2026-10-17",
  "applyTax": true,
  "taxInclusive": true,
  "taxId": 1,
  "globalDiscountPercent": 0,
  "notes": "Pesanan TO Sales Yuli - Kirim Pagi",
  "items": [
    {
      "productId": 12,
      "qty": 5,
      "unit": "karton",
      "conversionRatio": 1,
      "price": 95000,
      "discount": 0,
      "bonusQty": 1,
      "bonusUnit": "pack",
      "bonusConversionRatio": 0.1
    }
  ]
}
```

* **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Sales Order created successfully.",
  "data": {
    "id": 88,
    "soNumber": "SO-2026-000123",
    "status": "CONFIRMED",
    "subtotal": 427927.93,
    "taxAmount": 47072.07,
    "totalAmount": 475000.00
  }
}
```

---

### B. Daftar & Riwayat Sales Order
* **Method & URL**: `GET /sales-orders`
* **Query Parameters**: `search`, `status` (`DRAFT`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `COMPLETED`), `contactId`, `startDate`, `endDate`, `page`, `limit`.

---

### C. Detail & Revisi Sales Order
* **Detail SO**: `GET /sales-orders/:id`
* **Revisi SO**: `PUT /sales-orders/:id` *(Mendukung penyesuaian kuantiti langsung)*.

---

## 🚚 7. Modul Pengiriman (Delivery / Driver)

### A. Daftar Surat Jalan untuk Driver
Driver dapat melihat daftar pengiriman yang ditugaskan kepadanya.

* **Method & URL**: `GET /deliveries`
* **Auth**: `Bearer <token>`
* **Query Parameters**:
  * `driverName`: Nama driver (misal `SLAMET`).
  * `status`: `PENDING`, `SHIPPED`, `DELIVERED`.
  * `date`: Tanggal pengiriman (`YYYY-MM-DD`).

---

### B. Konfirmasi Pengiriman Selesai (Disertai Foto Bukti Terima)
Driver mengonfirmasi barang telah sampai dan diterima toko.

* **Method & URL**: `POST /deliveries/:id/confirm-receipt`
* **Content-Type**: `multipart/form-data`
* **Form Data**:
  * `recipientName` *(string)*: Nama penerima di toko.
  * `receiveDate` *(string)*: Tanggal/waktu terima.
  * `notes` *(string)*: Catatan kondisi penerimaan.
  * `evidence` *(file / image)*: Foto tanda tangan / bukti toko menerima barang.

---

## 💰 8. Modul Tagihan (Invoice), Kas/Bank, & Pelunasan Pembayaran

### A. Cek Daftar Faktur / Tagihan Belum Lunas
* **Method & URL**: `GET /invoices`
* **Query Parameters**:
  * `type`: `SALES`
  * `status`: `UNPAID` atau `PARTIALLY_PAID`
  * `customerId`: ID Toko / Pelanggan.

---

### B. Daftar Akun Kas / Bank (Chart of Accounts)
Digunakan untuk pilihan akun penerimaan pembayaran (Kas Kasir, Kas Sales, Bank BCA, Bank Mandiri).

* **Method & URL**: `GET /chart-of-accounts`
* **Auth**: `Bearer <token>`
* **Query Parameters**: `category=CASH_BANK` atau `isActive=true`

---

### C. Catat Pembayaran Tagihan (Koleksi Kasir / Sales)
Mencatat penerimaan uang tunai/transfer beserta upload bukti transfer bank.

* **Method & URL**: `POST /payments`
* **Content-Type**: `multipart/form-data`
* **Form Data**:
  * `paymentNumber` *(string)*: Nomor referensi bayar (misal `PAY-2026-001`).
  * `invoiceId` *(number)*: ID Faktur terkait.
  * `accountId` *(number)*: ID Akun Kas/Bank tujuan penerimaan.
  * `paymentDate` *(string)*: Tanggal bayar (`YYYY-MM-DD`).
  * `amount` *(number)*: Jumlah uang yang dibayar.
  * `paymentMethod` *(string)*: `CASH`, `TRANSFER`, `GIRO`, `QRIS`.
  * `notes` *(string)*: Keterangan / No. Rekening.
  * `evidence` *(file / image)*: Foto struk / screenshot transfer m-banking.

---

## 📑 9. Modul Dropdown & Master Referensi

Endpoint cepat untuk memuat pilihan pada form mobile:
* `GET /categories`: Daftar kategori produk.
* `GET /warehouses`: Daftar gudang aktif.
* `GET /salespersons`: Daftar sales & kode salesman.
* `GET /drivers`: Daftar driver & plat nomor kendaraan.

---

## 🛠️ 10. Contoh Implementasi Lengkap di Flutter (Dart + Dio)

### A. Helper Image URL
```dart
String getImageUrl(String? relativePath) {
  if (relativePath == null || relativePath.isEmpty) return '';
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const String host = 'https://api-jatimas.luckysdev.com';
  final String normalized = relativePath.startsWith('/') ? relativePath : '/$relativePath';
  return '$host$normalized';
}
```

### B. Dio Client & Global Interceptor (Handling Single-Device 401 Session)
```dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

class ApiClient {
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  static final Dio dio = Dio(
    BaseOptions(
      baseUrl: 'https://api-jatimas.luckysdev.com/api',
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': '1',
      },
    ),
  )..interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final String? token = await getStoredToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          if (error.response?.statusCode == 401) {
            final data = error.response?.data;
            final String code = data is Map ? (data['code'] ?? '') : '';
            final String message = data is Map 
                ? (data['message'] ?? 'Sesi Anda telah berakhir.')
                : 'Sesi Anda telah berakhir.';

            // Hapus token lokal
            await clearLocalSession();

            // Arahkan ke halaman login & tampilkan notifikasi jika login di HP lain
            final context = navigatorKey.currentContext;
            if (context != null) {
              Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    code == 'SESSION_TERMINATED'
                        ? '⚠️ $message'
                        : 'Sesi berakhir. Silakan login kembali.',
                  ),
                  backgroundColor: code == 'SESSION_TERMINATED' ? Colors.orange.shade800 : Colors.red.shade700,
                  duration: const Duration(seconds: 4),
                ),
              );
            }
          }
          return handler.next(error);
        },
      ),
    );

  static Future<String?> getStoredToken() async {
    // Ambil token dari SharedPreferences / FlutterSecureStorage
    return null;
  }

  static Future<void> clearLocalSession() async {
    // Hapus token dan user data dari storage lokal
  }
}
```

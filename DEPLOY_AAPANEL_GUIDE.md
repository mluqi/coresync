# 🚀 Panduan Deploy CoreSync ERP di aaPanel (2 Project Terpisah: Backend & Frontend)

Panduan ini disusun untuk setup **2 Project Terpisah di aaPanel**:
* **Project 1 (Backend Node.js API)**: `https://api-jatimas.luckysdev.com` (Root API: `/api/`)
* **Project 2 (Frontend React Vite)**: `https://erp.luckysdev.com` (atau domain frontend Anda)

> [!NOTE]
> Backend sudah dikonfigurasi **Full CORS (`origin: true`)** sehingga API dapat diakses langsung oleh **Web Frontend** maupun **Aplikasi Mobile (Flutter/Android/iOS)** tanpa kendala block origin.

---

## 🗄️ 1. Database MySQL di aaPanel

1. Masuk ke menu **Databases** di sidebar aaPanel $\rightarrow$ Klik **Add Database**.
   - **DBName**: `coresync_db`
   - **Username**: `coresync_user`
   - **Password**: *(Catat password ini)*
2. Klik tombol **Import** pada database yang baru dibuat, lalu upload file `.sql` Anda (misal `db_coresync.sql`).

---

## ⚙️ 2. Project 1: Backend Node.js (`api-jatimas.luckysdev.com`)

### A. Upload File Backend
Upload source code folder `backend` ke direktori server:
```text
/www/wwwroot/api-jatimas.luckysdev.com
```

### B. Konfigurasi File `.env` Backend
Di dalam folder `/www/wwwroot/api-jatimas.luckysdev.com`, buat/edit file `.env`:
```env
PORT=8000
NODE_ENV=production

DB_USERNAME=coresync_user
DB_PASSWORD=password_database_aapanel_anda
DB_NAME=coresync_db
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DIALECT=mysql

JWT_SECRET=supersecretkeycoresync_production_acak_dan_panjang_2026
```

### C. Install Dependencies & Setup Folder Uploads
Buka terminal SSH atau Terminal aaPanel:
```bash
cd /www/wwwroot/api-jatimas.luckysdev.com
npm install --production

# Buat folder uploads untuk file gambar/bukti transfer
mkdir -p public/uploads
chmod -R 755 public/uploads
```

### D. Jalankan Backend (Node project manager / PM2)
Di menu **Website > Node project** (atau via PM2 terminal):
- **Domain**: `api-jatimas.luckysdev.com`
- **Path**: `/www/wwwroot/api-jatimas.luckysdev.com`
- **Run script**: `npm start` (atau `server.js`)
- **Port**: `8000`
- **Node Version**: v18 / v20

*(Pasang SSL Let's Encrypt pada domain `api-jatimas.luckysdev.com` & aktifkan Force HTTPS).*

Uji API:
```bash
curl https://api-jatimas.luckysdev.com/api/health
# Output: {"status":"healthy", ...}
```

---

## 🎨 3. Project 2: Frontend React Vite (`erp.luckysdev.com`)

### A. Build Frontend
Di komputer lokal Anda:
1. Pastikan file `.env.production` di folder `coresync-erp` berisi:
   ```env
   VITE_API_URL="https://api-jatimas.luckysdev.com/api"
   ```
2. Jalankan build:
   ```bash
   cd coresync-erp
   npm run build
   ```
   *Hasil build akan tersimpan di folder `coresync-erp/dist/`.*

### B. Tempatkan di aaPanel
1. Buat website baru di aaPanel:
   - **Domain**: `erp.luckysdev.com` (atau domain frontend Anda)
   - **Root directory**: `/www/wwwroot/coresync-erp`
2. Upload seluruh isi folder `dist/` ke direktori `/www/wwwroot/coresync-erp/` (sehingga file `index.html` berada tepat di root direktori).

### C. SPA URL Rewrite (Agar Refresh Halaman Tidak 404)
Di menu **Website > `erp.luckysdev.com` > URL rewrite**, pilih template **html / default** atau tambahkan:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```
3. Pasang SSL Let's Encrypt pada domain frontend & aktifkan Force HTTPS.

---

## 📱 4. Integrasi Aplikasi Mobile
Untuk aplikasi mobile (Flutter / Dart / React Native):
- **Base URL API**: `https://api-jatimas.luckysdev.com/api`
- **Base URL Uploads / Gambar**: `https://api-jatimas.luckysdev.com/uploads`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <TOKEN>`
  - `X-Tenant-ID: <TENANT_ID>` (jika multi-tenant)

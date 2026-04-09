# SecureBank Backend

TypeScript/Express API that powers the blockchain-based verification flows for the SecureBank frontend. It persists user, verification, document, and blockchain data inside the `online_banking_system` PostgreSQL database while exposing REST endpoints that mirror the UI journeys.

## ✨ Capabilities

- User registration/login with salted bcrypt hashes and JWT auth
- Automated creation of verification records, audit logs, and blockchain blocks
- Chain validation via SHA-256 hashing + proof-of-work style mining (difficulty `0000`)
- Document upload ingestion with checksum tracking
- Role-aware access control (admin vs user)
- Dashboard summaries for pending reviews, users, and recent blocks

## 📦 Project Structure

```
server/
├── prisma/               # Prisma schema + migrations
├── src/
│   ├── config/           # Environment validation
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Auth + error handling
│   ├── routes/           # API surface
│   ├── services/         # Business + blockchain logic
│   ├── utils/            # Helpers (hashing, account numbers)
│   └── app.ts, index.ts  # HTTP bootstrap
└── uploads/              # Local storage for uploaded docs
```

## ⚙️ Setup

1. **Install deps**
   ```bash
   cd server
   npm install
   ```
2. **Configure env**
   ```bash
   cp .env.example .env
   # Update DATABASE_URL -> postgres://<user>:<pass>@localhost:5432/online_banking_system
   # Set JWT_SECRET + optional PORT
   ```
3. **Apply schema**
   ```bash
   npx prisma migrate dev --name init
   ```
4. **Generate client**
   ```bash
   npx prisma generate
   ```
5. **Run dev server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:4000/api` by default (configurable via `PORT`).

## 🔐 Authentication

- `POST /api/auth/register` → create user accounts (defaults to role `USER`)
- `POST /api/auth/login` → returns `{ user, token }`
- `GET /api/auth/me` → authenticated profile

Add the bearer token to all protected requests: `Authorization: Bearer <token>`.

## 🧩 Core Endpoints

| Route | Method(s) | Description | Auth |
|-------|-----------|-------------|------|
| `/api/users` | `GET` | List users w/ last verifications | Admin |
| `/api/users/:id` | `GET`, `PATCH /status` | Inspect or update KYC state | Admin |
| `/api/verification` | `GET`, `POST` | Manage verification records | Admin |
| `/api/verification/user/:userId` | `GET` | History for a specific user | User (self) or Admin |
| `/api/blockchain/chain` | `GET` | Full blockchain with metadata | Public |
| `/api/blockchain/validate` | `GET` | Recomputes hashes + integrity | Public |
| `/api/documents/upload` | `POST` | Upload document files (`multipart/form-data`) | Authenticated |
| `/api/documents/user/:userId` | `GET` | Document metadata history | User (self) or Admin |
| `/api/documents/:id/status` | `PATCH` | Approve/reject a document | Admin |
| `/api/dashboard/summary` | `GET` | Aggregated metrics + latest blocks/activity | Admin |

## 🧱 Blockchain Flow

1. Each verification record triggers a mined block with payload `{ userId, action, status, verificationId }`.
2. The block references the previous hash; tampering changes the computed SHA-256 digest and fails validation.
3. `GET /api/blockchain/validate` replays the entire chain and highlights any integrity issues.

## 📡 Frontend Integration Tips

- Replace mock data calls with the endpoints above (e.g., dashboards pull from `/api/dashboard/summary`).
- Use the Verification Checker UI to call `GET /api/verification/user/:userId` (allowing self-serve lookups).
- Wire the blockchain viewer to `/api/blockchain/chain` for live block data.
- Hook document upload component to `POST /api/documents/upload` with `FormData` containing `document` file, `type`, `userId`, and optional `verificationId`.

## 🧪 Testing Ideas

- Seed demo users via Prisma `db seed` (optional) to mirror the mock dataset.
- Unit test services with Jest or Vitest by mocking Prisma’s client.
- Run `npm run lint` to keep the TypeScript codebase consistent and secure.

## 🤖 PAN OCR Model Training (Dataset Driven)

You can train a custom OCR model on your PAN-card dataset and let the backend use it for text extraction during verification.

1. Install Python ML dependencies
   ```bash
   cd server
   pip install -r ml/requirements.txt
   ```

2. Prepare dataset JSONL
   Create a file like `server/ml/data/pan_ocr_dataset.jsonl` with one JSON object per line:
   ```json
   {"image_path":"C:/data/pan/img001.jpg","text":"PALADAGU KASI VISALAKSHMI"}
   {"image_path":"C:/data/pan/img002.jpg","text":"SUBHASH PALADAGU"}
   ```

3. Train model
   ```bash
   cd server
   python ml/train_pan_ocr.py --dataset ml/data/pan_ocr_dataset.jsonl --output-dir ml/models/pan-ocr --epochs 3
   ```

4. Test inference
   ```bash
   cd server
   python ml/pan_ocr_infer.py --image uploads/sample-pan.jpg --json
   ```

5. Start backend
   The PAN controller now tries model OCR first using `ml/pan_ocr_infer.py`, then falls back to browser OCR text if needed.

### YOLOv11 Field Detector + OCR (Recommended)

If you have a YOLO dataset with PAN field boxes (like `name`, `father name`, `dob`, `pan number`), use this path for better extraction.

1. Train detector
   ```bash
   cd server
   python ml/train_pan_detector.py --data ml/data/your-detection-dataset/data.yaml --epochs 80
   ```

2. Copy best weights to expected location
   ```bash
   # example after training
   # from: server/ml/models/pan-fields/weights/best.pt
   # to:   server/ml/models/pan-fields/best.pt
   ```

3. Test detector+OCR inference
   ```bash
   cd server
   python ml/pan_detect_ocr.py --image uploads/sample-pan.jpg --weights ml/models/pan-fields/best.pt --json
   ```
   If training saved to an auto-numbered folder such as `ml/models/pan-fields3`, the script will look for the latest `best.pt` automatically.

4. Run backend
   PAN verification will automatically prefer `ml/pan_detect_ocr.py` first.
   The detector output includes both PAN and Aadhaar field labels, so the same model path can be reused when Aadhaar verification is added next.
   If weights are missing or detection fails, it falls back to `ml/pan_ocr_infer.py`, then browser OCR text.

Notes:
- If your custom model exists in `server/ml/models/pan-ocr`, it will be used automatically.
- If model OCR fails, API response includes OCR source/engine details for debugging.

---
Need help wiring the UI to this API? Update the React hooks/services to target the endpoints above, swapping out `mockData.ts` and the simulated verification engine where appropriate.

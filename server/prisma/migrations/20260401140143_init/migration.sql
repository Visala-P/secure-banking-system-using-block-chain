-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('verified', 'pending', 'rejected');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('automated', 'manual');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('aadhaar', 'pan', 'passport', 'driverLicense', 'selfie', 'other');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('processing', 'verified', 'rejected', 'pending');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "accountNumber" TEXT NOT NULL,
    "kycStatus" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "verificationCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(6),
    "joinedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "documentType" "DocumentType",
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedBy" TEXT,
    "notes" TEXT,
    "autoVerified" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "verificationMethod" "VerificationMethod" DEFAULT 'automated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainBlock" (
    "id" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "previousHash" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificationId" TEXT,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'processing',
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingNotes" TEXT,

    CONSTRAINT "DocumentUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_accountNumber_key" ON "User"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainBlock_blockNumber_key" ON "BlockchainBlock"("blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainBlock_hash_key" ON "BlockchainBlock"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainBlock_verificationId_key" ON "BlockchainBlock"("verificationId");

-- AddForeignKey
ALTER TABLE "VerificationRecord" ADD CONSTRAINT "VerificationRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainBlock" ADD CONSTRAINT "BlockchainBlock_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "VerificationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "VerificationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

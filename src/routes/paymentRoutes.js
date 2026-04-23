const express = require("express");
const {
  payFine,
  payMembership,
  payDeposit,
  getPaymentHistory,
  getFineSummary,
  refundDeposit,
  getAllPayments,
} = require("../controllers/paymentController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Protected routes (authenticated users)
router.use(protect);

// User payment routes
router.post("/pay-fine/:borrowId", payFine);
router.post("/pay-membership", payMembership);
router.post("/pay-deposit", payDeposit);
router.get("/history", getPaymentHistory);
router.get("/fine-summary", getFineSummary);
router.post("/refund-deposit", refundDeposit);

// Admin only routes
router.get("/admin/all", authorize("admin", "librarian"), getAllPayments);

module.exports = router;

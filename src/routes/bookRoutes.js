const express = require("express");
const {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  getBookStats,
} = require("../controllers/bookController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { validateBook, checkValidation } = require("../utils/validation");

const router = express.Router();

// Public routes
router.get("/", getBooks);
router.get("/stats", protect, authorize("librarian", "admin"), getBookStats);
router.get("/:id", getBook);

// Protected routes (Librarian/Admin only)
router.post(
  "/",
  protect,
  authorize("librarian", "admin"),
  validateBook,
  checkValidation,
  createBook,
);
router.put("/:id", protect, authorize("librarian", "admin"), updateBook);
router.delete("/:id", protect, authorize("admin"), deleteBook);

module.exports = router;

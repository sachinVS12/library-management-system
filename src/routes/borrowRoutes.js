const express = require("express");
const {
  borrowBook,
  returnBook,
  renewBook,
  getMyBorrowedBooks,
  getAllBorrows,
  getOverdueBooks,
  getDueDateReminders,
  reportLostBook,
} = require("../controllers/borrowController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// All routes require authentication
router.use(protect);

// User routes
router.get("/my-books", getMyBorrowedBooks);
router.get("/reminders", getDueDateReminders);
router.post("/:bookId", borrowBook);
router.put("/renew/:borrowId", renewBook);
router.put("/return/:borrowId", returnBook);
router.put("/report-lost/:borrowId", reportLostBook);

// Admin/Librarian routes
router.get("/all", authorize("librarian", "admin"), getAllBorrows);
router.get("/overdue", authorize("librarian", "admin"), getOverdueBooks);

module.exports = router;

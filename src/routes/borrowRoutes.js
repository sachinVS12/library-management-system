const express = require("express");
const {
  borrowBook,
  returnBook,
  getMyBorrowedBooks,
  getAllBorrows,
} = require("../controllers/borrowController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect); // All routes require authentication

router.get("/my-books", getMyBorrowedBooks);
router.get("/all", authorize("librarian", "admin"), getAllBorrows);
router.post("/:bookId", borrowBook);
router.put("/return/:borrowId", returnBook);

module.exports = router;

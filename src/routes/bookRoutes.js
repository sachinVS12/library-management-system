const express = require("express");
const {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
} = require("../controllers/bookController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router
  .route("/")
  .get(getBooks)
  .post(protect, authorize("librarian", "admin"), createBook);

router
  .route("/:id")
  .get(getBook)
  .put(protect, authorize("librarian", "admin"), updateBook)
  .delete(protect, authorize("admin"), deleteBook);

module.exports = router;

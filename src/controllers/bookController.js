const Book = require("../models/Book");
const Borrow = require("../models/Borrow");
const ApiResponse = require("../utils/response");

// @desc    Get all books with advanced filtering
// @route   GET /api/books
// @access  Public
const getBooks = async (req, res) => {
  try {
    const {
      category,
      search,
      page = 1,
      limit = 10,
      sortBy = "-createdAt",
      minQuantity,
      maxQuantity,
      author,
      available,
    } = req.query;

    let query = {};

    if (category) {
      query.category = category;
    }

    if (author) {
      query.author = { $regex: author, $options: "i" };
    }

    if (available === "true") {
      query.available = { $gt: 0 };
    }

    if (minQuantity || maxQuantity) {
      query.quantity = {};
      if (minQuantity) query.quantity.$gte = parseInt(minQuantity);
      if (maxQuantity) query.quantity.$lte = parseInt(maxQuantity);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
        { isbn: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const books = await Book.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sortBy);

    const total = await Book.countDocuments(query);

    ApiResponse.success(
      res,
      {
        books,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
      "Books retrieved successfully",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Get single book
// @route   GET /api/books/:id
// @access  Public
const getBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return ApiResponse.error(res, "Book not found", 404);
    }

    // Get borrowing history for this book
    const borrowHistory = await Borrow.find({ book: req.params.id })
      .populate("user", "name email")
      .limit(10)
      .sort("-borrowDate");

    ApiResponse.success(
      res,
      { book, borrowHistory },
      "Book retrieved successfully",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Create new book
// @route   POST /api/books
// @access  Private/Librarian
const createBook = async (req, res) => {
  try {
    // Check if book with same ISBN exists
    const existingBook = await Book.findOne({ isbn: req.body.isbn });
    if (existingBook) {
      return ApiResponse.error(res, "Book with this ISBN already exists", 400);
    }

    // Set available quantity equal to total quantity
    req.body.available = req.body.quantity;

    const book = await Book.create(req.body);
    ApiResponse.success(res, book, "Book created successfully", 201);
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Update book
// @route   PUT /api/books/:id
// @access  Private/Librarian
const updateBook = async (req, res) => {
  try {
    let book = await Book.findById(req.params.id);

    if (!book) {
      return ApiResponse.error(res, "Book not found", 404);
    }

    // If quantity is being updated, adjust available quantity
    if (req.body.quantity !== undefined) {
      const quantityDiff = req.body.quantity - book.quantity;
      req.body.available = book.available + quantityDiff;
    }

    book = await Book.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    ApiResponse.success(res, book, "Book updated successfully");
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Delete book
// @route   DELETE /api/books/:id
// @access  Private/Admin
const deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return ApiResponse.error(res, "Book not found", 404);
    }

    // Check if book is currently borrowed
    const activeBorrows = await Borrow.countDocuments({
      book: req.params.id,
      status: "borrowed",
    });

    if (activeBorrows > 0) {
      return ApiResponse.error(
        res,
        "Cannot delete book that is currently borrowed",
        400,
      );
    }

    await book.deleteOne();
    ApiResponse.success(res, null, "Book deleted successfully");
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Get book statistics
// @route   GET /api/books/stats/overview
// @access  Private/Librarian
const getBookStats = async (req, res) => {
  try {
    const totalBooks = await Book.countDocuments();
    const totalAvailable = await Book.aggregate([
      { $group: { _id: null, total: { $sum: "$available" } } },
    ]);
    const totalBorrowed = await Borrow.countDocuments({ status: "borrowed" });
    const booksByCategory = await Book.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    ApiResponse.success(
      res,
      {
        totalBooks,
        totalAvailable: totalAvailable[0]?.total || 0,
        totalBorrowed,
        booksByCategory,
      },
      "Statistics retrieved successfully",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

module.exports = {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  getBookStats,
};

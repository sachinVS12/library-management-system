const Borrow = require("../models/Borrow");
const Book = require("../models/Book");
const User = require("../models/User");
const ApiResponse = require("../utils/response");

// @desc    Borrow a book
// @route   POST /api/borrow/:bookId
// @access  Private
const borrowBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.bookId);

    if (!book) {
      return ApiResponse.error(res, "Book not found", 404);
    }

    if (book.available < 1) {
      return ApiResponse.error(res, "Book is not available for borrowing", 400);
    }

    // Check user's borrowing limit (max 5 books at a time)
    const activeBorrows = await Borrow.countDocuments({
      user: req.user.id,
      status: "borrowed",
    });

    if (activeBorrows >= 5) {
      return ApiResponse.error(
        res,
        "You have reached the maximum borrowing limit of 5 books",
        400,
      );
    }

    // Check if user already borrowed this book
    const existingBorrow = await Borrow.findOne({
      user: req.user.id,
      book: req.params.bookId,
      status: "borrowed",
    });

    if (existingBorrow) {
      return ApiResponse.error(res, "You have already borrowed this book", 400);
    }

    // Calculate due date (14 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    // Create borrow record
    const borrow = await Borrow.create({
      user: req.user.id,
      book: req.params.bookId,
      dueDate,
    });

    // Update book availability
    book.available -= 1;
    await book.save();

    // Add book to user's borrowed books
    await User.findByIdAndUpdate(req.user.id, {
      $push: { borrowedBooks: req.params.bookId },
    });

    const populatedBorrow = await Borrow.findById(borrow._id)
      .populate("book", "title author isbn")
      .populate("user", "name email");

    ApiResponse.success(
      res,
      populatedBorrow,
      "Book borrowed successfully",
      201,
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Return a book
// @route   PUT /api/borrow/return/:borrowId
// @access  Private
const returnBook = async (req, res) => {
  try {
    let borrow = await Borrow.findById(req.params.borrowId);

    if (!borrow) {
      return ApiResponse.error(res, "Borrow record not found", 404);
    }

    // Check if user owns this borrow record
    if (
      borrow.user.toString() !== req.user.id &&
      req.user.role !== "librarian"
    ) {
      return ApiResponse.error(res, "Not authorized to return this book", 403);
    }

    if (borrow.status === "returned") {
      return ApiResponse.error(res, "Book already returned", 400);
    }

    // Calculate fine
    const fine = borrow.calculateFine();

    borrow.returnDate = new Date();
    borrow.status = "returned";
    borrow.fine = fine;
    await borrow.save();

    // Update book availability
    const book = await Book.findById(borrow.book);
    book.available += 1;
    await book.save();

    // Remove book from user's borrowed books
    await User.findByIdAndUpdate(borrow.user, {
      $pull: { borrowedBooks: borrow.book },
    });

    const message =
      fine > 0
        ? `Book returned successfully. Fine amount: $${fine}`
        : "Book returned successfully";

    ApiResponse.success(res, { borrow, fine }, message);
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Renew a book (extend due date)
// @route   PUT /api/borrow/renew/:borrowId
// @access  Private
const renewBook = async (req, res) => {
  try {
    const borrow = await Borrow.findById(req.params.borrowId);

    if (!borrow) {
      return ApiResponse.error(res, "Borrow record not found", 404);
    }

    if (borrow.user.toString() !== req.user.id) {
      return ApiResponse.error(res, "Not authorized", 403);
    }

    if (borrow.status !== "borrowed") {
      return ApiResponse.error(res, "Cannot renew a returned book", 400);
    }

    // Check if already renewed (max 1 renewal)
    if (borrow.renewed) {
      return ApiResponse.error(res, "Book can only be renewed once", 400);
    }

    // Extend due date by 7 days
    const newDueDate = new Date(borrow.dueDate);
    newDueDate.setDate(newDueDate.getDate() + 7);
    borrow.dueDate = newDueDate;
    borrow.renewed = true;
    await borrow.save();

    ApiResponse.success(
      res,
      borrow,
      "Book renewed successfully. New due date: " +
        newDueDate.toLocaleDateString(),
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Get user's borrowed books
// @route   GET /api/borrow/my-books
// @access  Private
const getMyBorrowedBooks = async (req, res) => {
  try {
    const borrows = await Borrow.find({ user: req.user.id })
      .populate("book")
      .sort("-borrowDate");

    // Update status for overdue books and calculate fines
    let totalFine = 0;
    for (let borrow of borrows) {
      if (borrow.status === "borrowed") {
        const fine = borrow.calculateFine();
        if (fine > 0) {
          borrow.status = "overdue";
          borrow.fine = fine;
          await borrow.save();
          totalFine += fine;
        }
      } else if (borrow.fine > 0) {
        totalFine += borrow.fine;
      }
    }

    ApiResponse.success(
      res,
      { borrows, totalFine },
      "Borrowed books retrieved successfully",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Get all borrow records (Admin/Librarian)
// @route   GET /api/borrow/all
// @access  Private/Admin
const getAllBorrows = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    }

    const borrows = await Borrow.find(query)
      .populate("user", "name email")
      .populate("book", "title author isbn")
      .sort("-borrowDate")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Borrow.countDocuments(query);

    ApiResponse.success(
      res,
      {
        borrows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
      "All borrow records retrieved successfully",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Get overdue books
// @route   GET /api/borrow/overdue
// @access  Private/Librarian
const getOverdueBooks = async (req, res) => {
  try {
    const overdueBooks = await Borrow.find({
      status: "borrowed",
      dueDate: { $lt: new Date() },
    })
      .populate("user", "name email phone")
      .populate("book", "title author isbn");

    const totalFine = overdueBooks.reduce(
      (sum, book) => sum + book.calculateFine(),
      0,
    );

    ApiResponse.success(
      res,
      {
        count: overdueBooks.length,
        totalFine,
        books: overdueBooks,
      },
      "Overdue books retrieved successfully",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

module.exports = {
  borrowBook,
  returnBook,
  renewBook,
  getMyBorrowedBooks,
  getAllBorrows,
  getOverdueBooks,
};

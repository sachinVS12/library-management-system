const Borrow = require("../models/Borrow");
const Book = require("../models/Book");
const User = require("../models/User");

// @desc    Borrow a book
// @route   POST /api/borrow/:bookId
// @access  Private
const borrowBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.bookId);

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    }

    if (book.available < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Book not available" });
    }

    // Check if user already borrowed this book and not returned
    const existingBorrow = await Borrow.findOne({
      user: req.user.id,
      book: req.params.bookId,
      status: "borrowed",
    });

    if (existingBorrow) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You have already borrowed this book",
        });
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

    res.status(201).json({ success: true, data: borrow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Return a book
// @route   PUT /api/borrow/return/:borrowId
// @access  Private
const returnBook = async (req, res) => {
  try {
    let borrow = await Borrow.findById(req.params.borrowId);

    if (!borrow) {
      return res
        .status(404)
        .json({ success: false, message: "Borrow record not found" });
    }

    if (borrow.status === "returned") {
      return res
        .status(400)
        .json({ success: false, message: "Book already returned" });
    }

    // Calculate fine if any
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

    res.status(200).json({
      success: true,
      data: borrow,
      message:
        fine > 0
          ? `Book returned with fine of $${fine}`
          : "Book returned successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    // Update status for overdue books
    for (let borrow of borrows) {
      if (borrow.status === "borrowed" && new Date() > borrow.dueDate) {
        borrow.status = "overdue";
        await borrow.save();
      }
    }

    res.status(200).json({ success: true, data: borrows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all borrow records (Admin/Librarian)
// @route   GET /api/borrow/all
// @access  Private/Admin
const getAllBorrows = async (req, res) => {
  try {
    const borrows = await Borrow.find()
      .populate("user", "name email")
      .populate("book", "title author isbn")
      .sort("-borrowDate");

    res.status(200).json({ success: true, data: borrows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { borrowBook, returnBook, getMyBorrowedBooks, getAllBorrows };

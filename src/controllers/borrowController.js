const Borrow = require("../models/Borrow");
const Book = require("../models/Book");
const User = require("../models/User");
const ApiResponse = require("../utils/response");

// @desc    Borrow a book with due date
// @route   POST /api/borrow/:bookId
// @access  Private
const borrowBook = async (req, res) => {
  try {
    const { duration = 14 } = req.body; // duration in days, default 14
    const book = await Book.findById(req.params.bookId);

    if (!book) {
      return ApiResponse.error(res, "Book not found", 404);
    }

    if (book.available < 1) {
      return ApiResponse.error(res, "Book is not available for borrowing", 400);
    }

    // Check user's borrowing limit
    const activeBorrows = await Borrow.countDocuments({
      user: req.user.id,
      status: { $in: ["borrowed", "overdue"] },
    });

    if (activeBorrows >= 5) {
      return ApiResponse.error(
        res,
        "Maximum borrowing limit of 5 books reached",
        400,
      );
    }

    // Check if user has outstanding fines
    const user = await User.findById(req.user.id);
    if (user.outstandingBalance > 0) {
      return ApiResponse.error(
        res,
        `Please clear outstanding fines of $${user.outstandingBalance} before borrowing`,
        400,
      );
    }

    // Check if user already borrowed this book
    const existingBorrow = await Borrow.findOne({
      user: req.user.id,
      book: req.params.bookId,
      status: { $in: ["borrowed", "overdue"] },
    });

    if (existingBorrow) {
      return ApiResponse.error(res, "You have already borrowed this book", 400);
    }

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + duration);

    // Create borrow record
    const borrow = await Borrow.create({
      user: req.user.id,
      book: req.params.bookId,
      dueDate,
      borrowDate: new Date(),
      status: "borrowed",
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
      {
        borrow: populatedBorrow,
        dueDate,
        daysUntilDue: duration,
        message: `Book borrowed successfully. Due date: ${dueDate.toLocaleDateString()}`,
      },
      "Book borrowed successfully",
      201,
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Return a book with fine calculation
// @route   PUT /api/borrow/return/:borrowId
// @access  Private
const returnBook = async (req, res) => {
  try {
    let borrow = await Borrow.findById(req.params.borrowId);

    if (!borrow) {
      return ApiResponse.error(res, "Borrow record not found", 404);
    }

    if (
      borrow.user.toString() !== req.user.id &&
      req.user.role !== "librarian"
    ) {
      return ApiResponse.error(res, "Not authorized to return this book", 403);
    }

    if (borrow.status === "returned") {
      return ApiResponse.error(res, "Book already returned", 400);
    }

    const returnDate = new Date();
    const dueDate = borrow.dueDate;
    let fine = 0;
    let daysLate = 0;

    // Calculate fine if returned after due date
    if (returnDate > dueDate) {
      daysLate = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24));

      // Fine calculation: $5 per day for first 7 days, $10 per day after
      if (daysLate <= 7) {
        fine = daysLate * 5;
      } else {
        fine = 7 * 5 + (daysLate - 7) * 10;
      }
    }

    borrow.returnDate = returnDate;
    borrow.status = "returned";
    borrow.fine = fine;
    borrow.finePaid = fine === 0;
    await borrow.save();

    // Update book availability
    const book = await Book.findById(borrow.book);
    book.available += 1;
    await book.save();

    // Remove book from user's borrowed books
    await User.findByIdAndUpdate(borrow.user, {
      $pull: { borrowedBooks: borrow.book },
    });

    // Update user's outstanding balance if there's a fine
    if (fine > 0) {
      const user = await User.findById(borrow.user);
      user.outstandingBalance += fine;
      await user.save();
    }

    const message =
      fine > 0
        ? `Book returned ${daysLate} day(s) late. Fine amount: $${fine}. Please pay the fine.`
        : "Book returned successfully. No fine incurred.";

    ApiResponse.success(
      res,
      {
        borrow,
        fine,
        daysLate,
        dueDate: dueDate.toLocaleDateString(),
        returnDate: returnDate.toLocaleDateString(),
        message,
      },
      message,
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Renew a book with due date extension
// @route   PUT /api/borrow/renew/:borrowId
// @access  Private
const renewBook = async (req, res) => {
  try {
    const { extraDays = 7 } = req.body;
    const borrow = await Borrow.findById(req.params.borrowId);

    if (!borrow) {
      return ApiResponse.error(res, "Borrow record not found", 404);
    }

    if (borrow.user.toString() !== req.user.id) {
      return ApiResponse.error(res, "Not authorized", 403);
    }

    if (borrow.status === "returned") {
      return ApiResponse.error(res, "Cannot renew a returned book", 400);
    }

    if (borrow.renewalCount >= 2) {
      return ApiResponse.error(res, "Maximum renewal limit (2) reached", 400);
    }

    // Check if book is overdue
    if (new Date() > borrow.dueDate) {
      const fine = borrow.calculateFine();
      if (fine > 0) {
        return ApiResponse.error(
          res,
          `Please pay overdue fine of $${fine} before renewing`,
          400,
        );
      }
    }

    // Extend due date
    const newDueDate = new Date(borrow.dueDate);
    newDueDate.setDate(newDueDate.getDate() + extraDays);
    borrow.dueDate = newDueDate;
    borrow.renewalCount += 1;
    await borrow.save();

    ApiResponse.success(
      res,
      {
        borrowId: borrow._id,
        oldDueDate: borrow.dueDate,
        newDueDate,
        renewalCount: borrow.renewalCount,
        message: `Book renewed successfully. New due date: ${newDueDate.toLocaleDateString()}`,
      },
      "Book renewed successfully",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Report book as lost and calculate charges
// @route   PUT /api/borrow/report-lost/:borrowId
// @access  Private
const reportLostBook = async (req, res) => {
  try {
    const borrow = await Borrow.findById(req.params.borrowId);

    if (!borrow) {
      return ApiResponse.error(res, "Borrow record not found", 404);
    }

    if (
      borrow.user.toString() !== req.user.id &&
      req.user.role !== "librarian"
    ) {
      return ApiResponse.error(res, "Not authorized", 403);
    }

    if (borrow.status === "returned") {
      return ApiResponse.error(res, "Book already returned", 400);
    }

    const book = await Book.findById(borrow.book);
    const replacementCost = book.price || 50; // Default replacement cost
    const overdueFine = borrow.calculateFine();
    const totalCharge = replacementCost + overdueFine;

    borrow.status = "lost";
    borrow.fine = totalCharge;
    borrow.notes = `Book reported lost. Replacement cost: $${replacementCost}`;
    await borrow.save();

    // Update book availability
    book.available -= 1;
    await book.save();

    // Update user's outstanding balance
    const user = await User.findById(borrow.user);
    user.outstandingBalance += totalCharge;
    await user.save();

    ApiResponse.success(
      res,
      {
        borrow,
        replacementCost,
        overdueFine,
        totalCharge,
        message: `Book reported as lost. Total charge: $${totalCharge} ($${replacementCost} replacement + $${overdueFine} fine)`,
      },
      "Book reported as lost",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Get due date reminders for user
// @route   GET /api/borrow/reminders
// @access  Private
const getDueDateReminders = async (req, res) => {
  try {
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);

    const upcomingDueBooks = await Borrow.find({
      user: req.user.id,
      status: "borrowed",
      dueDate: { $gte: today, $lte: threeDaysFromNow },
    }).populate("book", "title author");

    const overdueBooks = await Borrow.find({
      user: req.user.id,
      status: "overdue",
      finePaid: false,
    }).populate("book", "title author");

    ApiResponse.success(
      res,
      {
        upcomingDueBooks: upcomingDueBooks.map((book) => ({
          id: book._id,
          title: book.book.title,
          dueDate: book.dueDate,
          daysUntilDue: Math.ceil(
            (book.dueDate - today) / (1000 * 60 * 60 * 24),
          ),
        })),
        overdueBooks: overdueBooks.map((book) => ({
          id: book._id,
          title: book.book.title,
          dueDate: book.dueDate,
          daysOverdue: Math.ceil(
            (today - book.dueDate) / (1000 * 60 * 60 * 24),
          ),
          fine: book.calculateFine(),
        })),
      },
      "Due date reminders retrieved",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// Add price field to Book model if not exists
// Add to src/models/Book.js: price: { type: Number, default: 50 }

module.exports = {
  borrowBook,
  returnBook,
  renewBook,
  reportLostBook,
  getDueDateReminders,
  getMyBorrowedBooks,
  getAllBorrows,
  getOverdueBooks,
};

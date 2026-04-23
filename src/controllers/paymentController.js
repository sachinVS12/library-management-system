const Payment = require("../models/Payment");
const Borrow = require("../models/Borrow");
const User = require("../models/User");
const ApiResponse = require("../utils/response");
const crypto = require("crypto");

// @desc    Process fine payment for a borrowed book
// @route   POST /api/payments/pay-fine/:borrowId
// @access  Private
const payFine = async (req, res) => {
  try {
    const { paymentMethod, cardDetails } = req.body;
    const borrow = await Borrow.findById(req.params.borrowId);

    if (!borrow) {
      return ApiResponse.error(res, "Borrow record not found", 404);
    }

    // Check if user owns this borrow record
    if (
      borrow.user.toString() !== req.user.id &&
      req.user.role !== "librarian"
    ) {
      return ApiResponse.error(res, "Not authorized", 403);
    }

    // Calculate current fine
    const fineAmount = borrow.calculateFine();

    if (fineAmount === 0) {
      return ApiResponse.error(res, "No fine to pay for this book", 400);
    }

    if (borrow.finePaid) {
      return ApiResponse.error(res, "Fine already paid for this book", 400);
    }

    // Process payment (simulate payment gateway)
    const transactionId = generateTransactionId();
    const payment = await Payment.create({
      user: req.user.id,
      borrow: borrow._id,
      amount: fineAmount,
      paymentType: "fine",
      paymentMethod,
      paymentStatus: "completed",
      transactionId,
      cardDetails: cardDetails
        ? {
            last4: cardDetails.last4,
            cardType: cardDetails.cardType,
          }
        : undefined,
      notes: `Fine payment for overdue book: ${borrow.book}`,
    });

    // Update borrow record
    borrow.fine = fineAmount;
    borrow.finePaid = true;
    await borrow.save();

    // Update user's total fines and outstanding balance
    const user = await User.findById(req.user.id);
    user.totalFines += fineAmount;
    user.outstandingBalance = Math.max(0, user.outstandingBalance - fineAmount);
    user.paymentHistory.push(payment._id);
    await user.save();

    ApiResponse.success(
      res,
      {
        payment,
        borrow: {
          id: borrow._id,
          fine: fineAmount,
          paid: true,
        },
      },
      "Fine paid successfully",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Pay membership fee
// @route   POST /api/payments/membership
// @access  Private
const payMembership = async (req, res) => {
  try {
    const { paymentMethod, duration = 1 } = req.body; // duration in years
    const user = await User.findById(req.user.id);

    const membershipAmount = user.membershipFee * duration;

    // Process payment
    const transactionId = generateTransactionId();
    const payment = await Payment.create({
      user: req.user.id,
      amount: membershipAmount,
      paymentType: "membership",
      paymentMethod,
      paymentStatus: "completed",
      transactionId,
      notes: `Membership renewal for ${duration} year(s)`,
    });

    // Update membership expiry
    const currentExpiry = user.membershipExpiry || new Date();
    const newExpiry = new Date(currentExpiry);
    newExpiry.setFullYear(newExpiry.getFullYear() + duration);

    user.membershipExpiry = newExpiry;
    user.membershipActive = true;
    user.paymentHistory.push(payment._id);
    await user.save();

    ApiResponse.success(
      res,
      {
        payment,
        membershipExpiry: newExpiry,
        amount: membershipAmount,
      },
      "Membership renewed successfully",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Pay security deposit
// @route   POST /api/payments/deposit
// @access  Private
const payDeposit = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    const user = await User.findById(req.user.id);

    if (amount < 50) {
      return ApiResponse.error(res, "Minimum deposit amount is $50", 400);
    }

    const transactionId = generateTransactionId();
    const payment = await Payment.create({
      user: req.user.id,
      amount,
      paymentType: "deposit",
      paymentMethod,
      paymentStatus: "completed",
      transactionId,
      notes: "Security deposit payment",
    });

    user.securityDeposit += amount;
    user.paymentHistory.push(payment._id);
    await user.save();

    ApiResponse.success(
      res,
      {
        payment,
        totalDeposit: user.securityDeposit,
      },
      "Security deposit paid successfully",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Get user's payment history
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, paymentType } = req.query;

    let query = { user: req.user.id };
    if (paymentType) {
      query.paymentType = paymentType;
    }

    const payments = await Payment.find(query)
      .populate("borrow", "book dueDate fine")
      .sort("-paymentDate")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);
    const totalPaid = await Payment.aggregate([
      { $match: { user: req.user._id, paymentStatus: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    ApiResponse.success(
      res,
      {
        payments,
        stats: {
          totalPaid: totalPaid[0]?.total || 0,
          totalPayments: total,
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
        },
      },
      "Payment history retrieved",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Get fine summary for user
// @route   GET /api/payments/fine-summary
// @access  Private
const getFineSummary = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Get all unpaid fines
    const unpaidFines = await Borrow.find({
      user: req.user.id,
      finePaid: false,
      fine: { $gt: 0 },
    }).populate("book", "title author");

    // Get all overdue books
    const overdueBooks = await Borrow.find({
      user: req.user.id,
      status: "overdue",
      finePaid: false,
    }).populate("book", "title author");

    // Calculate total outstanding
    let totalOutstanding = 0;
    for (let borrow of unpaidFines) {
      totalOutstanding += borrow.fine;
    }

    // Update user's outstanding balance
    user.outstandingBalance = totalOutstanding;
    await user.save();

    ApiResponse.success(
      res,
      {
        totalOutstanding,
        unpaidFines: unpaidFines.map((fine) => ({
          id: fine._id,
          bookTitle: fine.book.title,
          fineAmount: fine.fine,
          dueDate: fine.dueDate,
          daysOverdue: Math.ceil(
            (new Date() - fine.dueDate) / (1000 * 60 * 60 * 24),
          ),
        })),
        overdueBooksCount: overdueBooks.length,
      },
      "Fine summary retrieved",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Process refund for deposit
// @route   POST /api/payments/refund-deposit
// @access  Private
const refundDeposit = async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const user = await User.findById(req.user.id);

    if (amount > user.securityDeposit) {
      return ApiResponse.error(res, "Refund amount exceeds deposit", 400);
    }

    // Check if user has any outstanding fines
    const outstandingFines = await Borrow.find({
      user: req.user.id,
      finePaid: false,
      fine: { $gt: 0 },
    });

    if (outstandingFines.length > 0) {
      return ApiResponse.error(
        res,
        "Please clear outstanding fines before requesting refund",
        400,
      );
    }

    const transactionId = generateTransactionId();
    const refundPayment = await Payment.create({
      user: req.user.id,
      amount: -amount, // Negative amount for refund
      paymentType: "deposit",
      paymentMethod: "bank_transfer",
      paymentStatus: "refunded",
      transactionId,
      notes: `Deposit refund - ${reason || "No reason provided"}`,
      refundDetails: {
        refundAmount: amount,
        refundDate: new Date(),
        reason: reason || "User requested refund",
      },
    });

    user.securityDeposit -= amount;
    user.paymentHistory.push(refundPayment._id);
    await user.save();

    ApiResponse.success(
      res,
      {
        refundAmount: amount,
        remainingDeposit: user.securityDeposit,
        refundPayment,
      },
      "Deposit refund processed successfully",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Admin: Get all payments
// @route   GET /api/payments/admin/all
// @access  Private/Admin
const getAllPayments = async (req, res) => {
  try {
    const { startDate, endDate, paymentType, page = 1, limit = 50 } = req.query;

    let query = {};

    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }

    if (paymentType) {
      query.paymentType = paymentType;
    }

    const payments = await Payment.find(query)
      .populate("user", "name email")
      .populate("borrow", "book dueDate")
      .sort("-paymentDate")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);
    const revenue = await Payment.aggregate([
      {
        $match: { paymentStatus: "completed", paymentType: { $ne: "deposit" } },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    ApiResponse.success(
      res,
      {
        payments,
        stats: {
          totalRevenue: revenue[0]?.total || 0,
          totalTransactions: total,
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
        },
      },
      "All payments retrieved",
    );
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// Helper function to generate transaction ID
const generateTransactionId = () => {
  return (
    "TXN-" +
    Date.now() +
    "-" +
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );
};

module.exports = {
  payFine,
  payMembership,
  payDeposit,
  getPaymentHistory,
  getFineSummary,
  refundDeposit,
  getAllPayments,
};

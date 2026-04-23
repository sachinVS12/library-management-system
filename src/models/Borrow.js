const mongoose = require("mongoose");

const borrowSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },
    borrowDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    returnDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["borrowed", "returned", "overdue", "lost"],
      default: "borrowed",
    },
    renewed: {
      type: Boolean,
      default: false,
    },
    renewalCount: {
      type: Number,
      default: 0,
      max: 2, // Maximum 2 renewals
    },
    fine: {
      type: Number,
      default: 0,
    },
    finePaid: {
      type: Boolean,
      default: false,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

// Calculate fine based on overdue days
borrowSchema.methods.calculateFine = function () {
  if (this.status === "returned" || this.status === "lost") {
    return this.fine;
  }

  const today = new Date();
  if (today > this.dueDate) {
    const daysOverdue = Math.ceil(
      (today - this.dueDate) / (1000 * 60 * 60 * 24),
    );
    // Fine structure: $5 per day for first 7 days, $10 per day after
    if (daysOverdue <= 7) {
      return daysOverdue * 5;
    } else {
      return 7 * 5 + (daysOverdue - 7) * 10;
    }
  }
  return 0;
};

// Check if book is overdue
borrowSchema.methods.isOverdue = function () {
  return this.status === "borrowed" && new Date() > this.dueDate;
};

// Update status based on due date
borrowSchema.methods.updateStatus = function () {
  if (this.status === "borrowed" && new Date() > this.dueDate) {
    this.status = "overdue";
    this.fine = this.calculateFine();
  }
  return this.status;
};

module.exports = mongoose.model("Borrow", borrowSchema);

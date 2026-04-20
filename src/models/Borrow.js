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
      enum: ["borrowed", "returned", "overdue"],
      default: "borrowed",
    },
    fine: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Calculate fine if book is overdue
borrowSchema.methods.calculateFine = function () {
  if (this.status === "returned") return this.fine;

  const today = new Date();
  if (today > this.dueDate) {
    const daysOverdue = Math.ceil(
      (today - this.dueDate) / (1000 * 60 * 60 * 24),
    );
    return daysOverdue * 5; // $5 per day fine
  }
  return 0;
};

module.exports = mongoose.model("Borrow", borrowSchema);

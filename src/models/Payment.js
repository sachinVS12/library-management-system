const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    borrow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Borrow",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentType: {
      type: String,
      enum: ["fine", "membership", "deposit", "donation"],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["credit_card", "debit_card", "cash", "bank_transfer", "online"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    receiptNumber: {
      type: String,
      unique: true,
    },
    cardDetails: {
      last4: String,
      cardType: String,
    },
    notes: {
      type: String,
    },
    refundDetails: {
      refundAmount: Number,
      refundDate: Date,
      reason: String,
    },
  },
  {
    timestamps: true,
  },
);

// Generate receipt number before saving
paymentSchema.pre("save", async function (next) {
  if (!this.receiptNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const count = await this.constructor.countDocuments();
    this.receiptNumber = `RCPT-${year}${month}-${String(count + 1).padStart(6, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Payment", paymentSchema);

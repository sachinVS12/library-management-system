const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a book title"],
      trim: true,
    },
    author: {
      type: String,
      required: [true, "Please add an author"],
      trim: true,
    },
    isbn: {
      type: String,
      required: [true, "Please add ISBN"],
      unique: true,
    },
    category: {
      type: String,
      required: [true, "Please add a category"],
      enum: [
        "Fiction",
        "Non-Fiction",
        "Science",
        "Technology",
        "History",
        "Biography",
        "Children",
        "Other",
      ],
    },
    quantity: {
      type: Number,
      required: [true, "Please add quantity"],
      min: 0,
    },
    available: {
      type: Number,
      required: true,
      min: 0,
    },
    location: {
      type: String,
      default: "Main Section",
    },
    description: {
      type: String,
      maxlength: 500,
    },
    coverImage: {
      type: String,
      default: "default-book.jpg",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Book", bookSchema);

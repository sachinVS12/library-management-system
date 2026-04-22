const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");
const Book = require("../models/Book");

dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGODB_URI);

const users = [
  {
    name: "Admin User",
    email: "admin@library.com",
    password: "admin123",
    role: "admin",
  },
  {
    name: "Librarian User",
    email: "librarian@library.com",
    password: "librarian123",
    role: "librarian",
  },
  {
    name: "John Doe",
    email: "john@example.com",
    password: "password123",
    role: "user",
  },
];

const books = [
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    isbn: "9780743273565",
    category: "Fiction",
    quantity: 5,
    available: 5,
    description: "A story of decadence and excess.",
  },
  {
    title: "1984",
    author: "George Orwell",
    isbn: "9780451524935",
    category: "Fiction",
    quantity: 8,
    available: 8,
    description: "A dystopian social science fiction novel.",
  },
  {
    title: "Introduction to Algorithms",
    author: "Thomas H. Cormen",
    isbn: "9780262033848",
    category: "Technology",
    quantity: 3,
    available: 3,
    description: "Comprehensive guide to algorithms.",
  },
  {
    title: "A Brief History of Time",
    author: "Stephen Hawking",
    isbn: "9780553380163",
    category: "Science",
    quantity: 4,
    available: 4,
    description: "Overview of cosmology for general audience.",
  },
];

const importData = async () => {
  try {
    await User.deleteMany();
    await Book.deleteMany();

    await User.create(users);
    await Book.create(books);

    console.log("Data Imported!");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const deleteData = async () => {
  try {
    await User.deleteMany();
    await Book.deleteMany();

    console.log("Data Destroyed!");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

if (process.argv[2] === "-i") {
  importData();
} else if (process.argv[2] === "-d") {
  deleteData();
}

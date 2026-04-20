const connectDB = require("./src/config/database");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load env vars
dotenv.config();

// Route files
const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/bookRoutes");
const borrowRoutes = require("./routes/borrowRoutes");

// Error middleware
const errorHandler = require("./middleware/errorMiddleware");

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/book", bookRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Library Management System API" });
});

// Error handler middleware
app.use(errorHandler);

module.exports = app;

// Connect to database
connectDB();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

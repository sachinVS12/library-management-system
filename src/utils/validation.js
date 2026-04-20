const { body, validationResult } = require("express-validator");

// Validation rules for user registration
const validateRegister = [
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/\d/)
    .withMessage("Password must contain a number"),
];

// Validation rules for book creation
const validateBook = [
  body("title").notEmpty().withMessage("Title is required").trim(),
  body("author").notEmpty().withMessage("Author is required").trim(),
  body("isbn")
    .notEmpty()
    .withMessage("ISBN is required")
    .isLength({ min: 10, max: 13 })
    .withMessage("ISBN must be 10 or 13 characters"),
  body("category")
    .isIn([
      "Fiction",
      "Non-Fiction",
      "Science",
      "Technology",
      "History",
      "Biography",
      "Children",
      "Other",
    ])
    .withMessage("Invalid category"),
  body("quantity")
    .isInt({ min: 0 })
    .withMessage("Quantity must be a positive number"),
];

// Middleware to check validation results
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

module.exports = { validateRegister, validateBook, checkValidation };

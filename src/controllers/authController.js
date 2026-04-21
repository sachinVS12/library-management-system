const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const ApiResponse = require("../utils/response");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return ApiResponse.error(res, "User already exists", 400);
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || "user",
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return ApiResponse.error(res, "Please provide email and password", 400);
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return ApiResponse.error(res, "Invalid credentials", 401);
    }

    // Check if membership is active
    if (!user.membershipActive || user.membershipExpiry < new Date()) {
      return ApiResponse.error(
        res,
        "Your membership has expired. Please renew.",
        403,
      );
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return ApiResponse.error(res, "Invalid credentials", 401);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// Get token and send response
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  ApiResponse.success(
    res,
    {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membershipExpiry: user.membershipExpiry,
      },
    },
    "Authentication successful",
    statusCode,
  );
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("borrowedBooks")
      .select("-password");

    ApiResponse.success(res, user, "User profile retrieved successfully");
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true, runValidators: true },
    ).select("-password");

    ApiResponse.success(res, user, "Profile updated successfully");
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select("+password");

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return ApiResponse.error(res, "Current password is incorrect", 401);
    }

    user.password = newPassword;
    await user.save();

    ApiResponse.success(res, null, "Password changed successfully");
  } catch (error) {
    ApiResponse.error(res, error.message, 500);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  changePassword,
};

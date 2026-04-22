const axios = require("axios");

const API_URL = "http://localhost:5000/api";

const testAPI = async () => {
  try {
    // Test root endpoint
    console.log("Testing API...\n");

    // 1. Register user
    console.log("1. Registering user...");
    const registerRes = await axios.post(`${API_URL}/auth/register`, {
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });
    console.log("✓ User registered successfully");
    const token = registerRes.data.data.token;

    // 2. Login
    console.log("\n2. Logging in...");
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: "test@example.com",
      password: "password123",
    });
    console.log("✓ Login successful");

    // 3. Get all books
    console.log("\n3. Fetching books...");
    const booksRes = await axios.get(`${API_URL}/books`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`✓ Found ${booksRes.data.data.books.length} books`);

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
};

testAPI();

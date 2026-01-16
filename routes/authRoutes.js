const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs"); // ১. এটি যোগ করুন

const createAuthRoutes = (usersCollection) => {
  const router = express.Router();

  // Login route
  // Login route inside createAuthRoutes
router.post("/user/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    // ✅ নির্দিষ্ট ৪টি রোল চেক করা হচ্ছে
    const allowedRoles = ["Super Admin", "Admin", "District Admin", "Sub-District Admin"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).send({ 
        success: false, 
        message: "Access Denied: You do not have permission to access the dashboard." 
      });
    }

    // পাসওয়ার্ড চেক
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send({ success: false, message: "Password is incorrect" });
    }

    const token = jwt.sign(
      { email: user.email, role: user.role },
      process.env.ACCESS_TOKEN_SECRET || "secret",
      { expiresIn: "1d" }
    );

    res.send({
      success: true,
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        category: user.category || "user",
        email_verified: user.email_verified ?? true,
      },
    });
  } catch (err) {
    res.status(500).send({ success: false, message: "Server error" });
  }
});

  return router;
};

module.exports = createAuthRoutes;
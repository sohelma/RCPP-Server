const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const createAuthRoutes = (usersCollection) => {
  const router = express.Router();

  /* =========================
     LOGIN
  ========================== */
  router.post("/user/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).send({
          success: false,
          message: "Email and password are required",
        });
      }

      const user = await usersCollection.findOne({ email });

      if (!user) {
        return res.status(404).send({
          success: false,
          message: "User not found",
        });
      }

      // ✅ Password check
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).send({
          success: false,
          message: "Invalid password",
        });
      }

      // ✅ Role check (dashboard access)
      const allowedRoles = [
        "Super Admin",
        "Admin",
        "District Admin",
        "Sub-District Admin",
        "user",
      ];

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).send({
          success: false,
          message: "Access denied",
        });
      }

      // ✅ JWT
      const token = jwt.sign(
        {
          id: user._id,
          email: user.email,
          role: user.role,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );

      // ✅ IMPORTANT: name এখানে পাঠানো হচ্ছে
      res.send({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,          // 🔥 Dashboard header এ এটা লাগবে
          email: user.email,
          role: user.role,
          phone: user.phone || "",
          profileImage: user.profileImage || "",
        },
      });
    } catch (err) {
      res.status(500).send({
        success: false,
        message: err.message,
      });
    }
  });

  /* =========================
     GET LOGGED IN USER (OPTIONAL BUT RECOMMENDED)
  ========================== */
  router.get("/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "No token provided" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET
      );

      const user = await usersCollection.findOne(
        { _id: new require("mongodb").ObjectId(decoded.id) },
        { projection: { password: 0 } }
      );

      res.send({ success: true, user });
    } catch (err) {
      res.status(401).send({ message: "Invalid token" });
    }
  });

  return router;
};

module.exports = createAuthRoutes;

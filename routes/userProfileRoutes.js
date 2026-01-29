const express = require("express");
const { ObjectId } = require("mongodb");
const upload = require("../middlewares/upload");
const bcrypt = require("bcryptjs");

const router = express.Router();

/* ---------- GET PROFILE ---------- */
router.get("/users/:id", async (req, res) => {
  try {
    const usersCollection = req.app.locals.usersCollection;
    const user = await usersCollection.findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { password: 0 } },
    );

    if (!user) {
      return res
        .status(404)
        .send({ success: false, message: "User not found" });
    }

    res.send({ success: true, data: user });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

/* ---------- UPDATE PROFILE ---------- */
router.put(
  "/users/profile/:id",
  // upload.single("profileImage"),
  async (req, res) => {
    try {
      const usersCollection = req.app.locals.usersCollection;
      const id = req.params.id;

      const updateData = {
        name: req.body.name,
        phone: req.body.phone,
        bio: req.body.bio,
        location: req.body.location,
        updatedAt: new Date(),
      };

      if (req.file) {
        updateData.profileImage = `/uploads/${req.file.filename}`;
      }

      // ১. ডাটা আপডেট করা
      await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );

      // ২. আপডেট হওয়া নতুন ডাটাটি আবার রিড করা (যাতে Redux এ আপডেট হয়)
      const updatedUser = await usersCollection.findOne(
        { _id: new ObjectId(id) },
        { projection: { password: 0 } },
      );

      res.send({
        success: true,
        message: "Profile updated successfully!",
        data: updatedUser,
      });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  },
);

// routes/profile.js (বা cases route)

router.get("/users/:id/assigned-reports", async (req, res) => {
  try {
    const casesCollection = req.app.locals.casesCollection;
    const userId = req.params.id;

    const reports = await casesCollection
      .find({ assignedTo: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();

    res.send({
      success: true,
      data: reports,
    });
  } catch (err) {
    res.status(500).send({
      success: false,
      message: err.message,
    });
  }
});




/* ---------- UPDATE PASSWORD ---------- */
router.patch("/users/update-password/:id", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const usersCollection = req.app.locals.usersCollection;
    const id = req.params.id;

    // ১. ইউজার খুঁজে বের করা
    const user = await usersCollection.findOne({ _id: new ObjectId(id) });
    if (!user) {
      return res
        .status(404)
        .send({ success: false, message: "User not found" });
    }

    // ২. বর্তমান পাসওয়ার্ড চেক করা
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .send({ success: false, message: "Current password is wrong" });
    }

    // ৩. নতুন পাসওয়ার্ড হ্যাশ করে আপডেট করা
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { password: hashedPassword, updatedAt: new Date() } },
    );

    res.send({ success: true, message: "Password updated successfully!" });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

module.exports = router;

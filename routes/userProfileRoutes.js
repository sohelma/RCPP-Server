const express = require("express");
const { ObjectId } = require("mongodb");
const upload = require("../middlewares/upload");

const router = express.Router();

/* ---------- GET PROFILE ---------- */
router.get("/users/:id", async (req, res) => {
  try {
    const usersCollection = req.app.locals.usersCollection;
    const user = await usersCollection.findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { password: 0 } }
    );

    res.send({ success: true, data: user });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

/* ---------- UPDATE PROFILE ---------- */
router.put(
  "/users/profile/:id",
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const usersCollection = req.app.locals.usersCollection;

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

      await usersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updateData }
      );

      res.send({ success: true, data: updateData });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  }
);

module.exports = router;

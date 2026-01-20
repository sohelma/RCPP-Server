const express = require("express");
const { ObjectId } = require("mongodb");
const router = express.Router();

const newsRoutes = (newsCollection, commentsCollection) => {
  // ১. সব নিউজ পাওয়ার জন্য (GET)
  router.get("/", async (req, res) => {
    try {
      const result = await newsCollection.find().sort({ date: -1 }).toArray();
      res.send({ success: true, data: result });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // ২. আইডি দিয়ে একটি নির্দিষ্ট নিউজ পাওয়ার জন্য (GET)
  router.get("/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await newsCollection.findOne(query);
      if (!result) {
        return res
          .status(404)
          .send({ success: false, message: "News not found" });
      }
      res.send({ success: true, data: result });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // ৩. নতুন নিউজ আপলোড করার জন্য (POST)
  router.post("/", async (req, res) => {
    try {
      const newsData = req.body;
      const finalNews = {
        ...newsData,
        date: newsData.date || new Date(),
        views: 0,
        likes: 0,
        commentsCount: 0,
        isFeatured:
          newsData.isFeatured === true || newsData.isFeatured === "true",
        isBreaking:
          newsData.isBreaking === true || newsData.isBreaking === "true",
      };
      const result = await newsCollection.insertOne(finalNews);
      res.status(201).send({ success: true, insertedId: result.insertedId });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // ৪. নিউজ ডিলিট করার জন্য (DELETE)
  router.delete("/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = await newsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send({ success: true, deletedCount: result.deletedCount });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // ==========================================
  // নতুন: কমেন্ট রাউটস (Comments Collection ব্যবহার করে)
  // ==========================================

  // ৫. নতুন কমেন্ট পোস্ট করা
  router.post("/post-comment", async (req, res) => {
    try {
      const { newsId, userName, text } = req.body;
      const finalComment = {
        newsId: new ObjectId(newsId),
        userName: userName || "Guest User",
        text,
        date: new Date(),
      };

      const result = await commentsCollection.insertOne(finalComment);

      await newsCollection.updateOne(
        { _id: new ObjectId(newsId) },
        { $inc: { commentsCount: 1 } },
      );

      res.status(201).send({
        success: true,
        data: { ...finalComment, _id: result.insertedId },
      });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // ৬. নির্দিষ্ট নিউজের সব কমেন্ট গেট করা
  router.get("/get-comments/:newsId", async (req, res) => {
    try {
      const newsId = req.params.newsId;
      const query = { newsId: new ObjectId(newsId) };
      const result = await commentsCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send({ success: true, data: result });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // ৭. নিউজে লাইক দেওয়া (PATCH)
  router.patch("/like/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = await newsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { likes: 1 } },
      );
      res.send({ success: true, modifiedCount: result.modifiedCount });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  return router;
};

module.exports = newsRoutes;

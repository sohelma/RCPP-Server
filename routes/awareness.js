const express = require("express");
const { ObjectId } = require("mongodb");
const router = express.Router();

const createAwarenessRoutes = (awarenessCollection, alertCollection) => {
  //  Awareness
  router.get("/", async (req, res) => {
    try {
      const { type, q } = req.query;
      let query = {};

      if (type && type !== "all") {
        query.type = type;
      }

      if (q) {
        query.$or = [
          { titleEn: { $regex: q, $options: "i" } },
          { titleBn: { $regex: q, $options: "i" } },
          { descriptionEn: { $regex: q, $options: "i" } },
          { descriptionBn: { $regex: q, $options: "i" } },
        ];
      }

      const result = await awarenessCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Error fetching data", error: error.message });
    }
  });

  //  alertCollection
  router.get("/alerts", async (req, res) => {
    try {
      const result = await alertCollection
        .find({})
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();
      res.send(result);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Alert fetch error", error: error.message });
    }
  });
  // details post
  router.get("/details/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).send("Invalid ID");

      const query = { _id: new ObjectId(id) };
      const result = await awarenessCollection.findOne(query);

      if (result) {
        if (typeof result.views === "number") {
          await awarenessCollection.updateOne(query, { $inc: { views: 1 } });
        }
      }

      res.send(result);
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Server Error" });
    }
  });
  // Add post
  router.post("/add", async (req, res) => {
    try {
      const content = req.body;
      const result = await awarenessCollection.insertOne({
        ...content,
        views: 0,
        downloads: 0,
        createdAt: new Date(),
      });
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: "Failed to add content" });
    }
  });

  // Update post

  router.patch("/update/:id", async (req, res) => {
    try {
      const id = req.params.id;
      if (!ObjectId.isValid(id))
        return res.status(400).send({ success: false, message: "Invalid ID" });

      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...req.body,
          updatedAt: new Date(),
        },
      };

      const result = await awarenessCollection.updateOne(query, updateDoc);

      if (result.matchedCount === 1) {
        res.status(200).send({
          success: true,
          message: "Updated successfully",
          modifiedCount: result.modifiedCount,
        });
      } else {
        res.status(404).send({ success: false, message: "Post not found" });
      }
    } catch (error) {
      res.status(500).send({
        success: false,
        message: "Update error",
        error: error.message,
      });
    }
  });

  // Detele Post
  router.delete("/delete/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await awarenessCollection.deleteOne(query);

      if (result.deletedCount === 1) {
        res
          .status(200)
          .send({ success: true, message: "Deleted successfully" });
      } else {
        res
          .status(404)
          .send({ success: false, message: "No document found to delete" });
      }
    } catch (error) {
      res.status(500).send({ message: "Delete error", error: error.message });
    }
  });
  // Like API for Awareness
  router.patch("/like/:id", async (req, res) => {
    try {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) return res.status(400).send("Invalid ID");

      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $inc: { likes: 1 } };

      const result = await awarenessCollection.updateOne(filter, updateDoc);

      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Content not found" });
      }

      res.send({ success: true, message: "Liked successfully", result });
    } catch (error) {
      res.status(500).send({ message: "Like error", error: error.message });
    }
  });

  return router;
};

module.exports = createAwarenessRoutes;

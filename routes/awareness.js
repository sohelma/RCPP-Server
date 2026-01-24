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

  return router;
};

module.exports = createAwarenessRoutes;

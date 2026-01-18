const express = require("express");
const { ObjectId } = require("mongodb");
const nodemailer = require("nodemailer");

const createHelpDeskRoutes = (helpDeskCollection) => {
  const router = express.Router();

  /* ============ MAIL SETUP ============ */
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  /* ============ CREATE MESSAGE ============ */
  router.post("/contact-helpdesk", async (req, res) => {
    try {
      const { name, email, technicalSupport, description } = req.body;

      if (!name || !email || !technicalSupport || !description) {
        return res.status(400).send({
          success: false,
          message: "All fields are required",
        });
      }

      const helpDeskData = {
        name,
        email,
        technicalSupport,
        description,
        isRead: false,
        createdAt: new Date(),
      };

      await helpDeskCollection.insertOne(helpDeskData);

      await transporter.sendMail({
        from: `"RCPP Help Desk" <${process.env.EMAIL_USER}>`,
        to: "support@rcpp.gov.bd",
        subject: `Help Desk Request: ${technicalSupport}`,
        html: `
          <h3>New Help Desk Message</h3>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Issue:</b> ${technicalSupport}</p>
          <p>${description}</p>
        `,
      });

      res.status(201).send({
        success: true,
        message: "Message sent successfully",
      });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  /* ============ GET ALL ============ */
  router.get("/contact-helpdesk", async (req, res) => {
    const data = await helpDeskCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.send(data);
  });

  /* ============ GET SINGLE ============ */
  router.get("/contact-helpdesk/:id", async (req, res) => {
    const data = await helpDeskCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    res.send({ success: true, data });
  });

  /* ============ MARK AS READ ============ */
  router.patch("/contact-helpdesk/:id/read", async (req, res) => {
    await helpDeskCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { isRead: true } }
    );

    res.send({ success: true });
  });

  return router;
};

module.exports = createHelpDeskRoutes;

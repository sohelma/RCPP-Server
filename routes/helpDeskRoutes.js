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
  from: `"RCPP Help Desk" <${process.env.SMTP_USER}>`,
  to: "support@rcpp.gov.bd",
  replyTo: email, // 🔥 user er email e reply kora jabe
  subject: `🆘 Help Desk Request | ${technicalSupport}`,
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color:#16a34a;">📩 New Help Desk Request</h2>
      <hr />

      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Category:</b> ${technicalSupport}</p>

      <h4>Description</h4>
      <p style="background:#f1f5f9; padding:12px; border-radius:8px;">
        ${description}
      </p>

      <hr />
      <p style="font-size:12px; color:#64748b;">
        Sent from RCPP Help Desk System<br/>
        ${new Date().toLocaleString()}
      </p>
    </div>
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

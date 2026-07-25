const express = require("express");

const {
  completeAttachmentUpload,
  getAttachmentById,
  initiateAttachmentUpload,
  listAttachments,
} = require("../controllers/attachmentController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", listAttachments);

router.post("/uploads", initiateAttachmentUpload);

router.post("/:id/complete", completeAttachmentUpload);

router.get("/:id", getAttachmentById);

module.exports = router;

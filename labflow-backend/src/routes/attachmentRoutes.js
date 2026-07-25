const express = require("express");

const {
  archiveAttachment,
  completeAttachmentUpload,
  createAttachmentDownloadUrl,
  getAttachmentById,
  initiateAttachmentUpload,
  listAttachments,
  updateAttachmentMetadata,
} = require("../controllers/attachmentController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", listAttachments);

router.post("/uploads", initiateAttachmentUpload);

router.post("/:id/complete", completeAttachmentUpload);

router.get("/:id/download", createAttachmentDownloadUrl);

router.post("/:id/archive", archiveAttachment);

router.patch("/:id", updateAttachmentMetadata);

router.get("/:id", getAttachmentById);

module.exports = router;

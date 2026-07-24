const express = require("express");

const {
  completeAttachmentUpload,
  initiateAttachmentUpload,
} = require("../controllers/attachmentController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/uploads", initiateAttachmentUpload);

router.post("/:id/complete", completeAttachmentUpload);

module.exports = router;

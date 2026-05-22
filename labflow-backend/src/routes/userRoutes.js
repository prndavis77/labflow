const express = require("express");
const { getUsers } = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Every user route requires authentication.
router.use(protect);

// All authenticated users can view user summaries for task assignment
// Later, this can be restricted by lab membership
router.get("/", getUsers);

module.exports = router;

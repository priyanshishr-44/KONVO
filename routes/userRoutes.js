// ==========================================
// KONVO - USER ROUTES
// ==========================================

const express = require("express");
const User = require("../models/User");
const Room = require("../models/Room");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// ==========================================
// GET LOGGED-IN USER
// ==========================================

router.get("/me", authMiddleware, async (req, res) => {

    try {

        const user = await User.findById(req.user.id)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {

        console.error("Get User Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch user."
        });

    }

});


// ==========================================
// GET MY ROOMS
// ==========================================

router.get("/my-rooms", authMiddleware, async (req, res) => {

    try {

        const rooms = await Room.find({

            $or: [
                { createdBy: req.user.id },
                { members: req.user.id }
            ]

        })
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            rooms
        });

    } catch (error) {

        console.error("My Rooms Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch rooms."
        });

    }

});


// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;
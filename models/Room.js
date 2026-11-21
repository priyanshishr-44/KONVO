// ==========================================
// KONVO - ROOM MODEL
// ==========================================

const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({

    roomCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]

}, {
    timestamps: true
});

module.exports = mongoose.model("Room", roomSchema);
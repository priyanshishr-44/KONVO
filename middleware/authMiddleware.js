const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    try {
        const token = req.cookies.konvoToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Please login to access this page."
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired session. Please login again."
        });
    }
};

module.exports = authMiddleware;
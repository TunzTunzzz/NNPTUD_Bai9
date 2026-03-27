const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const userController = require('../controllers/users')

// Đọc public key từ file để verify JWT (RS256)
const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, '../public.pem'), 'utf8')

module.exports = {
    checkLogin: async function (req, res, next) {
        let token = req.headers.authorization;
        if (!token || !token.startsWith("Bearer ")) {
            return res.status(403).send("ban chua dang nhap");
        }
        token = token.split(" ")[1];
        try {
            // Verify bằng public key, thuật toán RS256
            let result = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] })
            let user = await userController.FindById(result.id)
            if (!user) {
                return res.status(403).send("ban chua dang nhap");
            } else {
                req.user = user;
                next()
            }
        } catch (error) {
            return res.status(403).send("ban chua dang nhap");
        }
    },
    CheckPermission: function (...requiredRole) {
        return function (req, res, next) {
            // Need to handle if req.user or req.user.role is not fully populated
            let role = req.user && req.user.role ? req.user.role.name : '';
            console.log("User Role:", role);
            if (requiredRole.includes(role)) {
                next();
            } else {
                res.status(403).send("ban khong co quyen");
            }
        }
    }
}

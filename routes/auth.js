var express = require('express');
var router = express.Router();
const fs = require('fs')
const path = require('path')
let userController = require('../controllers/users')
let { RegisterValidator, ChangePasswordValidator, handleResultValidator } = require('../utils/validatorHandler')
let bcrypt = require('bcrypt')
let jwt = require('jsonwebtoken')
let { checkLogin } = require('../utils/authHandler')
let crypto = require('crypto')
let { sendMail } = require('../utils/senMailHandler')
let cartSchema = require('../schemas/carts')
let mongoose = require('mongoose')

// Đọc private key từ file để sign JWT (RS256)
const PRIVATE_KEY = fs.readFileSync(path.join(__dirname, '../private.pem'), 'utf8')

/* POST /auth/register */
router.post('/register', RegisterValidator, handleResultValidator, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction()
    try {
        let newUser = userController.CreateAnUser(
            req.body.username,
            req.body.password,
            req.body.email,
            "69aa8360450df994c1ce6c4c"
        );
        await newUser.save({ session })
        let newCart = new cartSchema({
            user: newUser._id
        })
        await newCart.save({ session });
        await newCart.populate('user')
        await session.commitTransaction()
        await session.endSession()
        res.send({ message: "dang ki thanh cong" })
    } catch (err) {
        await session.abortTransaction()
        await session.endSession()
        res.status(500).send({ message: err.message });
    }
});

/* POST /auth/login */
router.post('/login', async function (req, res, next) {
    let { username, password } = req.body;
    let getUser = await userController.FindByUsername(username);
    if (!getUser) {
        return res.status(403).send("tai khoan khong ton tai")
    }
    if (getUser.lockTime && getUser.lockTime > Date.now()) {
        return res.status(403).send("tai khoan dang bi ban");
    }
    if (bcrypt.compareSync(password, getUser.password)) {
        await userController.SuccessLogin(getUser);
        // Ký JWT bằng private key, thuật toán RS256
        let token = jwt.sign(
            { id: getUser._id },
            PRIVATE_KEY,
            {
                algorithm: 'RS256',
                expiresIn: '30d'
            }
        )
        res.cookie('token_login_tungNT', token, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: false
        });
        res.send(token)
    } else {
        await userController.FailLogin(getUser);
        res.status(403).send("thong tin dang nhap khong dung")
    }
});
/* GET /auth/me - yêu cầu đăng nhập */
router.get('/me', checkLogin, function (req, res, next) {
    res.send(req.user)
})
// Fix missing slashes and validator name
router.post("/changepassword", checkLogin, ChangePasswordValidator, function (req, res, next) {
    let { oldPassword, newPassword } = req.body;
    let user = req.user;
    if (bcrypt.compareSync(oldPassword, user.password)) {
        user.password = newPassword;
        user.save();
    }
    res.send("da doi pass");
})
router.post("/logout", checkLogin, function (req, res, next) {
    res.cookie('token_login_tungNT', null, {
        maxAge: 0,
        httpOnly: true,
        secure: false
    })
    res.send("logout")
})
router.post('/forgotpassword', async function (req, res, next) {
    let email = req.body.email;
    let user = await userController.FindByEmail(email);
    if (user) {
        user.resetPasswordToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordTokenExp = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        let url = "http://localhost:3000/api/v1/auth/resetpassword/" + user.resetPasswordToken;
        await sendMail(user.email, url);
    }
    res.send("check mail de biet")
})
router.post('/resetpassword/:token', async function (req, res, next) {
    let { password } = req.body;
    let token = req.params.token;
    let user = await userController.FindByToken(token);
    if (!user) {
        res.status(404).send("token sai")
    } else {
        if (user.resetPasswordTokenExp > Date.now()) {
            user.password = password;
            user.resetPasswordToken = null;
            user.resetPasswordTokenExp = null;
            await user.save();
        }
    }
})

/* POST /auth/change-password - yêu cầu đăng nhập */
router.post('/change-password', checkLogin, ChangePasswordValidator, handleResultValidator, async function (req, res, next) {
    let { oldPassword, newPassword } = req.body;
    let user = req.user; // đã được gắn bởi checkLogin

    // Kiểm tra mật khẩu cũ có đúng không
    let isMatch = bcrypt.compareSync(oldPassword, user.password);
    if (!isMatch) {
        return res.status(400).send("Mat khau cu khong dung");
    }

    // Không được đặt newPassword trùng oldPassword
    if (bcrypt.compareSync(newPassword, user.password)) {
        return res.status(400).send("Mat khau moi khong duoc trung mat khau cu");
    }

    // Cập nhật mật khẩu mới (schema pre-save hook sẽ tự hash)
    user.password = newPassword;
    await user.save();

    res.send({ message: "Doi mat khau thanh cong" });
});

module.exports = router;

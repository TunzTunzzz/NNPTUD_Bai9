const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../schemas/messages');
const { checkLogin } = require('../utils/authHandler');
const multer = require('multer');
const path = require('path');

// Cấu hình Multer để upload file đính kèm
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/")
    },
    filename: function (req, file, cb) {
        let ext = path.extname(file.originalname);
        let name = Date.now() + "-" + Math.round(Math.random() * 2E9) + ext;
        cb(null, name);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET / - Lấy message cuối cùng của mỗi cuộc trò chuyện
router.get('/', checkLogin, async (req, res) => {
    try {
        const currentUserId = req.user._id;

        // Sử dụng aggregation pipeline để tìm tin nhắn cuối cùng với mỗi người
        const lastMessages = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { from: new mongoose.Types.ObjectId(currentUserId.toString()) },
                        { to: new mongoose.Types.ObjectId(currentUserId.toString()) }
                    ]
                }
            },
            {
                $sort: { createdAt: -1 } // Sắp xếp giảm dần theo thời gian
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$from", new mongoose.Types.ObjectId(currentUserId.toString())] },
                            "$to",
                            "$from"
                        ]
                    },
                    lastMessage: { $first: "$$ROOT" }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "conversantInfo"
                }
            },
            {
                $unwind: { path: "$conversantInfo", preserveNullAndEmptyArrays: true }
            },
            {
                $project: {
                    _id: 0,
                    partner: {
                        _id: "$conversantInfo._id",
                        username: "$conversantInfo.username",
                        fullName: "$conversantInfo.fullName"
                    },
                    message: "$lastMessage"
                }
            },
            {
                $sort: { "message.createdAt": -1 } // Sắp xếp lại theo thời gian mới nhất
            }
        ]);

        res.status(200).json(lastMessages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// GET /:userID - Lấy lịch sử nhắn tin giữa user hiện tại và userID
router.get('/:userID', checkLogin, async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const targetUserId = req.params.userID;

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: "userID không hợp lệ" });
        }

        const messages = await Message.find({
            $or: [
                { from: currentUserId, to: targetUserId },
                { from: targetUserId, to: currentUserId }
            ]
        }).sort({ createdAt: 1 }); // Tin nhắn cũ nhất lên trước

        res.status(200).json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// POST / - Gửi nội dung tin nhắn
router.post('/', checkLogin, upload.single('file'), async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const { to, text } = req.body;

        if (!to) {
            return res.status(400).json({ message: "Thiếu thông tin người nhận (to)." });
        }

        let msgType = "text";
        let msgContent = text || "";

        // Kiểm tra xem request có file truyền lên hay không
        if (req.file) {
            msgType = "file";
            msgContent = req.file.path.replace(/\\/g, "/"); // Trả về đường dẫn của file
        } else {
            if (!msgContent.trim()) {
                return res.status(400).json({ message: "Nội dung text không được để trống khi không có file." });
            }
        }

        const newMessage = new Message({
            from: currentUserId,
            to: to,
            messageContent: {
                type: msgType,
                text: msgContent
            }
        });

        await newMessage.save();

        res.status(201).json(newMessage);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

var express = require("express");
var router = express.Router();
let { checkLogin, CheckPermission } = require('../utils/authHandler')
let { userCreateValidator
    , userUpdateValidator
    , handleResultValidator } = require('../utils/validatorHandler')
let userController = require("../controllers/users");
let userModel = require('../schemas/users');

let { uploadExcel } = require('../utils/upload');
let exceljs = require('exceljs');
let path = require('path');
let crypto = require('crypto');
let RoleModel = require('../schemas/roles');
let { sendPassword } = require('../utils/senMailHandler');


router.get("/", checkLogin, CheckPermission("ADMIN")
    , async function (req, res, next) {
        let users = await userController.GetAllUser();
        res.send(users);
    });

router.get("/:id", async function (req, res, next) {
    try {
        let result = await userModel
            .find({ _id: req.params.id, isDeleted: false })
        if (result.length > 0) {
            res.send(result);
        }
        else {
            res.status(404).send({ message: "id not found" });
        }
    } catch (error) {
        res.status(404).send({ message: "id not found" });
    }
});

router.post("/", userCreateValidator, handleResultValidator,
    async function (req, res, next) {
        try {
            let newItem = userController.CreateAnUser(
                req.body.username,
                req.body.password,
                req.body.email,
                req.body.role,
                req.body.fullName,
                req.body.avatarUrl,
                req.body.status,
                req.body.loginCount
            )
            await newItem.save();

            let saved = await userModel.findById(newItem._id)
            res.send(saved);
        } catch (err) {
            res.status(400).send({ message: err.message });
        }
    });

router.post("/import", uploadExcel.single('file'), async function (req, res, next) {
    if (!req.file) {
        return res.status(400).send({ message: "Excel file is required" });
    }

    try {
        let userRole = await RoleModel.findOne({ name: { $in: ['USER', 'user'] } });
        if (!userRole) {
             userRole = await RoleModel.create({ name: 'USER' });
        }

        let workbook = new exceljs.Workbook();
        let pathFile = path.join(__dirname, "../uploads", req.file.filename);
        await workbook.xlsx.readFile(pathFile);
        let worksheet = workbook.worksheets[0];
        
        let result = [];

        for (let row = 2; row <= worksheet.rowCount; row++) {
            let rowErrors = [];
            let cells = worksheet.getRow(row);
            
            let unCell = cells.getCell(1).value;
            let emCell = cells.getCell(2).value;

            let username = unCell?.result ? unCell.result : unCell;
            let email = emCell?.result ? emCell.result : emCell;

            if (!username && !email) {
                continue; // Skip completely empty rows
            }
            if (!username || !email) {
                rowErrors.push("username and email are required");
                result.push({ row, errors: rowErrors });
                continue;
            }

            let existingUser = await userModel.findOne({ $or: [{ username }, { email }] });
            if (existingUser) {
                rowErrors.push(`User ${username} or email ${email} already exists`);
                result.push({ row, errors: rowErrors });
                continue;
            }

            let password = crypto.randomBytes(8).toString('hex'); // 16 characters random string
            
            let newUser = new userModel({
                username: username,
                email: email,
                password: password,
                role: userRole._id,
                fullName: username
            });
            await newUser.save();
            
            try {
                await sendPassword(email, password);
                result.push({ row, username, email, status: 'success', emailSent: true });
            } catch (err) {
                result.push({ row, username, email, status: 'success', emailSent: false, error: err.message });
            }
        }
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

router.put("/:id", userUpdateValidator, handleResultValidator, async function (req, res, next) {
    try {
        let id = req.params.id;
        //c1
        let updatedItem = await
            userModel.findByIdAndUpdate(id, req.body, { new: true });

        if (!updatedItem)
            return res.status(404).send({ message: "id not found" });
        //c2
        // let updatedItem = await userModel.findById(id);
        // if (updatedItem) {
        //     let keys = Object.keys(req.body);
        //     for (const key of keys) {
        //         getUser[key] = req.body[key]
        //     }
        // }
        // await updatedItem.save()
        let populated = await userModel
            .findById(updatedItem._id)
        res.send(populated);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.delete("/:id", async function (req, res, next) {
    try {
        let id = req.params.id;
        let updatedItem = await userModel.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true }
        );
        if (!updatedItem) {
            return res.status(404).send({ message: "id not found" });
        }
        res.send(updatedItem);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;
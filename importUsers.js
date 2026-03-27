const mongoose = require('mongoose');
const exceljs = require('exceljs');
const path = require('path');
const crypto = require('crypto');
const UserModel = require('./schemas/users');
const RoleModel = require('./schemas/roles');
const { sendPassword } = require('./utils/senMailHandler');

async function importUsers() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect('mongodb+srv://namcutevll78_db_user:Tunz@test.slilyur.mongodb.net/NNPTUD-C6');
        console.log("Connected to MongoDB.");

        // First find or create the User role
        let userRole = await RoleModel.findOne({ name: { $in: ['USER', 'user'] } });
        if (!userRole) {
            userRole = await RoleModel.create({ name: 'USER', description: 'Default user role created by import' });
            console.log("Created 'USER' role as it didn't exist.");
        }

        let workbook = new exceljs.Workbook();
        let filepath = path.join(__dirname, 'user.xlsx');
        console.log(`Reading file: ${filepath}`);
        await workbook.xlsx.readFile(filepath);
        let worksheet = workbook.worksheets[0];

        // Start from row 2 assuming row 1 is header
        for (let row = 2; row <= worksheet.rowCount; row++) {
            let cells = worksheet.getRow(row);
            
            let unCell = cells.getCell(1).value;
            let emCell = cells.getCell(2).value;

            // In exceljs, values can be objects when formulas are used
            let username = unCell?.result ? unCell.result : unCell;
            let email = emCell?.result ? emCell.result : emCell;

            if (!username || !email) {
                continue; // Skip empty rows
            }

            // Avoid duplication based on username or email
            let existingUser = await UserModel.findOne({ $or: [{ username }, { email }] });
            if (existingUser) {
                console.log(`User ${username} or email ${email} already exists in DB. Skipping...`);
                continue;
            }

            // Generate 16 character random string (8 bytes hex is 16 chars)
            let generatedPassword = crypto.randomBytes(8).toString('hex');

            let newUser = new UserModel({
                username: username,
                email: email,
                password: generatedPassword,
                role: userRole._id,
                fullName: username
            });
            await newUser.save();
            console.log(`Created new user: ${username}`);

            // Send Email with password
            try {
                await sendPassword(email, generatedPassword);
                console.log(`-> Sent password email to ${email}`);
            } catch (err) {
                console.error(`-> Failed to send email to ${email}. Error:`, err.message);
            }
        }
        
        console.log("Data Import Completed successfully.");
    } catch (error) {
        console.error("Data Import Failed:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

importUsers();

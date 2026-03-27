const nodemailer = require("nodemailer");

// Create a transporter using Mailtrap credentials.
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525, // Port phổ biến của Mailtrap
    auth: {
        user: process.env.MAILTRAP_USER || "c07e5dc267298d", 
        pass: process.env.MAILTRAP_PASS || "d350682680523e", 
    },
});
//http://localhost:3000/api/v1/auth/resetpassword/a87edf6812f235e997c7b751422e6b2f5cd95aa994c55ebeeb931ca67214d645

// Send an email using async/await;
module.exports = {
    sendMail: async function (to,url) {
        const info = await transporter.sendMail({
            from: 'admin@hehehe.com',
            to: to,
            subject: "reset pass",
            text: "click vo day de doi pass", // Plain-text version of the message
            html: "click vo <a href="+url+">day</a> de doi pass", // HTML version of the message
        });
    },
    sendPassword: async function (to, password) {
        const info = await transporter.sendMail({
            from: 'admin@hehehe.com',
            to: to,
            subject: "Your New Account Password",
            text: `Your account has been created. Your password is: ${password}`,
            html: `<p>Your account has been created.</p><p>Your password is: <strong>${password}</strong></p>`
        });
    }
}
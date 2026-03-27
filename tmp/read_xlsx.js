const exceljs = require('exceljs');
const path = require('path');

async function run() {
    let workbook = new exceljs.Workbook();
    await workbook.xlsx.readFile(path.join(__dirname, '../user.xlsx'));
    let worksheet = workbook.worksheets[0];
    for (let i = 1; i <= 3; i++) {
        let row = worksheet.getRow(i).values;
        console.log(`Row ${i}:`, row);
    }
}
run().catch(console.error);

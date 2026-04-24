const fs = require('fs');
const execData = JSON.parse(fs.readFileSync('C:\\Users\\sebas\\.gemini\\antigravity\\brain\\26fbf97c-4f06-4cae-a508-b168dc22be76\\.system_generated\\steps\\10579\\output.txt', 'utf8'));

const extractNode = execData.data.resultData.runData['Extract Result'];
if (extractNode) {
  console.log(JSON.stringify(extractNode[0].data.main[0][0], null, 2));
} else {
  console.log("Not found");
}

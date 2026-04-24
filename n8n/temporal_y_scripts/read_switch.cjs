const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('C:\\Users\\sebas\\.gemini\\antigravity\\brain\\26fbf97c-4f06-4cae-a508-b168dc22be76\\.system_generated\\steps\\10456\\output.txt', 'utf8'));

const switchNode = wf.nodes.find(n => n.name === 'Action Switch');
console.log(JSON.stringify(switchNode.parameters, null, 2));

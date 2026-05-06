const args = process.argv.slice(2);
const taskArgs = args[0] === "--" ? args.slice(1) : args;
const task = taskArgs.join(" ");

if (task.length > 0) {
  console.log(`Browser agent task: ${task}`);
} else {
  console.log("Browser agent project initialized.");
}

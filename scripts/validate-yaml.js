const { runValidation } = require('./utils/runner');

async function main() {
	const ok = await runValidation({
		format: 'yaml',
		extensions: ['.yaml', '.yml'],
		verbose: process.argv.includes('--verbose'),
	});
	if (require.main === module) {
		process.exit(ok ? 0 : 1);
	}
	return ok;
}

if (require.main === module) {
	main();
}

module.exports = { main };

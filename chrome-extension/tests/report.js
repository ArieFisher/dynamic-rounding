// --- Report ---
Promise.all(pendingChecks).then(() => {
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed > 0) {
    for (const f of failures) {
      console.log(`\n  ${f.name}`);
      console.log(`    expected: ${JSON.stringify(f.expected)}`);
      console.log(`    actual:   ${JSON.stringify(f.actual)}`);
    }
    process.exit(1);
  }
}, (error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

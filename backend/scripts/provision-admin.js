// Run only from the server console; this is not exposed as an HTTP endpoint.
try {
  const { provisionAdmin } = require('../services/authService');
  const user = provisionAdmin({
    email: process.env.CALAR_ADMIN_EMAIL,
    password: process.env.CALAR_ADMIN_PASSWORD,
  });
  console.log(`Admin account ready: ${user.email} (id=${user.id})`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

module.exports = {
  apps: [
    {
      name: "accounting-app",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        // Add your DB credentials here or read them from .env
      },
    },
  ],
};
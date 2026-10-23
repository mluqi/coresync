module.exports = {
  apps: [
    {
      name: 'coresync-backend',
      script: 'server.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      }
    }
  ]
};

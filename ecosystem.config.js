module.exports = {
  apps: [
    {
      name: 'domi-server',
      script: 'dist/main.js', // 生产环境启动文件
      cwd: process.env.DEPLOY_DIR ? `${process.env.DEPLOY_DIR}/domi-server-current` : './domi-server-current', // 从环境变量读取部署目录
      instances: 1, // 实例数量，可以设置为 'max' 来使用所有CPU核心
      exec_mode: 'cluster', // 集群模式
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        APP_VERSION: process.env.APP_VERSION || 'unknown',
        ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY || '',
        STT_AK: process.env.STT_AK || '',
        STT_APPID: process.env.STT_APPID || '',
        STT_CLUSTER: process.env.STT_CLUSTER || ''
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        APP_VERSION: process.env.APP_VERSION || 'unknown',
        ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY || '',
        STT_AK: process.env.STT_AK || '',
        STT_APPID: process.env.STT_APPID || '',
        STT_CLUSTER: process.env.STT_CLUSTER || ''
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        APP_VERSION: process.env.APP_VERSION || 'dev-unknown',
        ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY || '',
        STT_AK: process.env.STT_AK || '',
        STT_APPID: process.env.STT_APPID || '',
        STT_CLUSTER: process.env.STT_CLUSTER || ''
      },
      // 日志配置
      log_file: process.env.DEPLOY_DIR ? `${process.env.DEPLOY_DIR}/logs/combined.log` : './logs/combined.log',
      out_file: process.env.DEPLOY_DIR ? `${process.env.DEPLOY_DIR}/logs/out.log` : './logs/out.log',
      error_file: process.env.DEPLOY_DIR ? `${process.env.DEPLOY_DIR}/logs/error.log` : './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // 重启策略
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // 监听文件变化（开发环境）
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      
      // 内存限制
      max_memory_restart: '1G',
      
      // 其他配置
      autorestart: true,
      kill_timeout: 5000,
      
      // 移除env_file配置，改为从系统环境变量读取
      // env_file: '.env'
    }
  ],
  
  deploy: {
    production: {
      user: 'root',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'your-git-repo',
      path: '/code/domi-server',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
}; 
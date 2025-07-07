# 部署说明

本项目提供了两种GitHub Action自动化部署方案：

## 1. 传统部署方案 (deploy.yml)

### 配置步骤：

1. **设置GitHub Secrets**
   在您的GitHub仓库设置中添加以下secrets：
   - `HOST`: 服务器IP地址
   - `USERNAME`: SSH用户名
   - `SSH_KEY`: SSH私钥
   - `PORT`: SSH端口（可选，默认22）

2. **服务器环境准备**
   确保服务器已安装：
   - Node.js 18+
   - pnpm
   - PM2
   - Git

3. **创建环境变量文件**
   在服务器上创建 `/var/www/ttc-be/.env` 文件，参考以下配置：
   ```env
   NODE_ENV=production
   PORT=3000
   OPENAI_API_KEY=your_openai_api_key_here
   # 其他必要的环境变量...
   ```

## 2. Docker部署方案 (docker-deploy.yml)

### 配置步骤：

1. **设置GitHub Secrets**
   - `HOST`: 服务器IP地址
   - `USERNAME`: SSH用户名
   - `SSH_KEY`: SSH私钥
   - `PORT`: SSH端口（可选，默认22）

2. **服务器环境准备**
   确保服务器已安装：
   - Docker
   - Docker Compose（可选）

3. **创建环境变量文件**
   在服务器上创建 `/var/www/ttc-be/.env` 文件

4. **创建音频目录**
   ```bash
   mkdir -p /var/www/ttc-be/audio
   ```

## 环境变量配置示例

```env
# 应用配置
NODE_ENV=production
PORT=3000

# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key_here

# 音频处理配置
AUDIO_UPLOAD_PATH=./audio
AUDIO_MAX_SIZE=52428800
AUDIO_ALLOWED_TYPES=audio/wav,audio/mp3,audio/mp4

# WebSocket配置
WEBSOCKET_PORT=3001
WEBSOCKET_CORS_ORIGIN=*

# 日志配置
LOG_LEVEL=info

# CORS配置
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
```

## 使用建议

- **开发环境**: 使用 `deploy.yml` 进行快速部署
- **生产环境**: 推荐使用 `docker-deploy.yml` 进行容器化部署

## 注意事项

1. 首次部署前，请确保服务器环境已正确配置
2. 请根据实际需求修改端口号和路径
3. 确保所有必要的环境变量都已正确设置
4. 建议定期备份重要数据

## 故障排除

如果部署失败，请检查：
1. GitHub Secrets是否正确设置
2. 服务器SSH连接是否正常
3. 服务器环境是否满足要求
4. 环境变量是否正确配置 
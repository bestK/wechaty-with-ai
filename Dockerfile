# 使用Node.js LTS版本作为基础镜像
FROM node:lts-alpine

# 设置工作目录为/app
WORKDIR /app

# 复制package.json和package-lock.json（如果存在）到工作目录
COPY package*.json ./

# 使用npm ci代替npm install以进行更快的安装
RUN npm ci --only=production

# 复制项目文件到工作目录
COPY . .

# 容器启动时运行的命令
CMD ["node", "index.js"]

FROM node:18-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install -g typescript ts-node && npm install --save-dev typescript @types/node

COPY . .
RUN mkdir -p uploads

# Компилируем через прямой вызов tsc.js
RUN node node_modules/typescript/lib/tsc.js

EXPOSE 3000

CMD ["npm", "start"]
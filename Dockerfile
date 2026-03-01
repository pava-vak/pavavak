FROM node:20-slim
WORKDIR /app
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm install
RUN npx prisma generate
COPY backend/ ./
COPY frontend/ ./frontend/
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]
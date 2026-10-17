FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=8000 DATA_DIR=/data
EXPOSE 8000
CMD ["node","server.js"]

FROM node:22-alpine

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install --omit=dev

COPY frontend/ .

EXPOSE 3000

CMD ["npm", "start"]

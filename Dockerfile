FROM node:18

RUN apt update && apt install -y ffmpeg python3 python3-pip

RUN pip3 install yt-dlp --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
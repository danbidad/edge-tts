FROM node:20-alpine

WORKDIR /work

COPY package*.json ./app/
RUN cd ./app && npm install

EXPOSE 3000
EXPOSE 9300

WORKDIR /work/app

CMD ["npm", "run", "b:dev"]

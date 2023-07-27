FROM node:18.17.0-alpine3.18
 

WORKDIR /app
COPY package.json /app/
RUN  npm install 

COPY . /app/

#fix 依赖冲突
CMD npm install replicate \ 
    &&  node index.js
 
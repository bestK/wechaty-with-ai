FROM node:18.17.0-alpine3.18

WORKDIR /app

COPY package.json /app/
RUN  npm install \
    && rm -fr /tmp/* ~/.npm

COPY . /app/

#fix 依赖冲突
CMD  node index.js
 
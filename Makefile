.PHONY: build runrun remove

build:
	docker build -t wechat-bot .

run:
	docker rm -f wechat-bot || true
	docker run --name  wechat-bot wechat-bot


remove:
	docker rm -f wechat-bot || true

dev:
	yarn run start

 
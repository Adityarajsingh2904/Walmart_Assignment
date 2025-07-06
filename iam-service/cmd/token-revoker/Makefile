lint:
	go vet ./...
	staticcheck ./...

test:
	go test ../../internal/... -coverprofile=coverage.out

build:
	CGO_ENABLED=0 go build -ldflags="-s -w" -o token-revoker .

docker:
	docker build -t token-revoker:local -f cmd/token-revoker/Dockerfile .

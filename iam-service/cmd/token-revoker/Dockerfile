FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/token-revoker ./cmd/token-revoker
COPY internal ./internal
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /bin/token-revoker ./cmd/token-revoker

FROM scratch
COPY --from=build /bin/token-revoker /token-revoker
ENTRYPOINT ["/token-revoker"]

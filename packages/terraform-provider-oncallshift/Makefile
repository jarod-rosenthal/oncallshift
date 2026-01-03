# Terraform Provider for OnCallShift

HOSTNAME=registry.terraform.io
NAMESPACE=oncallshift
NAME=oncallshift
BINARY=terraform-provider-${NAME}
VERSION=0.1.0
OS_ARCH=linux_amd64

default: install

# Build the provider
build:
	go build -o ${BINARY}

# Install provider locally for testing
install: build
	mkdir -p ~/.terraform.d/plugins/${HOSTNAME}/${NAMESPACE}/${NAME}/${VERSION}/${OS_ARCH}
	mv ${BINARY} ~/.terraform.d/plugins/${HOSTNAME}/${NAMESPACE}/${NAME}/${VERSION}/${OS_ARCH}

# Run unit tests
test:
	go test -v ./...

# Run acceptance tests (requires ONCALLSHIFT_API_KEY)
testacc:
	TF_ACC=1 go test -v ./... -timeout 120m

# Generate documentation
docs:
	go generate ./...

# Clean build artifacts
clean:
	rm -f ${BINARY}
	rm -rf ~/.terraform.d/plugins/${HOSTNAME}/${NAMESPACE}/${NAME}

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	golangci-lint run

# Update dependencies
deps:
	go mod tidy

.PHONY: build install test testacc docs clean fmt lint deps

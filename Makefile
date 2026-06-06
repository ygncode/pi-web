.PHONY: build setup frontend-setup go-setup root-setup frontend-build frontend-test frontend-knip extension-test memory-test go-test install-test vet test check clean dev release-patch release-minor release-major release-beta e2e e2e-setup

BINARY ?= pi-web
WEB_DIR := web
E2E_DIR := e2e
NODE_MODULES := $(WEB_DIR)/node_modules
ROOT_NODE_MODULES := node_modules

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

build: setup frontend-build
	go build -ldflags="-s -w -X main.version=$(VERSION)" -o $(BINARY) ./cmd/pi-web

setup: frontend-setup go-setup

frontend-setup:
	@if [ ! -d "$(NODE_MODULES)" ]; then \
		echo "Installing frontend dependencies..."; \
		cd $(WEB_DIR) && npm install; \
	else \
		echo "Frontend dependencies already installed."; \
	fi

go-setup:
	go mod download

root-setup:
	@if [ ! -d "$(ROOT_NODE_MODULES)" ]; then \
		echo "Installing root dependencies..."; \
		npm install --ignore-scripts; \
	else \
		echo "Root dependencies already installed."; \
	fi

frontend-build: frontend-setup
	cd $(WEB_DIR) && npm run build

frontend-test: frontend-setup
	cd $(WEB_DIR) && npm run test

frontend-knip: frontend-setup
	cd $(WEB_DIR) && npm run knip

extension-test: root-setup
	npm run test:extensions

memory-test:
	PYTHONDONTWRITEBYTECODE=1 python3 .pi/skills/memory/scripts/test_memory.py

go-test: go-setup
	go test ./...

install-test:
	bash tests/install/inplace_test.sh

vet: go-setup
	go vet ./...

test: frontend-test extension-test memory-test go-test install-test

check: frontend-knip frontend-test extension-test memory-test frontend-build go-test install-test vet

dev: frontend-setup go-setup
	@echo "Starting dev mode (frontend watcher + Go hot-reloader)..."
	@cd $(WEB_DIR) && npm run dev & \
	VITE_PID=$$!; \
	trap "kill $$VITE_PID 2>/dev/null; exit" INT TERM EXIT; \
	air

version:
	@echo $(VERSION)

# End-to-end browser tests (Playwright). Kept out of `test`/`check` because they
# need browser binaries and the built server. See docs/dev/e2e-testing.md.
e2e-setup:
	cd $(E2E_DIR) && npm ci && npx playwright install --with-deps chromium firefox webkit

e2e: build
	cd $(E2E_DIR) && npx playwright test

clean:
	rm -f $(BINARY)
	rm -rf $(WEB_DIR)/dist

# Release helpers — bump package.json, commit, tag, and push.
# Uses npm version which auto-creates a vX.Y.Z git tag.
release-patch:
	npm version patch
	git push --follow-tags

release-minor:
	npm version minor
	git push --follow-tags

release-major:
	npm version major
	git push --follow-tags

release-beta:
	npm version prerelease --preid=beta
	git push --follow-tags

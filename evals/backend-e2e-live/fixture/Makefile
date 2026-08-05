.PHONY: e2e-up e2e-health e2e-test e2e-reset

e2e-up:
	sh scripts/e2e-up.sh

e2e-health:
	sh scripts/e2e-health.sh

e2e-test:
	BASE_URL=$${BASE_URL:-http://127.0.0.1:$${PORT:-18080}} go test ./e2e -count=1

e2e-reset:
	sh scripts/e2e-reset.sh

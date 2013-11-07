test:
	jshint --show-non-errors --verbose controllers/shared/*.js controllers/*.js *.js *.json

.PHONY: test

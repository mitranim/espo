MAKEFLAGS := --silent --always-make
PAR := $(MAKE) -j 128
DENO := deno run --no-check
TEST := test/test.mjs

watch:
	$(PAR) test_w lint_w

prep: lint test

test_w:
	$(DENO) --watch $(TEST)

test:
	$(DENO) $(TEST)

lint_w:
	watchexec -r -d=0 -e=mjs -n -- make lint

lint:
	deno lint

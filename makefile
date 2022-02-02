MAKEFLAGS := --silent --always-make
PAR := $(MAKE) -j 128
DENO := deno run --no-check --unstable --allow-hrtime
RUN := $(if $(run),--run "$(run)",)
VERB := $(if $(filter $(verb),true),-v,)
TEST := test/test.mjs $(VERB) $(RUN)
BENCH := test/bench.mjs $(VERB) $(RUN)

test_w:
	$(DENO) --watch $(TEST)

test:
	$(DENO) $(TEST)

bench_w:
	$(DENO) --watch $(BENCH)

bench:
	$(DENO) $(BENCH)

lint_w:
	watchexec -r -c -d=0 -e=mjs -n -- $(MAKE) lint

lint:
	deno lint --rules-exclude=no-empty,require-yield

watch:
	$(PAR) test_w lint_w

prep: lint test

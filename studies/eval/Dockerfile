FROM rocker/r-ver:4.5.1

ARG PPM_SNAPSHOT=2025-08-01
ENV CRAN_REPO=https://packagemanager.posit.co/cran/${PPM_SNAPSHOT}

RUN apt-get update && apt-get install -y --no-install-recommends \
	build-essential \
	cmake \
	gfortran \
	libcurl4-openssl-dev \
	libssl-dev \
	libxml2-dev \
	zlib1g-dev \
	libfontconfig1-dev \
	libfreetype6-dev \
	libharfbuzz-dev \
	libfribidi-dev \
	libpng-dev \
	libtiff5-dev \
	libjpeg-dev \
	liblapack-dev \
	libblas-dev \
	&& rm -rf /var/lib/apt/lists/*

RUN R -q -e "options(repos = c(CRAN = Sys.getenv('CRAN_REPO'))); install.packages(c('dplyr','tidyr','readr','stringr','purrr','ggplot2','lme4','lmerTest','emmeans','psych','e1071','broom.mixed','simr','ordinal'), Ncpus = max(1L, parallel::detectCores()))"

WORKDIR /work
ENTRYPOINT ["Rscript", "analysis/run_all.R"]

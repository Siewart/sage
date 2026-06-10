FROM rocker/r-ver:4.5.1

# lme4 requires cmake
RUN apt-get update && apt-get install -y --no-install-recommends cmake 

RUN R -q -e "install.packages('remotes', repos='https://cloud.r-project.org')"

RUN R -q -e "remotes::install_version('dplyr', version = '1.1.4', repos = 'https://cloud.r-project.org', upgrade = 'never', dependencies = NA);"
RUN R -q -e "remotes::install_version('tidyr', version = '1.3.1', repos = 'https://cloud.r-project.org', upgrade = 'never', dependencies = NA);"
RUN R -q -e "remotes::install_version('readr', version = '2.1.5', repos = 'https://cloud.r-project.org', upgrade = 'never', dependencies = NA);"
RUN R -q -e "remotes::install_version('stringr', version = '1.5.1', repos = 'https://cloud.r-project.org', upgrade = 'never', dependencies = NA);"
RUN R -q -e "remotes::install_version('purrr', version = '1.1.0', repos = 'https://cloud.r-project.org', upgrade = 'never', dependencies = NA);"
RUN R -q -e "remotes::install_version('lme4', version = '1.1.37', repos = 'https://cloud.r-project.org', upgrade = 'never', dependencies = NA);"
RUN R -q -e "remotes::install_version('lmerTest', version = '3.1.3', repos = 'https://cloud.r-project.org', upgrade = 'never', dependencies = NA);"
RUN R -q -e "remotes::install_version('emmeans', version = '1.11.2.8', repos = 'https://cloud.r-project.org', upgrade = 'never', dependencies = NA);"

WORKDIR /work
ENTRYPOINT ["Rscript", "analysis/run_all.R"]
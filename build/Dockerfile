# MIT License

# Copyright (c) 2025 The University of Texas MD Anderson Cancer Center
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the 'Software'), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

##  Build targets:
##    prod: for production deployments
##    dev: for development deployments

####
##  *** START of node-base ***
####

FROM node:22.4.1-bookworm-slim AS node-base

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y git rsync && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

####
##  *** END of node-base ***
####

FROM node-base AS prod

ARG GIT_SOURCES="sbgnviz"
ARG LOCAL_SOURCES="pipeline global-variables pathway-report pathway-loader"

# The following modules will be compiled at container build time:
ARG STATIC_MODULES="pipeline global-variables pathway-report"
# The following module will be compiled at run time:
ARG DYNAMIC_MODULES="pathway-loader"
ARG ALL_MODULES="$STATIC_MODULES $DYNAMIC_MODULES"

## release tag for https://github.com/MD-Anderson-Bioinformatics/sbgnviz.js
ARG SBGNVIZ_RELEASE

## The sources of all modules within the package:
ADD modules /module-sources
ADD workspace /workspace

# Update /workspace/package.json listing ALL_MODULES:
RUN M='' && \
    for module in $ALL_MODULES ; do \
      echo Including $module ; \
      if [ "X$M" != X ] ; then M="$M, " ; fi ; \
      M="$M"' "'$module'"' ; \
    done && \
    sed -i "s/MODULES/$M/" /workspace/package.json

# Copy/clone all the modules into /workspace and npm install them.
RUN git config --global advice.detachedHead false && \
    for resource in $GIT_SOURCES ; do \
      /module-sources/clone.$resource /workspace/$resource ; \
    done && \
    for resource in $LOCAL_SOURCES ; do \
     echo Copying $resource && \
     cp -r /module-sources/$resource /workspace/$resource ; \
    done && \
    cd /workspace && \
    npm install sbgnviz --force && \
    npm cache clean --force

# Generate static modules
RUN for module in $STATIC_MODULES ; do \
      echo Compiling module $module && \
      cd /workspace/$module && \
      mkdir -p /workspace/report-modules/$module && \
      OUTPUT_DIR=/workspace/report-modules/$module npm run build ; \
    done

## The scripts directory contains scripts used by the pathways module.
COPY scripts /workspace/scripts
COPY files-to-copy /workspace

## Initialize /pathways
#
# Docker does not provide a good option for allowing one container to mount a
# directory from another container (or an image) at a possibly different path.
#
# This solution uses a named volume mounted into both containers.
# - The volume is a separate entity from the container and the container's image.
# - If it doesn't already exist, the volume is created and populated when first
#   accessed.
#   - Hence, any other services that use the volume must depend on the pathways
#     service to ensure that the volume is populated correctly.
# - To guard against accidental data loss, Docker does not automatically remove
#   the volume when the containers are stopped.
# - If the volume already exists when the container is started, it is NOT
#   recreated or repopulated.  The existing container contents are preserved.
#
# So:
# - We initialize /pathways here, so that the volume is populated immediately
#   the first time the container is started.  (The initial rsync can take some
#   time.)
# - On every startup, we rsync the necessary files from /workspace to /pathways,
#   so that any updates are applied as soon as possible.

RUN mkdir /pathways && /workspace/scripts/copy-to-pathways

CMD [ "/workspace/scripts/copy-to-pathways" ]

####
##  *** END of prod ***
####

# DEV version adds vim and jq by default, and stays around instead of exiting
# immediately.
FROM prod AS dev

RUN apt-get update && \
    apt-get install -y vim jq

CMD [ "/workspace/scripts/copy-to-pathways", "persist" ]

####
##  *** END of dev ***
####

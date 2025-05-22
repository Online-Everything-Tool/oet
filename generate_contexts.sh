#!/bin/bash

rm -rf app/api/generate-tool-resources/_contexts

cd infra/generate_context/
./project.sh
./tools.sh

npm run prebuild

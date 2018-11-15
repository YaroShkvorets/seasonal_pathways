wget -nv -O "data/osm_pathways.osm" --post-file="pathways.query" "http://overpass-api.de/api/interpreter"

osmtogeojson data/osm_pathways.osm > data/osm_pathways.json

node main.js
